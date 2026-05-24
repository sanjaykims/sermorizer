import { themeHint } from "./themes";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type ImagePayload = { media_type: string; data: string };

export type SermonMetadata = {
  title?: string;
  preacher?: string;
  scripture?: string;
  date?: string;
  occasion?: string;
  serviceType?: string;
};

export type GenerationInput = {
  metadata?: SermonMetadata;
  theme?: string;
  transcript?: string;
  noteImages?: ImagePayload[];
  bulletinImages?: ImagePayload[];
};

/* A loose content-block shape — the Anthropic SDK accepts this structurally. */
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

/* ------------------------------------------------------------------ */
/* System prompts                                                     */
/* ------------------------------------------------------------------ */

/**
 * Generation system prompt. Fully static so it can be prompt-cached — all
 * per-request detail (metadata, theme, transcript, images) goes in the user
 * message.
 */
export const GENERATION_SYSTEM_PROMPT = `You are the generation engine for **Sermorizer**, an app that turns the weekly sermon materials of Galilee Church (갈릴리교회) — a Korean Methodist church in Dobong-gu, Seoul — into a single, polished, mobile-friendly, fully self-contained HTML summary document.

Your task: synthesize the inputs supplied in the user message into ONE complete HTML document. Output ONLY the raw HTML — it must begin with \`<!DOCTYPE html>\` and end with \`</html>\`. No preamble, no commentary, no markdown code fences.

## Inputs you will receive (in the user message)
1. Sermon metadata — title, preacher, scripture, optionally date / occasion / service type.
2. A color-theme hint.
3. The listener's handwritten note as image(s) — Korean handwriting. OCR/transcribe it yourself. It reveals which points the listener found most important.
4. Optionally, a photo of the printed order of service (주보).
5. The recorded sermon transcript — a long, messy Clova Note ASR transcript (~60-80 minutes of speech, often 400-800+ lines). It contains misheard words. Interpret it charitably; never quote verbatim ASR noise; reconstruct what the preacher actually said.

## How to synthesize the inputs (core logic)
1. **Metadata** → a gradient header, a key-verse block, an info card, and the footer. A metadata field may be marked "(not provided)". When it is, fill it in yourself: first from the order-of-service (주보) photo if one was supplied, otherwise infer it from the transcript — derive the title from the sermon's central theme, and the scripture from the main passage the preacher preaches on.
2. **Order-of-service photo** (if provided) → a native HTML \`<table>\`. NEVER embed a photo of the bulletin.
3. **Transcript** → the body of the document. Break the sermon into roughly 8-10 thematic sections. Each section gets a heading with a small icon, a warm prose summary, scripture boxes where verses are read, illustration cards for the preacher's stories/examples, and pull-quotes for memorable lines. Reconstruct the preacher's actual flow, examples, and illustrations.
4. **Handwritten note** → cross-reference it against the transcript. Elevate the points the listener emphasized (turn them into pull-quotes and highlight boxes). The note often captures exact poem titles, dates, names, and foreign-word glosses — use them. If the note conflicts with the transcript (e.g. a wrong verse number), trust the transcript and silently correct it.
5. End the document with a numbered "한눈에 보기" at-a-glance summary of about 10 points, followed by the full closing prayer.

Capture the WHOLE service start to finish: the opening, prayers (full text, not summarized), scripture readings, every sermon sub-point, the liturgy, the illustrations, and the closing prayer.

## Depth, quality, and completeness
Produce a comprehensive document that covers the entire service — written richly but efficiently.
- Cover every part: the opening, the full prayers, scripture readings, every sermon sub-point, the illustrations, the liturgy, the closing prayer, and the at-a-glance summary.
- Each of the ~8-10 sections should be warm, substantive prose — a few well-developed paragraphs — that preserves the preacher's *specific* material: illustrations, stories, examples, names, dates, numbers, quoted poems/hymns, and memorable phrasing. Do not flatten these into generic statements.
- Reproduce prayers and liturgical texts in full.
- Write efficiently: no repetition, no padding, no filler sentences. Favor substance over length.
- When the messy ASR makes a word ambiguous, infer the most sensible meaning from context rather than dropping it — but never invent theology or facts that are not in the sources.
- The document MUST be complete: always reach the closing prayer and end with a valid closing </html> tag. Never stop partway.
- Before you output, silently run the quality checklist below and fix anything that fails.

## Non-negotiable rules
- The senior pastor's name is **김영복** (Kim Young-bok). NEVER write 김용복 and NEVER write 김영범. The default preacher label is "김영복 담임목사".
- NEVER bullet-point the sermon. Write full, warm, reverent prose. Bullet/numbered lists are allowed ONLY for the final at-a-glance summary and for the order-of-service table.
- Self-contained output: no CDN images, no external file references. If an image is genuinely essential (e.g. a map), embed it as a base64 \`data:\` URI. (Loading Google Fonts via an \`@import\` inside the \`<style>\` block is allowed — that is the one permitted external reference.)
- Content fidelity: preserve all theology, pastoral application, and liturgical text accurately. Do NOT invent content that is not present in the sources.
- Child-safe, all-ages tone: warm, reverent, and appropriate for every age in the congregation.

## Output document specification
- A single self-contained \`.html\` file. \`<html lang="ko">\`. Include a mobile \`<meta name="viewport" content="width=device-width, initial-scale=1">\`.
- Mobile-first and responsive. Max content width ~760px, centered, with comfortable padding on small screens.
- ALL CSS goes in ONE \`<style>\` block in the \`<head>\`. No external stylesheet files.
- Korean fonts: use \`Gowun Batang\` for display/headings and \`Noto Serif KR\` for body text. Load them with a Google Fonts \`@import\` at the top of the \`<style>\` block, and include serif fallbacks in every \`font-family\` declaration.
- Liturgical color theme: follow the color-theme hint given in the user message. Build a cohesive palette (header gradient, accents, highlight boxes) around it.
- Use these consistent component class names so documents stay visually consistent: \`.header\`, \`.key-verse\`, \`.toc\` (a sticky table of contents), \`.container\`, \`.info-card\`, \`.section\` with \`.sec-head\` / \`.sec-icon\` / \`.sec-title\`, \`.card\`, \`.order-table\` (with \`.ot-*\` cell classes), highlight boxes \`.hl\` / \`.hl-gold\` / \`.hl-rust\` / \`.hl-cream\` / \`.hl-dark\`, \`.bref\` (an inline Bible-reference chip), \`.key-quote\`, \`.pastor-box\`, \`.summary\` (with \`.sm-*\` items), \`.closing-prayer\`, \`.divider\`, \`.footer\`.
- Standard features: a gradient header; a sticky or anchored table of contents that links to each section; card layouts; Bible-verse boxes; pull-quote blocks; a numbered summary grid. Use sticky/animated effects sparingly and tastefully.
- Use the standard Korean (개역개정) Bible book names.

## Quality checklist — verify before you finish
- Every \`<div>\` is balanced (open/close counts match).
- The pastor's name renders as 김영복.
- Zero external \`<img src>\` references — images are base64 \`data:\` URIs or absent.
- All inputs are reflected; the handwritten-note emphases are clearly elevated.
- The sermon body is prose, not bullets; the numbered at-a-glance summary is present at the end.
- The order of service is rendered as a \`<table>\` if a 주보 photo was supplied.
- \`<html lang="ko">\` and the Korean fonts are in place.
- Mobile layout works: ~760px max width, sticky TOC, readable tap targets, comfortable line-height.
- The full closing prayer is included.

Output ONLY the HTML document.`;

