import Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import {
  GENERATION_SYSTEM_PROMPT,
  TRANSLATION_SYSTEM_PROMPT,
  PART_SYSTEM_PROMPT,
  PROOFREAD_SYSTEM_PROMPT,
  buildGenerationUserContent,
  buildTranslationUserContent,
  buildPartUserContent,
  buildProofreadUserContent,
  type SermonMetadata,
  type ImagePayload,
} from "@/lib/prompt";
import {
  insertSummaryServer,
  updateSummaryServer,
  getSummaryServer,
  mergePartServer,
  mergeProofreadPartServer,
  mergeSummaryDocServer,
  addUsageServer,
} from "@/lib/summaries-server";
import type { SummaryUsage } from "@/lib/types";
import { sendPushToAll } from "@/lib/push";
import type { Lang } from "@/lib/types";
import { ensureEnhanceCss } from "@/lib/enhance";
import { stitchPartsServer } from "@/lib/stitch";
import { extractHtmlTitle } from "@/lib/util";
import { requireSessionOrUnauthorized } from "@/lib/auth/server";
import { supabaseAdminAvailable } from "@/lib/supabase-server";

export const runtime = "nodejs";
// The background generation runs inside this function via after(); the work
// must finish within this limit (and it no longer depends on the client staying
// connected — locking the phone or switching apps won't interrupt it).
export const maxDuration = 300;

// The whole service runs on the latest, most capable Opus.
const MODEL = "claude-opus-4-8";

type RequestBody = {
  mode?: "generate" | "translate" | "part" | "proofread";
  metadata?: SermonMetadata;
  theme?: string;
  transcript?: string;
  noteImages?: ImagePayload[];
  bulletinImages?: ImagePayload[];
  id?: string;
  language?: Lang;
  sourceHtml?: string;
  partIndex?: number;
  partCount?: number;
  /** When true, Claude proofreads the transcript before summarizing. */
  proofread?: boolean;
};

type UserContent = ReturnType<typeof buildGenerationUserContent>;

function stripFences(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) t = t.replace(/^```[a-zA-Z]*\s*\n?/, "");
  if (t.endsWith("```")) t = t.replace(/\n?```$/, "");
  return t.trim();
}


/**
 * Run one Anthropic generation to completion and return the cleaned HTML.
 * Cost-bounded (target under $1): no extended thinking, effort medium,
 * max_tokens capped. The system prompt is prompt-cached. Streaming is used
 * only to assemble the full message without hitting the SDK's non-stream
 * timeout guard — nothing is streamed to a client here.
 */
type RunResult = { text: string; usage: SummaryUsage };

