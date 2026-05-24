# CLAUDE.md — Sermorizer

> Project memory for Claude Code. Read this first in every session before writing code.

## What this project is

**Sermorizer** is a web app that turns weekly church sermon materials into a
single polished, mobile-friendly HTML summary document. The name is a blend of
"sermon" + "summarizer". The user is a layperson at **Galilee Church
(갈릴리교회)** in Dobong-gu, Seoul, who has been producing these documents by
hand with Claude for months. Sermorizer productizes that workflow.

**One-line goal:** upload three inputs → get one beautiful, self-contained,
mobile-optimized HTML sermon summary.

## The three inputs (always exactly these)

1. **Sermon metadata** — short structured fields the user types in:
   - `title` — the sermon title (e.g. "당연한 사랑은 없습니다")
   - `preacher` — who preached (default: 김영복 담임목사)
   - `scripture` — the Bible passage (e.g. "출애굽기 20:12")
   - Optional: service date, occasion/liturgical season, service type
2. **User's handwritten note** — uploaded as image(s) (JPG/PNG). The app must
   OCR/transcribe Korean handwriting. These are the user's own emphases and
   should be treated as high-priority signal for what mattered in the sermon.
3. **Recorded sermon transcript** — a `.txt` file (transcribed via Clova Note).
   Long: typically 400-800+ lines, ~60-80 min of speech. Messy ASR output with
   misheard words — interpret charitably, don't quote verbatim noise.

Optional fourth input seen in practice: a **photo of the printed order of
service (주보)**. If provided, use it ONLY to read sermon metadata (title,
preacher, scripture, date) — it is not included in the output.

## The output

A **single self-contained `.html` file**:

- Mobile-first, responsive, max content width ~760px.
- All CSS inline in one `<style>` block. **No external image dependencies.**
  If an image is essential (e.g. a map), embed it as a base64 data URI.
- Korean primary. The app must also be able to produce **English** and
  **Chinese (Simplified)** translations of the same document on request,
  preserving identical design/structure.
- Comprehensive prose, NOT bullet-point skeletons. The summary is the **sermon
  only** — the preached message: its scripture and exposition, introduction,
  main points and sub-points, illustrations, applications, and conclusion. Do
  NOT include other parts of the service (opening, prayers, liturgy, hymns,
  order of service, announcements, benediction).

## How to synthesize the three inputs (this is the core logic)

1. **Metadata** → header, key-verse block, info card, footer.
2. **Order of service photo** (if any) → used ONLY to read missing metadata
   (title, preacher, scripture, date). Never render it as a table or embed it;
   it must not appear in the output.
3. **Transcript** → the body, which is the sermon. Break the sermon into ~8-10
   thematic sections, each with a heading, prose summary, scripture boxes,
   illustration cards, and pull-quotes. Reconstruct the preacher's actual flow
   and examples. Ignore any non-sermon portions of the recording.
4. **Handwritten note** → cross-reference against the transcript. The note
   reveals which points the listener found most important — elevate those
   (pull-quotes, highlight boxes). Notes also catch things like exact poem
   names, dates, foreign-word glosses. If the note conflicts with the
   transcript (e.g. a wrong verse number), trust the transcript and silently
   correct.
5. End with a numbered "at a glance" summary (~10 points) of the sermon. (No
   closing prayer — sermon content only.)

## Non-negotiable rules

- **Pastor's name is `김영복` (Kim Young-bok).** NOT 김용복, NOT 김영범.
  This has been corrected many times. English: "Rev. Kim Young-bok".
  Chinese: "金永福主任牧师".
- **Sermon only.** The document contains the sermon and nothing else — no
  order of service, prayers, liturgy, hymns, announcements, or benediction.
- **Never bullet-point the sermon.** Full, warm prose. Bullets only for the
  final summary list.
- **Self-contained output.** No CDN images, no external file refs. Base64 only.
- **Content fidelity.** Theology, pastoral applications, and liturgical text
  must be preserved accurately. Don't invent content not in the sources.
- **Faithful translation.** When translating, translate everything including
  the closing prayer. Use standard Bible book names per target language
  (Korean 개역개정 / English ESV-style / Chinese 和合本). Keep Hebrew/Greek
  原文 glyphs intact. Swap fonts appropriately (see below). Update
  `<html lang>`.
- **Child-safety / tone:** this is church content for all ages — keep it warm,
  reverent, age-appropriate.

## Design system

The HTML uses a **liturgical color theme chosen per sermon/season**. Past themes:

| Occasion / book        | Theme                         |
|------------------------|-------------------------------|
| Ezra                   | rust / brown                  |
| 2 Corinthians 12:9     | blue                          |
| Lent / Palm Sunday     | deep purple                   |
| Easter                 | warm gold / amber             |
| John 4 (the well)      | teal                          |
| Children's Sunday      | green                         |
| Word/Bible seminar     | forest green / gold           |
| Parents' Day           | rose / carnation / gold       |
| Teachers' Sunday       | teal / gold                   |

