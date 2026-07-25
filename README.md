# Sermorizer

Turns a week of church sermon materials into **one polished, self-contained,
mobile-friendly HTML summary document**. Built for a layperson at Galilee
Church (갈릴리교회) in Dobong-gu, Seoul.

Upload the core sermon text plus a little context → get one beautiful HTML file:

1. **Recorded sermon transcript** — a `.txt` file (e.g. from Clova Note); this is the core input.
2. **Service date / time** — the date and time of the sermon.
3. **Preacher** — who preached (default: 김영복 담임목사).

Optional but helpful: sermon title, scripture passage, occasion / service type,
and photo(s) or a PDF of handwritten notes. If title or scripture are blank, the
app asks Claude to infer them from the transcript.

Optional: a photo of the printed order of service (주보) → used only to fill in
missing sermon metadata; it is not reproduced in the summary.

The Korean document can be translated into **English** and **Simplified Chinese**
on demand, preserving the design.

## Stack

- Next.js (App Router) + TypeScript
- Anthropic Messages API — `claude-opus-4-8`, streamed
- The transcript plus any optional note/bulletin images are sent to the model;
  it returns one complete HTML document.

## Setup

```bash
npm install
cp .env.example .env.local      # fill in at minimum ANTHROPIC_API_KEY + SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

Open http://localhost:3000.

## Environment

| Variable                       | Required           | Purpose                                                                 |
| ------------------------------ | ------------------ | ----------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`            | yes                | Server-side Claude API key. Never exposed to browser.                   |
| `ANTHROPIC_MODEL`              | no                 | Emergency override for the model. Defaults to `claude-opus-4-8`; set only if that model is retired/renamed. |
| `SUPABASE_SERVICE_ROLE_KEY`    | yes                | Server-side Supabase admin key. All DB access is brokered through API routes. |
| `NEXT_PUBLIC_SUPABASE_URL`     | for forks / dev    | Override the baked-in Sermorizer Supabase project URL.                  |
| `VAPID_PRIVATE_KEY`            | for push           | Web Push private key. Without it, push is a graceful no-op (in-app chime still fires). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | if you rotate keys | Override the baked-in VAPID public key. Generate a pair via `node -e "console.log(require('web-push').generateVAPIDKeys())"`. |
| `VAPID_SUBJECT`                | for push           | Contact `mailto:` URL associated with the VAPID keys.                   |

### Supabase schema

The app expects the Sermorizer schema applied via the migrations in this repo's
history. Tables: `summaries`, `auth_config`, `passkeys`, `push_subscriptions`,
`auth_attempts`. RPCs: `merge_summary_part`, `merge_proofread_part`,
`merge_summary_doc`, `add_summary_usage`, `bump_auth_attempt`,
`clear_auth_attempt`. RLS is on for every table; access is brokered exclusively
by the service-role server.

## Scripts

```bash
npm run dev        # local dev server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # flat-config ESLint over the whole tree
npm run typecheck  # tsc --noEmit
npm run test       # Vitest unit tests for the pure helpers
```

## Deploy (Vercel)

Push the repo, import it into Vercel, and set the Environment Variables in the
table above. The generation route is configured with a 300-second `maxDuration`
because synthesizing a long transcript takes time.

## How it works

- `app/page.tsx` — the single-page UI: metadata form, optional image dropzones,
  transcript upload, theme picker, live preview, download, translate.
- `app/api/generate/route.ts` — streams the generated HTML back. Handles both
  `mode: "generate"` (Korean) and `mode: "translate"` (EN/ZH).
- `lib/prompt.ts` — the system prompts (which encode the synthesis logic and
  non-negotiable rules) and the user-message builders.
- `lib/themes.ts` — the liturgical color themes.

See `CLAUDE.md` for the full product spec and rules.