async function runAnthropic(
  system: string,
  content: UserContent,
  opts?: { maxTokens?: number; effort?: "low" | "medium" | "high"; model?: string },
): Promise<RunResult> {
  const client = new Anthropic();
  const params = {
    model: opts?.model ?? MODEL,
    max_tokens: opts?.maxTokens ?? 24000,
    output_config: { effort: opts?.effort ?? "medium" },
    system: [
      {
        type: "text" as const,
        text: system,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user" as const, content }],
  };
  const stream = client.messages.stream(
    params as Parameters<typeof client.messages.stream>[0],
  );
  const msg = await stream.finalMessage();
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const u = msg.usage as {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  return {
    text: stripFences(text),
    usage: {
      input: u?.input_tokens ?? 0,
      output: u?.output_tokens ?? 0,
      cache_create: u?.cache_creation_input_tokens ?? 0,
      cache_read: u?.cache_read_input_tokens ?? 0,
    },
  };
}

/**
 * Optional proofreading pass: Claude cleans the messy Clova Note ASR transcript
 * (mishearings, the pastor's name, Bible references) before the summary is
 * written, so the summary works from a faithful script. Runs at low effort to
 * keep cost down. Best-effort — if it fails or returns a suspiciously short
 * result (a sign it summarized instead of proofreading), we fall back to the
 * original transcript so a proofreading hiccup never sinks the whole job.
 */
async function cleanTranscript(
  metadata: SermonMetadata,
  transcript: string,
): Promise<{ text: string; usage: SummaryUsage }> {
  try {
    const content = buildProofreadUserContent(metadata, transcript);
    const { text, usage } = await runAnthropic(PROOFREAD_SYSTEM_PROMPT, content, {
      maxTokens: 32000,
      effort: "low",
    });
    if (!text || text.length < transcript.length * 0.5) {
      console.warn(
        "[sermorizer] proofread fallback: cleaned output too short — using raw transcript",
        { cleanedLen: text?.length ?? 0, rawLen: transcript.length },
      );
      return { text: transcript, usage };
    }
    return { text, usage };
  } catch (e) {
    console.error(
      "[sermorizer] proofread threw — falling back to raw transcript:",
      e instanceof Error ? e.message : e,
    );
    return { text: transcript, usage: {} };
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "The server is missing its ANTHROPIC_API_KEY. Set it in the environment (.env.local locally, or project settings on Vercel) and restart.",
      },
      { status: 503 },
    );
  }
  if (!supabaseAdminAvailable()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 },
    );
  }
  const guard = await requireSessionOrUnauthorized();
  if (guard) return guard;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json({ error: "Request body was not valid JSON." }, { status: 400 });
  }

  // Defensive input caps — bound worst-case Claude cost even after auth.
  const MAX_TRANSCRIPT = 400_000; // chars (~well beyond a 90-min sermon)
  const MAX_IMAGES = 8;
  const MAX_SOURCE_HTML = 600_000;
  if ((body.transcript?.length ?? 0) > MAX_TRANSCRIPT) {
    return Response.json({ error: "Transcript is too large." }, { status: 413 });
  }
  if (
    (body.noteImages?.length ?? 0) > MAX_IMAGES ||
    (body.bulletinImages?.length ?? 0) > MAX_IMAGES
  ) {
    return Response.json({ error: `Too many images (max ${MAX_IMAGES} each).` }, { status: 413 });
  }
  if ((body.sourceHtml?.length ?? 0) > MAX_SOURCE_HTML) {
    return Response.json({ error: "Source document is too large." }, { status: 413 });
  }

  try {
    if (body.mode === "translate") {
      if (body.language !== "en" && body.language !== "zh") {
        throw new Error("Translation requires a language of 'en' or 'zh'.");
      }
      if (!body.id) throw new Error("Translation requires the saved summary id.");
      if (!body.sourceHtml || body.sourceHtml.trim().length < 50) {
        throw new Error("Translation requires the generated Korean HTML document.");
      }
      const id = body.id;
      const lang = body.language;
      const sourceHtml = body.sourceHtml;

      await updateSummaryServer(id, { status: "translating", error: null });

      // Detached background work — continues even if the client disconnects.
      after(async () => {
        try {
          const { text: raw, usage } = await runAnthropic(
            TRANSLATION_SYSTEM_PROMPT,
            buildTranslationUserContent(lang, sourceHtml),
          );
          await addUsageServer(id, usage);
          if (!raw.toLowerCase().includes("</html>")) {
            throw new Error("Translation stopped early — please try again.");
          }
          const html = ensureEnhanceCss(raw);
          // Atomic merge — won't clobber a sibling-language translation that
          // finishes around the same time.
          await mergeSummaryDocServer(id, lang, html);
          await sendPushToAll({
            title: "Sermorizer",
            body: `Your ${lang === "en" ? "English" : "Chinese"} translation is ready.`,
          });
        } catch (e) {
          console.error("[sermorizer] translate failed", {
            id,
            lang,
            err: e instanceof Error ? e.message : String(e),
          });
          await updateSummaryServer(id, {
            status: "error",
            error: e instanceof Error ? e.message : "Translation failed.",
          });
        }
      });

      return Response.json({ id });
    }

    // Long-sermon proofread pre-phase: one Opus pass on a single transcript
    // slice, stored in proofread_parts[partIndex]. Single-pass per call keeps
    // every job comfortably inside the 300s function limit, and the client
    // fires N of these in parallel for speed.
    if (body.mode === "proofread") {
      const m = body.metadata ?? {};
      const partIndex = body.partIndex ?? 0;
      const partCount = body.partCount ?? 1;
      if (!body.transcript || body.transcript.trim().length < 10) {
        throw new Error("This proofread part is missing its transcript slice.");
      }
      if (partIndex < 0 || partCount < 1 || partIndex >= partCount) {
        throw new Error("Invalid proofread part index.");
      }

      // The first proofread part creates the row; later proofread parts (and
      // the subsequent `part` HTML phase) reference it.
      let id = body.id;
      if (partIndex === 0 && !id) {
        const pending = await insertSummaryServer({
          title: m.title?.trim() || "Generating…",
          serviceDate: m.date?.trim() || undefined,
          occasion: m.occasion?.trim() || undefined,
          docs: {},
          status: "generating",
        });
        id = pending.id;
      }
      if (!id) {
        throw new Error("A proofread part after the first requires the summary id.");
      }
      const rowId = id;
      const slice = body.transcript;

      after(async () => {
        try {
          // cleanTranscript is best-effort; on failure it returns `slice` so
          // we always end up storing usable text for this index.
          const { text: cleaned, usage } = await cleanTranscript(m, slice);
          await addUsageServer(rowId, usage);
          await mergeProofreadPartServer(rowId, String(partIndex), cleaned);
        } catch {
          // Fall back to the raw slice rather than fail the whole job — the
          // HTML pass can still produce a summary from the uncorrected text.
          try {
            await mergeProofreadPartServer(rowId, String(partIndex), slice);
          } catch (e) {
            console.error("[sermorizer] proofread part fallback also failed", {
              id: rowId,
              partIndex,
              err: e instanceof Error ? e.message : String(e),
            });
            await updateSummaryServer(rowId, {
              status: "error",
              error: e instanceof Error ? e.message : "Proofreading failed.",
            });
          }
        }
      });

      return Response.json({ id: rowId });
    }

    if (body.mode === "part") {
      const m = body.metadata ?? {};
      const partIndex = body.partIndex ?? 0;
      const partCount = body.partCount ?? 1;
      if (!body.transcript || body.transcript.trim().length < 10) {
        throw new Error("This part is missing its transcript slice.");
      }
      if (partIndex < 0 || partCount < 1 || partIndex >= partCount) {
        throw new Error("Invalid part index.");
      }

      // Part 0 creates the row; later parts reference it.
      let id = body.id;
      if (partIndex === 0) {
        const pending = await insertSummaryServer({
          title: m.title?.trim() || "Generating…",
          serviceDate: m.date?.trim() || undefined,
          occasion: m.occasion?.trim() || undefined,
          docs: {},
          status: "generating",
        });
        id = pending.id;
      }
      if (!id) throw new Error("A part after the first requires the summary id.");
      const rowId = id;
      const slice = body.transcript;
      // NB: the optional proofread pass is single-call only. For long sermons
      // (this `part` flow) doing two Opus passes per part can blow past the
      // 300s function limit, so we skip it here and trust the listener's
      // metadata + the per-section prompt to keep names/refs right.

      after(async () => {
        try {
          const content = buildPartUserContent({
            ...body,
            transcript: slice,
            partIndex,
            partCount,
          });
          const { text: html, usage } = await runAnthropic(PART_SYSTEM_PROMPT, content);
          await addUsageServer(rowId, usage);
          if (!html.toLowerCase().includes("</html>")) {
            throw new Error("A part stopped early — please try again.");
          }
          // Atomic server-side merge — safe even if parts finish concurrently.
          await mergePartServer(rowId, String(partIndex), html);

          // If this completed the set, finalize server-side: stitch into one
          // document, set docs.ko + done, clear the now-unneeded parts, and
          // push a completion alert. Doing this on the server (not the client)
          // means a long sermon finishes even if the app was closed mid-job.
          const row = await getSummaryServer(rowId);
          const parts = row?.parts ?? {};
          let complete = true;
          for (let i = 0; i < partCount; i++) {
            if (!parts[String(i)]) {
              complete = false;
              break;
            }
          }
          if (complete && row && !row.docs?.ko) {
            try {
              const combined = stitchPartsServer(parts, partCount);
              const title =
                m.title?.trim() || extractHtmlTitle(combined) || "Untitled sermon";
              await updateSummaryServer(rowId, {
                docs: { ko: combined },
                title,
                status: "done",
                error: null,
                parts: {},
              });
              await sendPushToAll({
                title: "Sermorizer",
                body: "Your sermon summary is ready.",
              });
            } catch {
              // Leave parts in place; the client can still stitch as a fallback.
            }
          }
        } catch (e) {
          console.error("[sermorizer] part failed", {
            id: rowId,
            partIndex,
            partCount,
            err: e instanceof Error ? e.message : String(e),
          });
          await updateSummaryServer(rowId, {
            status: "error",
            error: e instanceof Error ? e.message : "A part failed to generate.",
          });
        }
      });

      return Response.json({ id: rowId });
    }

    // mode: generate
    const m = body.metadata ?? {};
    if (!body.transcript || body.transcript.trim().length < 20) {
      throw new Error("A sermon transcript (.txt) is required.");
    }
    const hasBulletin = (body.bulletinImages?.length ?? 0) > 0;
    if (!hasBulletin && !m.title?.trim()) {
      throw new Error(
        "A sermon title is required unless an order-of-service (주보) photo is provided.",
      );
    }
    if (!hasBulletin && !m.scripture?.trim()) {
      throw new Error(
        "A scripture passage is required unless an order-of-service (주보) photo is provided.",
      );
    }

    const rawTranscript = body.transcript;
    const proofread = body.proofread !== false;

    // Create the pending row first so the client gets an id to poll immediately.
    const pending = await insertSummaryServer({
      title: m.title?.trim() || "Generating…",
      serviceDate: m.date?.trim() || undefined,
      occasion: m.occasion?.trim() || undefined,
      docs: {},
      status: "generating",
    });

    after(async () => {
      try {
        // Optional: proofread the transcript before summarizing.
        let transcript = rawTranscript;
        if (proofread) {
          const cleaned = await cleanTranscript(m, rawTranscript);
          transcript = cleaned.text;
          await addUsageServer(pending.id, cleaned.usage);
        }
        const content = buildGenerationUserContent({ ...body, transcript });
        const { text: raw, usage } = await runAnthropic(GENERATION_SYSTEM_PROMPT, content);
        await addUsageServer(pending.id, usage);
        if (!raw.toLowerCase().includes("</html>")) {
          throw new Error("Generation stopped early — please try again.");
        }
        const html = ensureEnhanceCss(raw);
        const title = m.title?.trim() || extractHtmlTitle(html) || "Untitled sermon";
        await updateSummaryServer(pending.id, {
          docs: { ko: html },
          title,
          status: "done",
          error: null,
        });
        await sendPushToAll({
          title: "Sermorizer",
          body: "Your sermon summary is ready.",
        });
      } catch (e) {
        console.error("[sermorizer] generate failed", {
          id: pending.id,
          err: e instanceof Error ? e.message : String(e),
        });
        await updateSummaryServer(pending.id, {
          status: "error",
          error: e instanceof Error ? e.message : "Generation failed.",
        });
      }
    });

    return Response.json({ id: pending.id });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid request." },
      { status: 400 },
    );
  }
}
