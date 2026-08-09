# CLAUDE.md — Sermorizer

> Project memory for Claude Code. Read this first in every session before writing code.

## Graphify First

This repo commits a Graphify snapshot in `graphify-out/`.

**Mandatory rule for future development:** Codex, Claude, Antigravity, and any
other coding agent must use Graphify before broad source exploration or making
a development plan. Start from the graph for codebase questions, architecture
work, impact analysis, "where is X?" exploration, and any non-trivial repo
change. Only skip this if `graphify-out/graph.json` is absent/broken or the
user explicitly says not to use Graphify.

If `graphify` is not already on PATH, install it in a temp venv:

```bash
GRAPHIFY_VENV="${TMPDIR:-/tmp}/graphify-sermorizer-venv"
python3.14 -m venv "$GRAPHIFY_VENV"
"$GRAPHIFY_VENV/bin/python" -m pip install --upgrade pip graphifyy==0.9.26
export PATH="$GRAPHIFY_VENV/bin:$PATH"
```

Rules:

- Start each development session by running a focused
  `graphify query "<question>"` when `graphify-out/graph.json` exists.
- Use `graphify explain "<node>"` for a focused concept and
  `graphify path "<A>" "<B>"` for relationships between two parts of the app.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or
  when query/path/explain do not return enough context.
- After modifying code, refresh the snapshot with:

```bash
graphify extract . --code-only --out .
graphify cluster-only . --graph graphify-out/graph.json --no-label
graphify tree --graph graphify-out/graph.json --output graphify-out/GRAPH_TREE.html --root . --label Sermorizer
```

Dirty `graphify-out/` files are expected after code changes; keep them in the
same commit when the graph changed.

## What this project is

**Sermorizer** is a web app that turns weekly church sermon materials into a
single polished, mobile-friendly HTML summary document. The name is a blend of
"sermon" + "summarizer". The user is a layperson at **Galilee Church
(갈릴리교회)** in Dobong-gu, Seoul, who has been producing these documents by
hand with Claude for months. Sermorizer productizes that workflow.

**One-line goal:** upload three inputs → get one beautiful, self-contained,
mobile-optimized HTML sermon summary.

## Minimum inputs

Sermorizer must be able to generate a summary from only:

1. **Recorded sermon transcript** — a `.txt` file (transcribed via Clova Note).
   Long: typically 400-800+ lines, ~60-80 min of speech. Messy ASR output with
   misheard words — interpret charitably, don't quote verbatim noise.
2. **Service date / time** — the date and time of the sermon.
3. **Preacher** — who preached (default: 김영복 담임목사).

Optional helpful inputs:

- `title` — the sermon title (e.g. "당연한 사랑은 없습니다")
- `scripture` — the Bible passage (e.g. "출애굽기 20:12")
- Occasion/liturgical season and service type
- **User's handwritten note** — uploaded as image(s) or PDF. The app OCRs /
  transcribes Korean handwriting. These are the user's own emphases and should
  be treated as high-priority signal when supplied, but the app must still work
  without them.

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
4. **Handwritten note** → when supplied, cross-reference against the transcript. The note
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

Generated summaries use the **Hearth design system** — the same warm
editorial-tech system as the app shell: flat surfaces (never colour-*blocks*),
hairline borders, restrained radii, a Newsreader + Geist + Geist Mono type
pairing (with Nanum Myeongjo / Noto Sans KR for Hangul), and quiet craft. **The
app supplies the entire stylesheet** — `lib/enhance.ts` (`ENHANCE_LAYOUT_CSS`)
is injected into every document; the model outputs only semantic HTML with the
standard component classes (plus one required `:root` palette line) and writes
no CSS of its own.

