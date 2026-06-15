# Later — deferred, non-blocking

Frozen at the end of the 2026-06 review loop (8-agent internal review + two
Codex rounds). Everything here is **intentionally deferred** — none of it
blocks real use. Pull from this list only when there's a concrete reason, not
to keep polishing. New work should be driven by **real user-workflow pain**,
not reviewer imagination.

## The list

1. **Paged.js supply chain.** The book popup loads `paged.polyfill.js` from
   unpkg without an SRI hash. Either add an `integrity=` hash pinned to a
   verified version, or vendor the file locally under `public/`. Low impact:
   the popup runs at an opaque blob origin and the feature is user-initiated.
   (`lib/book-css.ts` → `BOOK_SCRIPTS`.)

2. **Extract `app/page.tsx` (~1500 lines).** Pull out `HistoryPanel`,
   `MetadataForm`, `PreviewPanel`, and `runSplitGeneration` to get it to ~400
   lines. Pure refactor, no behavior change — but do it in an **interactive QA
   session**, running a real sermon end-to-end after each extraction. Not worth
   doing blind.

3. **Multi-user boundaries.** Only if Sermorizer ever actually becomes
   multi-user. Then: add `owner_id` to `summaries`, `push_subscriptions`,
   `auth_config`/`passkeys`; filter the push fan-out (`lib/push.ts`);
   re-introduce RLS policies keyed on owner; sanitize imported/generated HTML
   server-side rather than relying on the single-owner trust model. See the
   "Trust model (single-user)" section in `CLAUDE.md`.

## Quality gate — keep green before every meaningful change

```
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run test        # vitest run
npm run build       # next build
```
