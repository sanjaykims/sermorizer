# Sermorizer

Turns a week of church sermon materials into **one polished, self-contained,
mobile-friendly HTML summary document**. Built for a layperson at Galilee
Church (갈릴리교회) in Dobong-gu, Seoul.

Upload three things → get one beautiful HTML file:

1. **Sermon metadata** — title, preacher, scripture (+ optional date / occasion / service type)
2. **Handwritten note** — photo(s) of your notes; the app OCRs the Korean handwriting
3. **Recorded sermon transcript** — a `.txt` file (e.g. from Clova Note)

Optional: a photo of the printed order of service (주보) → rendered as an HTML table.

The Korean document can be translated into **English** and **Simplified Chinese**
on demand, preserving the design.

## Stack

- Next.js (App Router) + TypeScript
- Anthropic Messages API — `claude-opus-4-7`, streamed
- The note/bulletin images and the transcript are sent to the model; it returns
  one complete HTML document.

## Setup

```bash
npm install
cp .env.example .env.local      # then put your real ANTHROPIC_API_KEY in it
npm run dev
```

Open http://localhost:3000.

## Environment

| Variable            | Required | Purpose                                              |
| ------------------- | -------- | ---------------------------------------------------- |
| `ANTHROPIC_API_KEY` | yes      | Server-side Claude API key. Never exposed to browser. |

## Deploy (Vercel)

Push the repo, import it into Vercel, and set `ANTHROPIC_API_KEY` in the
project's Environment Variables. The generation route is configured with a
300-second `maxDuration` because synthesizing a long transcript takes time.

## How it works

- `app/page.tsx` — the single-page UI: metadata form, image dropzones,
  transcript upload, theme picker, live preview, download, translate.
- `app/api/generate/route.ts` — streams the generated HTML back. Handles both
  `mode: "generate"` (Korean) and `mode: "translate"` (EN/ZH).
- `lib/prompt.ts` — the system prompts (which encode the synthesis logic and
  non-negotiable rules) and the user-message builders.
- `lib/themes.ts` — the liturgical color themes.

See `CLAUDE.md` for the full product spec and rules.
