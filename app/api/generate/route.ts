import Anthropic from "@anthropic-ai/sdk";
import {
  GENERATION_SYSTEM_PROMPT,
  TRANSLATION_SYSTEM_PROMPT,
  buildGenerationUserContent,
  buildTranslationUserContent,
  type SermonMetadata,
  type ImagePayload,
} from "@/lib/prompt";

export const runtime = "nodejs";
// Synthesizing a long transcript into a full HTML document can take a while.
export const maxDuration = 300;

const MODEL = "claude-opus-4-7";

type RequestBody = {
  mode?: "generate" | "translate";
  metadata?: SermonMetadata;
  theme?: string;
  transcript?: string;
  noteImages?: ImagePayload[];
  bulletinImages?: ImagePayload[];
  language?: "en" | "zh";
  sourceHtml?: string;
};

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

  let system: string;
  let content: ReturnType<typeof buildGenerationUserContent>;

  try {
    if (body.mode === "translate") {
      if (body.language !== "en" && body.language !== "zh") {
        throw new Error("Translation requires a language of 'en' or 'zh'.");
      }
      if (!body.sourceHtml || body.sourceHtml.trim().length < 50) {
        throw new Error("Translation requires the generated Korean HTML document.");
      }
      system = TRANSLATION_SYSTEM_PROMPT;
      content = buildTranslationUserContent(body.language, body.sourceHtml);
    } else {
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
      system = GENERATION_SYSTEM_PROMPT;
      content = buildGenerationUserContent(body);
    }
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid request." },
      { status: 400 },
    );
  }

  const client = new Anthropic();

  // Cache the (static) system prompt; per-request content lives in the user message.
  // Quality-first: adaptive thinking + "xhigh" effort (one step below the
  // ceiling) for the strongest synthesis. We stop short of "max" deliberately —
  // the whole run must finish inside the serverless time limit, and max effort
  // can spend so long thinking that the document itself gets truncated. xhigh
  // is the best quality that still reliably completes. Summarized thinking is
  // streamed so the planning phase shows visible progress.
  const params = {
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" as const, display: "summarized" as const },
    output_config: { effort: "xhigh" as const },
    system: [
      {
        type: "text" as const,
        text: system,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user" as const, content }],
  };

  const encoder = new TextEncoder();

  let stream: Awaited<ReturnType<typeof client.messages.stream>>;
  try {
    // `output_config` / adaptive thinking are recent API additions; the cast
    // keeps this resilient across SDK type-definition versions.
    stream = client.messages.stream(params as Parameters<typeof client.messages.stream>[0]);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to start generation." },
      { status: 500 },
    );
  }

  // Newline-delimited JSON events: {"t":"html"|"think"|"error","d":"..."}.
  // This keeps the model's thinking progress on a separate channel from the
  // HTML document so the client can show one as status and assemble the other.
  const send = (t: "html" | "think" | "error", d: string) =>
    JSON.stringify({ t, d }) + "\n";

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type !== "content_block_delta") continue;
          if (event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(send("html", event.delta.text)));
          } else if (event.delta.type === "thinking_delta") {
            controller.enqueue(encoder.encode(send("think", event.delta.thinking)));
          }
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(send("error", msg)));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Disable proxy/CDN buffering so chunks reach the browser as they stream.
      "X-Accel-Buffering": "no",
    },
  });
}