/**
 * Translation system prompt. Static, prompt-cacheable.
 */
export const TRANSLATION_SYSTEM_PROMPT = `You are the translation engine for **Sermorizer**. You receive a complete, self-contained Korean HTML sermon-summary document and produce a faithful translation of it into a target language.

## Rules
- Translate EVERYTHING that a human reads: the title, headings, all prose, scripture quotations, every prayer (including the closing prayer in full), illustration cards, the at-a-glance summary, captions, and the footer. Leave nothing in Korean.
- Preserve the document's structure, layout, CSS, and class names EXACTLY. Only the human-readable text content changes. Do not redesign, reorder, add, or drop sections.
- Update the \`<html lang>\` attribute to the target language code (\`en\` or \`zh\`).
- Swap the fonts in the \`<style>\` block — both the Google Fonts \`@import\` and every \`font-family\` declaration:
  - English: \`Cormorant Garamond\` for display/headings + \`Crimson Pro\` for body.
  - Chinese (Simplified): \`Noto Serif SC\` for display/headings + \`Noto Sans SC\` for body.
  Keep appropriate serif fallbacks.
- Use the standard Bible book names for the target language — English ESV-style names, Chinese 和合本 names — and translate verse references accordingly.
- The senior pastor's name: render as "Rev. Kim Young-bok" in English, and "金永福主任牧师" in Chinese.
- Keep any Hebrew or Greek 原文 glyphs intact and untranslated.
- Keep all base64 \`data:\` URIs, CSS rules, and structural markup unchanged.
- Keep the tone warm, reverent, and appropriate for all ages.

Output ONLY the translated HTML document — it must begin with \`<!DOCTYPE html>\` and end with \`</html>\`. No preamble, no commentary, no markdown code fences.`;

