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
  claimPendingSummaryServer,
  markSummaryErrorServer,
  finalizeSummaryIfGeneratingServer,
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
import { splitHtmlForTranslation, reassembleTranslatedHtml } from "@/lib/translate-split";
import { stitchPartsServer } from "@/lib/stitch";
import { extractHtmlTitle } from "@/lib/util";
import { requireSessionOrUnauthorized } from "@/lib/auth/server";
import { supabaseAdminAvailable } from "@/lib/supabase-server";

export const runtime = "nodejs";
// The heavy generation runs AFTER the HTTP response via next/server `after()`
// (so the client gets an id immediately and can lock the phone). That
// post-response work ONLY executes on Vercel Fluid Compute — on classic
// Lambdas the function is frozen the moment the response is sent, so the
// Anthropic call never runs, the row stays "generating", and the client
// eventually reports "A part took longer than the server allows". Fluid
// Compute is therefore REQUIRED and is enabled in vercel.json ({ "fluid":
// true }); do not remove it. maxDuration bounds the post-response work.
//
// 300 is the hard ceiling on this Vercel plan — a higher value FAILS THE BUILD
// ("maxDuration must be between 1 and 300"). Every model call is capped by
// max_tokens so it finishes inside this budget; a run that would exceed it
// truncates with a detectable stop_reason and fails cleanly instead of being
// killed mid-flight.
export const maxDuration = 300;

// The whole service runs on the latest, most capable Opus. Hard-coded default
// (the deliberate quality choice), with an emergency override so a sudden model
// retirement or rename can be patched via env without a redeploy.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

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
  /** Per-attempt token. Every request of one generation attempt carries the
   *  same token; it fences out stale workers from a previous, reclaimed
   *  attempt (they carry the old token). */
  genToken?: string;
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
type RunResult = { text: string; usage: SummaryUsage; stopReason: string | null };

