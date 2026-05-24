import Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import {
  GENERATION_SYSTEM_PROMPT,
  TRANSLATION_SYSTEM_PROMPT,
  PART_SYSTEM_PROMPT,
  buildGenerationUserContent,
  buildTranslationUserContent,
  buildPartUserContent,
  type SermonMetadata,
  type ImagePayload,
} from "@/lib/prompt";
import { cloudInsert, cloudUpdate, cloudGet, type Lang } from "@/lib/summaries";
import { ensureEnhanceCss } from "@/lib/enhance";

export const runtime = "nodejs";
// The background generation runs inside this function via after(); the work
// must finish within this limit (and it no longer depends on the client staying
// connected — locking the phone or switching apps won't interrupt it).
export const maxDuration = 300;

const MODEL = "claude-opus-4-7";

type RequestBody = {
  mode?: "generate" | "translate" | "part";
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
};

type UserContent = ReturnType<typeof buildGenerationUserContent>;

function stripFences(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) t = t.replace(/^```[a-zA-Z]*\s*\n?/, "");
  if (t.endsWith("```")) t = t.replace(/\n?```$/, "");
  return t.trim();
}

function extractTitle(html: string): string {
  const t = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  if (t && t.trim()) return t.trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return h1.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

/**
 * Run one Anthropic generation to completion and return the cleaned HTML.
 * Cost-bounded (target under $1): no extended thinking, effort medium,
 * max_tokens capped. The system prompt is prompt-cached. Streaming is used
 * only to assemble the full message without hitting the SDK's non-stream
 * timeout guard — nothing is streamed to a client here.
 */
async function runAnthropic(system: string, content: UserContent): Promise<string> {
  const client = new Anthropic();
  const params = {
    model: MODEL,
    max_tokens: 24000,
    output_config: { effort: "medium" as const },
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
  return stripFences(text);
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

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json({ error: "Request body was not valid JSON." }, { status: 400 });
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

      await cloudUpdate(id, { status: "translating", error: null });

      // Detached background work — continues even if the client disconnects.
      after(async () => {
        try {
          const raw = await runAnthropic(
            TRANSLATION_SYSTEM_PROMPT,
            buildTranslationUserContent(lang, sourceHtml),
          );
          if (!raw.toLowerCase().includes("</html>")) {
            throw new Error("Translation stopped early — please try again.");
          }
          const html = ensureEnhanceCss(raw);
          const row = await cloudGet(id);
          const docs = { ...(row?.docs ?? {}), [lang]: html };
          await cloudUpdate(id, { docs, status: "done", error: null });
        } catch (e) {
          await cloudUpdate(id, {
            status: "error",
            error: e instanceof Error ? e.message : "Translation failed.",
          });
        }
      });

      return Response.json({ id });
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
        const pending = await cloudInsert({
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

      const content = buildPartUserContent({ ...body, partIndex, partCount });

      after(async () => {
        try {
          const html = await runAnthropic(PART_SYSTEM_PROMPT, content);
          if (!html.toLowerCase().includes("</html>")) {
            throw new Error("A part stopped early — please try again.");
          }
          // Merge this part into the row's parts map (re-read to avoid clobber).
          const row = await cloudGet(rowId);
          const parts = { ...(row?.parts ?? {}), [String(partIndex)]: html };
          await cloudUpdate(rowId, { parts });
        } catch (e) {
          await cloudUpdate(rowId, {
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

    const content = buildGenerationUserContent(body);

    // Create the pending row first so the client gets an id to poll immediately.
    const pending = await cloudInsert({
      title: m.title?.trim() || "Generating…",
      serviceDate: m.date?.trim() || undefined,
      occasion: m.occasion?.trim() || undefined,
      docs: {},
      status: "generating",
    });

    after(async () => {
      try {
        const raw = await runAnthropic(GENERATION_SYSTEM_PROMPT, content);
        if (!raw.toLowerCase().includes("</html>")) {
          throw new Error("Generation stopped early — please try again.");
        }
        const html = ensureEnhanceCss(raw);
        const title = m.title?.trim() || extractTitle(html) || "Untitled sermon";
        await cloudUpdate(pending.id, {
          docs: { ko: html },
          title,
          status: "done",
          error: null,
        });
      } catch (e) {
        await cloudUpdate(pending.id, {
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