Recurring component classes (keep names consistent across documents):
`.header`, `.key-verse`, `.toc` (sticky), `.container`, `.info-card`,
`.section` + `.sec-head`/`.sec-icon`/`.sec-title`, `.card`,
`.order-table` (+ `.ot-*`), highlight boxes `.hl` / `.hl-gold` / `.hl-rust` /
`.hl-cream` / `.hl-dark`, `.bref` (inline Bible reference chip),
`.key-quote`, `.pastor-box`, `.summary` (+ `.sm-*`), `.closing-prayer`,
`.divider`, `.footer`.

Standard features: gradient header, animated/sticky elements used sparingly,
collapsible or anchored sections, card layouts, Bible-verse boxes, quote
blocks, numbered summary grid.

### Fonts by language

- **Korean:** `Gowun Batang` (display) + `Noto Serif KR` (body).
- **English:** `Cormorant Garamond` (display) + `Crimson Pro` (body).
- **Chinese (Simplified):** `Noto Serif SC` + `Noto Sans SC`.

## File naming convention

`YYYY-MM-DD-<occasion>-<title>.html` for Korean, with a language suffix for
translations:

```
2026-05-17-스승의주일-스승의은혜.html              (Korean)
2026-05-17-Teachers-Sunday-Grace-of-My-Teacher-EN.html  (English)
2026-05-17-谢师主日-师恩-中文版.html               (Chinese)
```

When the user asks for a "new version" that removes elements, create a fresh
file (e.g. `-v2`), don't edit in place.

## Suggested tech stack for the web app

Nothing here is mandatory — pick what's simplest — but a sensible default:

- **Frontend:** a single-page app (plain HTML/JS or a light React build) with
  three input zones: a metadata form, an image dropzone for notes/bulletin,
  and a `.txt` upload for the transcript. A language selector (KO/EN/ZH).
- **Generation:** call the Anthropic Messages API (`claude-opus-4-7` for best
  quality on this long synthesis task). Send the transcript as text, the note
  image(s) as base64 `image` blocks, metadata as text. Ask the model to return
  one complete HTML document.
- **OCR of handwriting:** let the model read the note image directly — it
  handles Korean handwriting in-context; no separate OCR service needed.
- **Output:** render the returned HTML in a preview iframe + offer download.
- **Watch the context size:** transcripts are long. Keep the system prompt
  tight; the bulk of the budget goes to transcript + output HTML.

### Prompt design for the generation call

The system prompt should encode this whole file's "synthesize" logic and
"non-negotiable rules". The user message supplies the three inputs. Instruct
the model to output **only** the HTML document, no preamble, no markdown
fences. For translations, pass the already-generated Korean HTML and ask for a
structure-preserving translation with the font/lang swaps above.

## Quality checklist before returning a document

- [ ] `<div>` open/close counts balanced.
- [ ] Pastor name renders as 김영복 / Rev. Kim Young-bok / 金永福.
- [ ] Zero external image refs (`<img src>` is base64 or absent).
- [ ] All three inputs are reflected; handwritten-note emphases are elevated.
- [ ] Sermon is prose, not bullets; summary list present at the end.
- [ ] Document contains ONLY the sermon — no order of service, prayers,
      liturgy, hymns, or announcements.
- [ ] Correct `<html lang>` and fonts for the output language.
- [ ] Mobile layout: content ~760px max, sticky TOC, readable tap targets.
- [ ] (For translations) everything is fully translated, including the summary.

## Glossary

- **Sermorizer** — this app. Name = "sermon" + "summarizer".
- **갈릴리교회 / Galilee Church** — the church (Korean Methodist, 감리회).
- **주보** — printed weekly order of service / church bulletin.
- **Clova Note** — Naver's audio-to-text transcription tool; source of the
  transcript files.
- **담임목사** — senior pastor (김영복).
- **개역개정 / 和合본** — standard Korean / Chinese Bible translations.

## Implementation notes (this repo)

- Next.js (App Router) + TypeScript. Single-page UI at `app/page.tsx`.
- Generation endpoint: `app/api/generate/route.ts` — streams the HTML back.
  Handles both `mode: "generate"` (Korean) and `mode: "translate"` (EN/ZH).
- Prompts live in `lib/prompt.ts`; liturgical themes in `lib/themes.ts`.
- The Claude API key is read server-side from the `ANTHROPIC_API_KEY`
  environment variable. It is never exposed to the browser.
- Note/bulletin images are downscaled in the browser before upload to keep
  request payloads within platform limits.