async function runAnthropic(
  system: string,
  content: UserContent,
  opts?: { maxTokens?: number; effort?: "low" | "medium" | "high"; model?: string },
): Promise<RunResult> {
  const client = new Anthropic();
  const params = {
    model: opts?.model ?? MODEL,
    // Default output cap: 20000 tokens ≈ 280-330s at Opus's typical rate.
    // Deliberately close to (not far past) maxDuration=300 — a run that would
    // exceed the budget truncates with a detectable stop_reason and fails
    // CLEANLY, instead of the function being killed mid-flight and the row
    // sticking in 'generating'/'translating' forever. Typical documents are
    // 10-15k tokens, so the cap rarely binds.
    max_tokens: opts?.maxTokens ?? 20000,
    // Thinking is explicitly OFF, and that is load-bearing here — not a
    // leftover. On Claude Opus 5 the default flipped: omitting `thinking`
    // now runs ADAPTIVE thinking (on Opus 4.8 it meant no thinking). Two
    // things break if it is left on:
    //   1. max_tokens caps thinking + response TOGETHER, so thinking eats the
    //      20000-token budget the HTML document needs and the document
    //      truncates (stop_reason "max_tokens").
    //   2. The extra thinking time pushes past maxDuration=300 — the exact
    //      timeout this service is calibrated around.
    // Disabling requires effort <= "high"; the `effort` option is typed to
    // low|medium|high precisely so this can never be paired with xhigh/max
    // (which would 400). Raise effort past high only by enabling thinking and
    // re-deriving the max_tokens/duration budget.
    thinking: { type: "disabled" as const },
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
    stopReason: msg.stop_reason ?? null,
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
    // 16000 tokens ≈ 230s worst case — the proofread pass must leave time in
    // the same 300s function for whatever runs after it. Callers gate the
    // transcript size so a full proofread fits well inside this cap.
    const { text, usage, stopReason } = await runAnthropic(PROOFREAD_SYSTEM_PROMPT, content, {
      maxTokens: 16000,
      effort: "low",
    });
    // A max_tokens stop means the tail of the transcript was silently cut —
    // for a PROOFREAD (which must preserve everything) that is data loss, so
    // fall back to the raw transcript rather than summarize from a stump.
    if (stopReason === "max_tokens") {
      console.warn(
        "[sermorizer] proofread fallback: output hit the token cap — using raw transcript",
        { rawLen: transcript.length },
      );
      return { text: transcript, usage };
    }
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
          // Split the document into a head (untranslated — fonts swapped
          // deterministically) and 1+ body chunks, and translate every chunk
          // in PARALLEL. This is what lets a long (or long, stitched
          // multi-part) document translate reliably: each chunk is a small,
          // independent fragment call bounded well inside the 300s function
          // limit, instead of one huge whole-document pass that risked
          // truncating past the output-token cap.
          const doc = splitHtmlForTranslation(sourceHtml);
          const results = await Promise.all(
            doc.chunks.map((chunk) =>
              runAnthropic(TRANSLATION_SYSTEM_PROMPT, buildTranslationUserContent(lang, chunk), {
                maxTokens: 12000,
              }),
            ),
          );
          for (const r of results) await addUsageServer(id, r.usage);
          if (results.some((r) => r.stopReason === "max_tokens")) {
            throw new Error(
              "A part of this document is too long to translate in one pass. Please try again.",
            );
          }
          const html = ensureEnhanceCss(
            reassembleTranslatedHtml(
              doc,
              lang,
              results.map((r) => r.text),
            ),
          );
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
          // NB: the row still holds the finished Korean doc (and any sibling
          // translation) — a translate failure must never endanger it. The
          // error status is safe to set because claimPendingSummaryServer
          // refuses to reclaim rows whose docs are non-empty.
          await markSummaryErrorServer(
            id,
            e instanceof Error ? e.message : "Translation failed.",
          );
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

      // The first proofread part creates (or reclaims) the row; later proofread
      // parts (and the subsequent `part` HTML phase) reference it by id.
      const genToken = body.genToken;
      let id = body.id;
      if (partIndex === 0 && !id) {
        const pending = await claimPendingSummaryServer({
          title: m.title?.trim() || "Generating…",
          serviceDate: m.date?.trim() || undefined,
          occasion: m.occasion?.trim() || undefined,
          genToken,
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
          await mergeProofreadPartServer(rowId, String(partIndex), cleaned, genToken);
        } catch {
          // Fall back to the raw slice rather than fail the whole job — the
          // HTML pass can still produce a summary from the uncorrected text.
          try {
            await mergeProofreadPartServer(rowId, String(partIndex), slice, genToken);
          } catch (e) {
            console.error("[sermorizer] proofread part fallback also failed", {
              id: rowId,
              partIndex,
              err: e instanceof Error ? e.message : String(e),
            });
            await markSummaryErrorServer(
              rowId,
              e instanceof Error ? e.message : "Proofreading failed.",
              genToken,
            );
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

      // Part 0 creates (or reclaims) the row; later parts reference it by id.
      // When an id is passed (e.g. the proofread pre-phase already created the
      // row), reuse it instead of inserting a second, orphaned row.
      const genToken = body.genToken;
      let id = body.id;
      if (partIndex === 0 && !id) {
        const pending = await claimPendingSummaryServer({
          title: m.title?.trim() || "Generating…",
          serviceDate: m.date?.trim() || undefined,
          occasion: m.occasion?.trim() || undefined,
          genToken,
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
          // Cap part-mode output so a single part can never run Opus past
          // Vercel's 300s function limit. 14000 tokens ≈ 200–230s of output
          // at the model's typical rate — comfortable headroom — and each
          // part only covers a fraction of the sermon, so the cap is not
          // a real constraint on completeness.
          const { text: html, usage, stopReason } = await runAnthropic(
            PART_SYSTEM_PROMPT,
            content,
            { maxTokens: 14000 },
          );
          await addUsageServer(rowId, usage);
          // Reject a truncated part, and one missing the #sermon-body wrapper:
          // the stitcher silently drops wrapper-less parts (k>=1), so without
          // this check a whole slice of the sermon could vanish from a doc the
          // job still marks 'done'. Failing here reclaims the row on retry.
          if (
            stopReason === "max_tokens" ||
            !html.toLowerCase().includes("</html>") ||
            !/id\s*=\s*["']?sermon-body/i.test(html)
          ) {
            throw new Error("A part stopped early — please try again.");
          }
          // Atomic server-side merge — safe even if parts finish concurrently.
          // Fenced by genToken: a straggler from a reclaimed prior attempt is
          // skipped (merged === false) so it can't mix stale HTML in.
          const merged = await mergePartServer(rowId, String(partIndex), html, genToken);
          if (!merged) return;

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
              // Compare-and-set on status='generating': when the last two
              // parts finish in the same instant, both workers reach here —
              // exactly one wins, so the stitch is stored once and only one
              // completion push goes out.
              const won = await finalizeSummaryIfGeneratingServer(
                rowId,
                {
                  docs: { ko: combined },
                  title,
                  status: "done",
                  error: null,
                  parts: {},
                },
                genToken,
              );
              if (won) {
                await sendPushToAll({
                  title: "Sermorizer",
                  body: "Your sermon summary is ready.",
                });
              }
            } catch (stitchErr) {
              // Leave parts in place and status 'generating' so the client can
              // still stitch as a fallback (its waitForRow accepts all-parts-
              // present). Log it so a genuinely stuck row is diagnosable rather
              // than silently swallowed.
              console.error("[sermorizer] server stitch failed; leaving parts for client", {
                id: rowId,
                partCount,
                err: stitchErr instanceof Error ? stitchErr.message : String(stitchErr),
              });
            }
          }
        } catch (e) {
          console.error("[sermorizer] part failed", {
            id: rowId,
            partIndex,
            partCount,
            err: e instanceof Error ? e.message : String(e),
          });
          await markSummaryErrorServer(
            rowId,
            e instanceof Error ? e.message : "A part failed to generate.",
            genToken,
          );
        }
      });

      return Response.json({ id: rowId });
    }

    // mode: generate
    const m = body.metadata ?? {};
    if (!body.transcript || body.transcript.trim().length < 20) {
      throw new Error("A sermon transcript (.txt) is required.");
    }

    const rawTranscript = body.transcript;
    // The optional proofread pass adds a SECOND sequential Opus pass to the
    // same 300s function. Both passes only fit when the transcript is short:
    // ~6000 chars proofreads in ~130s, leaving ~170s for the summary itself.
    // Longer transcripts silently skip the proofread (the summary prompt
    // already corrects mishearings charitably) rather than risk the function
    // being killed mid-generation and the row sticking at 'generating'.
    const PROOFREAD_MAX_CHARS = 6000;
    const proofreadRequested = body.proofread !== false;
    const proofread = proofreadRequested && rawTranscript.length <= PROOFREAD_MAX_CHARS;
    if (proofreadRequested && !proofread) {
      console.warn("[sermorizer] proofread skipped: transcript too long for two passes", {
        chars: rawTranscript.length,
      });
    }

    // Create the pending row first so the client gets an id to poll immediately
    // — reclaiming a failed earlier attempt for the same sermon instead of
    // leaving a duplicate behind on every retry.
    const genToken = body.genToken;
    const pending = await claimPendingSummaryServer({
      title: m.title?.trim() || "Generating…",
      serviceDate: m.date?.trim() || undefined,
      occasion: m.occasion?.trim() || undefined,
      genToken,
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
        const { text: raw, usage, stopReason } = await runAnthropic(
          GENERATION_SYSTEM_PROMPT,
          content,
        );
        await addUsageServer(pending.id, usage);
        if (stopReason === "max_tokens" || !raw.toLowerCase().includes("</html>")) {
          throw new Error("Generation stopped early — please try again.");
        }
        const html = ensureEnhanceCss(raw);
        const title = m.title?.trim() || extractHtmlTitle(html) || "Untitled sermon";
        // Fenced finalize: only publish if this attempt still owns the row and
        // it's still 'generating'. A retry that reclaimed the row (new token)
        // means this straggler shouldn't overwrite the fresh attempt.
        const won = await finalizeSummaryIfGeneratingServer(
          pending.id,
          { docs: { ko: html }, title, status: "done", error: null, parts: {} },
          genToken,
        );
        if (won) {
          await sendPushToAll({
            title: "Sermorizer",
            body: "Your sermon summary is ready.",
          });
        }
      } catch (e) {
        console.error("[sermorizer] generate failed", {
          id: pending.id,
          err: e instanceof Error ? e.message : String(e),
        });
        await markSummaryErrorServer(
          pending.id,
          e instanceof Error ? e.message : "Generation failed.",
          genToken,
        );
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
