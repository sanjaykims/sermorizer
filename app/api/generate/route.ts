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
      if (!m.title?.trim()) throw new Error("A sermon title is required.");
      if (!m.scripture?.trim()) throw new Error("A scripture passage is required.");
      if (!body.transcript || body.transcript.trim().length < 20) {
        throw new Error("A sermon transcript (.txt) is required.");
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
  const params = {
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "high" as const },
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

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        // The stream has already started; surface the failure inline so the
        // client can detect an incomplete document.
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n<!-- SERMORIZER_STREAM_ERROR: ${msg} -->`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