/* ------------------------------------------------------------------ */
/* User-message builders                                              */
/* ------------------------------------------------------------------ */

export function buildGenerationUserContent(body: GenerationInput): ContentBlock[] {
  const m = body.metadata ?? {};
  const meta: string[] = [];
  meta.push("# Sermon materials for Sermorizer");
  meta.push("");
  const NOT_PROVIDED =
    "(not provided — read it from the order-of-service / 주보 photo if one is supplied, otherwise infer it from the transcript)";
  meta.push("## Sermon metadata");
  meta.push(`- Title: ${m.title?.trim() || NOT_PROVIDED}`);
  meta.push(`- Preacher: ${m.preacher?.trim() || "김영복 담임목사"}`);
  meta.push(`- Scripture: ${m.scripture?.trim() || NOT_PROVIDED}`);
  if (m.date?.trim()) meta.push(`- Service date: ${m.date.trim()}`);
  if (m.occasion?.trim()) meta.push(`- Occasion / liturgical season: ${m.occasion.trim()}`);
  if (m.serviceType?.trim()) meta.push(`- Service type: ${m.serviceType.trim()}`);
  meta.push("");
  meta.push("## Color theme");
  meta.push(themeHint(body.theme));

  const content: ContentBlock[] = [{ type: "text", text: meta.join("\n") }];

  const notes = body.noteImages ?? [];
  if (notes.length > 0) {
    content.push({
      type: "text",
      text: `## Listener's handwritten note (${notes.length} image${notes.length > 1 ? "s" : ""})\nOCR / transcribe the Korean handwriting in the image(s) below. Treat these notes as high-priority signal for which points mattered most to the listener, and elevate those points in the document.`,
    });
    for (const im of notes) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: im.media_type, data: im.data },
      });
    }
  } else {
    content.push({
      type: "text",
      text: "## Listener's handwritten note\n(No handwritten note image was provided. Work from the transcript alone.)",
    });
  }

  const bulletin = body.bulletinImages ?? [];
  if (bulletin.length > 0) {
    content.push({
      type: "text",
      text: `## Printed order of service / 주보 (${bulletin.length} image${bulletin.length > 1 ? "s" : ""})\nTranscribe the order of service in the image(s) below into a native HTML <table>. Do NOT embed the photo itself.`,
    });
    for (const im of bulletin) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: im.media_type, data: im.data },
      });
    }
  }

  content.push({
    type: "text",
    text:
      "## Recorded sermon transcript (Clova Note ASR output)\nThis is long, messy ASR output. Interpret it charitably, correct obvious mishearings, and never quote verbatim noise.\n\n" +
      (body.transcript ?? ""),
  });

  content.push({
    type: "text",
    text: "Now synthesize everything above into ONE complete, self-contained, mobile-friendly Korean HTML sermon-summary document, following every rule in your instructions. Output ONLY the HTML — begin with <!DOCTYPE html> and end with </html>. No code fences, no commentary.",
  });

  return content;
}

export function buildTranslationUserContent(
  language: "en" | "zh",
  sourceHtml: string,
): ContentBlock[] {
  const target = language === "en" ? "English" : "Simplified Chinese (简体中文)";
  return [
    {
      type: "text",
      text:
        `Translate the following Korean HTML sermon-summary document into ${target}. Follow every rule in your instructions: translate all human-readable text (including the closing prayer in full), preserve the structure, classes and design exactly, swap the fonts and the <html lang> attribute, and render the pastor's name correctly for the target language. Output ONLY the translated HTML document — no code fences, no commentary.\n\n` +
        `--- BEGIN KOREAN HTML ---\n${sourceHtml}\n--- END KOREAN HTML ---`,
    },
  ];
}