**Colour is per-sermon** — each summary still "picks the right colour" for its
occasion/season (Lent → purple, Easter → gold, Ezra → rust, John 4 → teal,
Children's → green, ordinary → warm oat + signal orange, …), NOT a fixed
white/oat every time. The whole palette is driven by four CSS variables the
model echoes for the sermon — `--doc-paper` (a light, warm-tinted page, never
pure `#fff`), `--doc-ink` (near-black warm text), `--doc-accent` (the single
highlighter), `--doc-accent-strong` (its darker AA-safe shade) — and the
injected stylesheet derives every card/border/tint/wash from them via
`color-mix`. The season → colour choices live in `lib/themes.ts` (`themeHint`);
"auto" lets the model choose from the sermon itself.

Recurring component classes (keep names consistent across documents):
`.header` (with `.h-title`), `.key-verse` (+ `.ref`), `.toc` (sticky tab bar),
`.info-card`, `.section` + `.sec-head`/`.sec-icon`/`.sec-title`, `.card`,
`<blockquote>` for scripture, highlight boxes `.hl` / `.hl-gold` / `.hl-dark`,
`.bref` (inline Bible reference chip), `.key-quote`, `.pastor-box`,
`.summary` (+ `.sm-grid`/`.sm-item`/`.sm-num`/`.sm-text`), `.divider`,
`.footer`. (No `.order-table` / `.closing-prayer` — the output is the sermon
only.) No parchment texture, drop caps, fleurons, or gradient headers — flat,
clean, phone-first.

### Fonts by language

All served via one Google-Fonts `@import` in the injected stylesheet (the one
permitted external reference); translations swap the pairing deterministically
in `lib/translate-split.ts`.

- **Korean:** `Newsreader` + `Nanum Myeongjo` (display) / `Geist` +
  `Noto Sans KR` (body) / `Geist Mono` (labels, data).
- **English:** `Newsreader` (display) + `Geist` (body) + `Geist Mono`.
- **Chinese (Simplified):** `Noto Serif SC` + `Noto Sans SC` (with
  Newsreader / Geist / Geist Mono for Latin & data).

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
- **Generation:** call the Anthropic Messages API (`claude-opus-4-8` for best
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
- **총동원 전도주일** — the all-church evangelism outreach Sunday. Clova Note
  reliably mishears it as **청정원** (a food brand) — never let that reach a
  document. English: "All-Church Mobilization Evangelism Sunday"; Chinese:
  "总动员传道主日".
- **출정예배** — the commissioning/sending service held before an outreach.

Church vocabulary the ASR garbles lives in one place — `CHURCH_GLOSSARY` in
`lib/prompt.ts`, which is injected into the generation, split-part, AND
proofreading prompts (the proofreading pass is optional and off by default, so
a glossary that only reached it would miss most runs). Add new terms there.

## Implementation notes (this repo)

## Trust model (single-user)

Sermorizer is a private, single-user app — exactly one person (the Galilee
Church layperson) ever authenticates. That shapes several intentional choices
that would be wrong for a multi-tenant SaaS:

- **Stored HTML is trusted only because the only writer is the authenticated
  owner.** Generated documents come straight from Claude; imported documents
  come from the owner's local folder. Neither is sanitized server-side. The
  preview iframe uses `sandbox=""` (no scripts, no same-origin) so even a
  malicious document can't run code in the app's origin.
- **Web Push fans out to every enrolled device** — that's the desired behavior
  (phone + tablet both ring). If this app ever became multi-user, the
  `push_subscriptions` table would need an `owner_id` column and the fan-out
  would need to filter on it (see `lib/push.ts`).
- **The Supabase project URL is hard-coded** as a single-tenant default;
  forks override `NEXT_PUBLIC_SUPABASE_URL`.
- **Passcode recovery is manual.** If the only owner forgets the passcode and
  has lost every enrolled passkey, the only recovery is direct DB access:
  `update public.auth_config set passcode_hash = null, passcode_salt = null
  where id = 'singleton';` then complete first-run setup again.

- Generation endpoint: `app/api/generate/route.ts` — streams the HTML back.
  Handles both `mode: "generate"` (Korean) and `mode: "translate"` (EN/ZH).
- Prompts live in `lib/prompt.ts`; liturgical themes in `lib/themes.ts`.
- The Claude API key is read server-side from the `ANTHROPIC_API_KEY`
  environment variable. It is never exposed to the browser.
- Note/bulletin images are downscaled in the browser before upload to keep
  request payloads within platform limits.
