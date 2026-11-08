# Changelog

## Fixes — 2026-11-08 (structural validator)

The repair pass earlier today left all three documents malformed, and the
verification missed it: the key verse held an orphan `</blockquote>` whose
opening tag had been unwrapped, and a later section's `<blockquote>` was never
closed because the lift that moved its reference out consumed the closing tag.

**The faults had EQUAL opening and closing counts — 4 and 4.** Only the order
was wrong, so a balance check reported the documents clean. A reader found them
instead, which is the worst way for this to surface. All three are now
corrected and validated by tag order (`OCOCOCOC`) and nesting depth rather than
by counting.

`lib/html-structure.ts` turns that lesson into a check the repo keeps:
`findStructuralProblems()` walks the depth of `<div>`, `<section>` and
`<blockquote>` through the body — depth must never go negative and must end at
zero — and also verifies that the `.sec-icon` badges agree with the section ids.
The generate route runs it on every finished document, single-call and stitched,
and **logs what it finds without discarding anything**: a readable summary with
a cosmetic fault is worth far more to the reader than no summary, and these
faults are repairable after the fact.

Covered by `lib/__tests__/html-structure.test.ts`, including a case that asserts
the opening and closing counts are equal and that the checker fails it anyway —
the precise blind spot that let this reach the documents.

## Hardening — 2026-11-08

Follow-up to the review fixes below: every remaining finding that could recur
on the next sermon is now prevented in code, not just corrected in the three
stored documents.

- **The at-a-glance list stops echoing the headings.** For a split sermon the
  stitcher builds that list, and it had nothing to build from but the section
  titles — so the summary repeated the eleven headings already in the tab bar.
  The split-part prompt now asks each `<section>` for a `data-takeaway`
  attribute holding one real takeaway sentence, and both stitchers prefer it,
  falling back to the heading so a part that omits it still yields a card.
  A test pins the prompt↔stitcher coupling, which is invisible to the type
  checker: if the prompt ever stops asking for the attribute, every split
  sermon would quietly revert to heading-echo summaries.

- **Parts are told not to guess their own numbering.** Each part numbered its
  sections from its own start, which is what produced the mismatched badges.
  The prompt now says to number from 1 within the part and that the app
  renumbers across the whole sermon on stitch.

- **Box-inside-a-box is defended twice.** Both prompts forbid nesting a
  `<blockquote>` inside `.key-verse`, and the injected stylesheet now flattens
  any quote wrapper that lands there anyway (`border`/`background`/`padding`
  stripped). The documents are model-generated, so the CSS has to survive
  markup the prompt asked against — the same posture as the `.hl` rules.

- **One scripture-reference form.** Both prompts fix it as a `<p class="bref">`
  on its own line after the `</blockquote>`, never inside the quote, with an en
  dash in ranges (`4:6–7`, not `4:6~7`). The stylesheet also renders a chip
  left inside a quote on its own line, so the two forms look alike.

- **An emphasis budget.** About one `.key-quote` every other section and one or
  two highlighter marks per section, with the reason stated: if nearly every
  paragraph is marked, none of them reads as emphasis.

- **Two content rules for a written record.** Sweeping claims, numbers the
  passage does not give, and images carried in from another book must read as
  the preacher's own ("목사님은 … 강조하셨습니다"), not as statements of the
  text — the Joshua 5 interval and the Revelation 2:5 lampstand are given as
  worked examples. And a spoken aside that lands warmly out loud can read as an
  insult on the page, so it must be recast to include the speaker and reader,
  or dropped.

Checklists in both prompts gained matching lines, so the model verifies these
itself before returning a document.

## Fixes — 2026-11-08

A review of the 2026-11-08 summary ("감사의 기념비", 여호수아 4:1–7) found defects
that were present identically in the Korean, English and Chinese documents —
translation preserves structure, so every structural fault in the Korean was
inherited by both translations. All three were corrected in place (the
pre-edit documents are kept in `public._summary_doc_backup`).

**Two were app bugs, now fixed at the source in both stitchers:**

- **Section badges were never renumbered after a split.** `stitchPartsServer`
  (and the client's `stitchParts`) renumbered each section's `id` but left the
  visible `.sec-icon` alone. Each generated part numbers its own sections from
  its own start, so a two-part sermon shipped with ids `sec-1..sec-11` while the
  badges read `1,2,3,4,5,6,4,5,6,7,8` — the page contradicted its own tab bar
  and at-a-glance list. Both stitchers now renumber the badge alongside the id,
  and only when it already holds a plain number, so a `★` or emoji icon is left
  alone.
- **No divider at the seam between parts.** Parts were concatenated directly, so
  the one place two parts met was the only section boundary in the document
  without a rule. Both stitchers now insert the divider at the join.

Covered by `lib/__tests__/stitch.test.ts`; the badge test fails with
`['1','2','1','2','★']` if the renumbering regresses.

**Corrected in the three stored documents only** (generation-time wording, not
code): the redundant `<blockquote>` nested inside `.key-verse`, which rendered
the key verse as a box inside a box; and scripture references given three
different ways (a `<p class="bref">` after the quote, a `<span class="bref">`
inside it, en dash vs tilde) — all five now use one form.

**Four claims reframed as the preacher's own**, preserving his words while
making the attribution honest: the "겨우 6일" between the memorial and Jericho
(Joshua 5 places the circumcision and the Passover in between); the lampstand
being removed, whose language is Revelation 2:5 about Ephesus, not a statement
of the Saul narrative; the absolute "성경 전체에서 … 단 하나도 없습니다"; and a
spoken self-deprecating aside that read as an insult in print.

**The at-a-glance summary now summarises.** It had been repeating the eleven
section headings already shown in the tab bar; each entry is now a takeaway
line. Note this is a stitcher limitation for split sermons — `stitchPartsServer`
builds that list from section titles because it has no model access — so a long
sermon will keep producing heading-echo summaries until the split-part prompt
is asked for takeaway lines. Tracked, not yet fixed.

**Two review findings were false positives** and deliberately not "fixed": the
`<div>` imbalance (the two unmatched `<div` are inside a CSS comment in the
injected stylesheet; the body is balanced 64/64), and the "placeholder"
filename (`slug()` does not strip non-ASCII — the app emits
`2026-11-08-sunday-service-감사의-기념비.html`; the `___-___` came from the chat
upload sanitiser replacing each Hangul character).

Left alone as editorial judgement rather than error: the number of pull quotes
and highlighter marks, the length of the tab-bar labels, and where the passage
first appears.

## Model — 2026-10-18

- **Summaries are now generated by Claude Opus 5.5** (`claude-opus-5-5`), up
  from Opus 5. The `ANTHROPIC_MODEL` env override still works as the emergency
  escape hatch.

- **Thinking is no longer disabled — because it can no longer be disabled.**
  This is the one breaking change in the upgrade, and it undoes the setting the
  2026-08-09 entry below calls load-bearing. On Opus 5.5 thinking is *always
  on*: `thinking: {type: "disabled"}` (and the `budget_tokens` form) returns a
  400 at **every** effort level, so the explicit disable had to be removed
  outright. Omitting the field is equivalent to `{type: "adaptive"}`.

- **Effort is now the only control, and it is set to `low`.** The two budgets
  this service is calibrated around did not change: `max_tokens` still caps
  thinking **and** the response together, and `maxDuration = 300` is still a
  hard Vercel ceiling. With thinking no longer switchable off, effort is the
  only lever left over how much of both it consumes, so the generation default
  drops from `medium` to `low` — the migration guide's prescribed path for a
  route coming off disabled thinking. Per Anthropic's testing Opus 5.5 at `low`
  lands near Opus 5 at `high` on comparable work, so this is not expected to
  cost quality. Note the API default also moved (`medium` on 5.5, `high` on 5),
  which is why the value is set explicitly rather than inherited.

  `max_tokens` is deliberately **not** raised to make room for the thinking.
  That cap is bounded by *time*, not token appetite: 20,000 tokens ≈ 280-330s
  against a 300s ceiling, so raising it would only convert a clean truncation
  (detectable `stop_reason`, fails loudly) into the function being killed
  mid-flight. If documents ever start truncating, the lever is less thinking or
  a split job — never a bigger cap.

- **Cheaper, and the cost panel now reflects it.** Opus 5.5 is $4 / $20 per
  MTok against Opus 5's $5 / $25, so `lib/pricing.ts` changed for the first
  time in this project's life. Cache write is $5.00 (1.25x input, 5-minute
  TTL). **Cache read is $0.20 — 0.05x input, not the 0.1x that applies to most
  models** (it was $0.50 on Opus 5); it is read off the pricing table rather
  than derived, and `lib/__tests__/pricing.test.ts` now pins all four rates so
  a future model swap can't silently re-derive the odd one wrongly.

- **Budgets re-derived for the new model, against production data.** With
  thinking sharing the output budget, each per-call cap was re-checked rather
  than carried over. Measured across the last 8 summaries: Korean documents run
  19.8k-27.3k chars and one generate call emits ~10-13k output tokens, so the
  split-part (14000), translation (12000, per 9,000-char chunk) and proofread
  (16000, per <=6,000-char transcript) caps all keep ample headroom and are
  unchanged.

  The single-call generate cap did change: **20000 -> 17000**. That cap exists
  so a runaway run truncates with a detectable `stop_reason` *inside*
  maxDuration=300, instead of the function being killed with the row stuck in
  'generating'. At ~60-70 output tok/s, 20000 tokens is ~285-330s — past the
  ceiling, so the invariant the comment claimed did not actually hold. It was
  survivable only because nothing reached the cap while thinking was off; now
  that thinking shares the budget the cap is reachable, so it moves to 17000
  (~240-285s, inside the wall) while still leaving ~4-7k of thinking headroom
  above the measured document size.

- **The request body is now compiler-verified instead of cast away.** The call
  site passed its params through `as Parameters<typeof client.messages.stream>[0]`,
  which silenced type checking on the *entire* request — exactly the surface a
  model migration changes. Removing the cast showed the only real mismatch was
  our own `ImagePayload.media_type: string` against the SDK's closed union; the
  new `output_config.effort` shape and the absent `thinking` field both check
  out clean. `media_type` is now a narrow `MediaType` union, so TypeScript
  validates model, budgets, effort, cached system prompt and image blocks
  against the SDK's current schema on every build.

  A union proves nothing at runtime, though — request bodies arrive as JSON —
  so the route now guards every attachment with `isSupportedMediaType` and
  returns a 415 naming the offending format. Previously an iPhone `image/heic`
  would have travelled to the Messages API and come back a 400 that identified
  no attachment. Covered by `lib/__tests__/prompt.test.ts`.

- Not applicable to this service, but part of the same upgrade: forced
  `tool_choice` now 400s (this app declares no tools), thinking blocks are tied
  to the producing model and conversation (every call here is single-shot and
  replays no assistant turns), and computer use needs the new toolset. The
  response reader already filters by block `type` rather than position, so the
  `thinking` blocks that now precede the text need no change.

## Fixes — 2026-08-22

- **Generated summaries were being silently discarded.** A sermon could finish
  generating and then vanish: the history row appeared tagged `no file`, with
  `status='done'`, `error=NULL`, and an empty `docs` — no error surfaced
  anywhere, though `usage` showed Claude had returned a full document.

  Two changes had quietly combined. `claimPendingSummaryServer` creates the row
  before the model runs, and since it delegates to `insertSummaryServer` — whose
  status defaults to `'done'` — a fresh row was born `'done'` instead of
  `'generating'` (the explicit `status: "generating"` argument was dropped on
  2026-06-28 when the three call sites moved to the reclaim helper, which has no
  `status` field). Harmless on its own; the finalize UPDATE was unfenced then.
  On 2026-07-12 that UPDATE gained a compare-and-set (`status='generating' AND
  gen_token=…`), and the two met: the finalize matched **zero rows**, returned
  `won = false`, and the caller used that result only to decide whether to send
  a push. The finished HTML was dropped with no throw and no log. The failure
  path was locked too — `markSummaryErrorServer` is guarded by
  `status <> 'done'` — so the row could neither succeed nor fail.

  `pg_stat_statements` confirms the scope: all **9** executions of the fenced
  finalize since 2026-07-12 ran in 0.022–0.043 ms (versus 1.4–15.3 ms for the
  unfenced variant that demonstrably stored 40–50 KB documents) — the signature
  of an index probe matching nothing. It had never once stored a document.

  It stayed hidden because long sermons dodge it. Over 12,000 characters the
  client splits the job and, when the server fails to finalize, stitches the
  parts itself and writes them with an *unconditional* update. Every sermon
  until now ran 60–80 minutes and took that path. A 21-minute recording
  (7,995 chars) fell under the threshold onto the single-call path — the one
  route with no client-side rescue — and was lost.

  Fixed in `claimPendingSummaryServer`: a fresh row now starts at `'generating'`.
  `finalizeSummaryIfGeneratingServer` additionally logs an error when it matches
  no row *and* the summary is still empty, so a discarded document can never
  again pass silently — losing the compare-and-set is normal only when a sibling
  worker already stored the document. Covered by `lib/__tests__/
  summaries-server.test.ts`, which fails if the status default regresses.

## Fixes — 2026-08-16

- **PDF handwritten notes actually work now.** The uploader already accepted
  PDFs and the API already sent them as Claude `document` blocks, but the path
  was broken in practice: the PDF went up raw with no downscaling, base64
  inflates a file by ~33%, and Vercel rejects any request body over 4.5 MB — so
  a phone-scanned note PDF (routinely 5-15 MB) was rejected by the platform
  before it ever reached the app, with no useful error. Photos were unaffected
  because they are downscaled to 2048px / q0.85 first.

  Note PDFs are now rasterized in the browser (pdf.js, dynamically imported so
  it stays out of the initial bundle; its worker is bundled same-origin to
  satisfy `worker-src 'self'`). Each page is rendered at the target resolution,
  flattened onto white, and downscaled through the same code as a photo — the
  proven OCR path. **File size no longer matters; page count does** (max 8,
  matching `MAX_IMAGES` on the generate route), and a PDF plus photos that
  together exceed 8 pages is reported in the uploader's own terms instead of as
  a server-side "too many images".

## Model — 2026-08-09

- **Summaries are now generated by Claude Opus 5** (`claude-opus-5`), up from
  Opus 4.8. Same price ($5 / $25 per MTok), so `lib/pricing.ts` is unchanged.
  The `ANTHROPIC_MODEL` env override still works as the emergency escape hatch.
- **Thinking is now explicitly disabled** (`thinking: {type: "disabled"}`) — a
  required part of the upgrade, not a leftover. On Opus 5 the default flipped:
  omitting `thinking` runs *adaptive* thinking, where on Opus 4.8 it meant none.
  Left on, it would have broken two things this service is calibrated around:
  `max_tokens` caps thinking **and** response together, so thinking would eat
  the 20,000-token budget the HTML document needs (truncating it), and the added
  thinking time would push past the hard `maxDuration = 300` ceiling.
  Disabling requires effort ≤ `high`; the `effort` option stays typed to
  `low | medium | high` so it can never be paired with `xhigh`/`max` (a 400).
- **Guarded against internal-tag leakage.** With thinking disabled, Opus 5 can
  occasionally emit internal XML tags into the visible response — which here
  would land inside a stored HTML document. Every prompt that produces output
  (generation, split-part, translation, proofreading) now ends with a generic
  instruction to emit no internal or system XML tags.

## Fixes — 2026-08-09

- **Church vocabulary is no longer mangled by the ASR.** Clova Note transcribed
  the 2026-08-09 sermon's **총동원 전도주일** (all-church evangelism Sunday) as
  **청정원** — a supermarket food brand — and it reached all three language
  versions. A new `CHURCH_GLOSSARY` (`lib/prompt.ts`) lists the church terms the
  ASR reliably garbles (총동원 전도주일, 출정예배, 속회, 감리회, service names,
  church offices, 개역개정 book names) plus a general rule: when the transcript
  yields a brand name, a celebrity's name, or nonsense where a Korean church
  term is obviously meant, choose the church term.

  The glossary is injected into the **generation**, **split-part**, AND
  **proofreading** prompts — not just the proofreader, which is optional and
  **off by default** and so would have missed this run entirely.

  The 2026-08-09 Korean, English, and Chinese summaries were corrected
  (청정원 → 총동원 / All-Church Mobilization / 总动员).

## Fixes — 2026-07-19

- **Inline highlighter marks no longer overlap surrounding lines.** The `.hl` /
  `.hl-gold` / `.hl-dark` emphasis spans were rendering as block-like boxes that
  bled over adjacent text on the phone; they are now forced inline with
  `box-decoration-break: clone`, so a mark stays on its own words across line
  wraps. The generation prompt also limits each mark to a short phrase (a whole
  emphasized sentence becomes a `.key-quote`). Fixed in the injected stylesheet,
  so it applies to Korean, English, and Chinese alike.
- **Translations read as natural target-language prose, not calques.** The
  translation prompt (`lib/prompt.ts`) now requires idiomatic, grammatically
  correct English / Chinese — recasting Korean sentence shapes (fronted
  adverbials, topic–comment order, comparatives like "~보다 훨씬 더") into the
  target language's own grammar instead of mirroring Korean word order. This
  fixes stranded-comparative output such as "Far more than you yourself know,
  you are a precious person." → "You are far more precious than you know." The
  2026-07-19 English and Chinese summaries were corrected to match.

## Hearth design system — 2026-07-18

Adopted the **Hearth design system** (a warm editorial-tech system: warm-oat
paper, one signal-orange accent used as a highlighter, a Newsreader + Geist +
Geist Mono type pairing, flat hairline surfaces, restrained radii, quiet
tokenized motion, full focus-visible / ≥44px interaction coverage) across the
whole product, and embedded a Korean serif so Hangul pairs with the Latin
faces. Shipped to production (`sermorizer.vercel.app`).

### App shell
- **Fonts:** Newsreader (display) + Geist (body/UI) + Geist Mono (data/labels),
  self-hosted via `next/font`. **Nanum Myeongjo** (한글 세리프) pairs with
  Newsreader and **Noto Sans KR** with Geist for all Hangul; both load the full
  unicode-range-split Korean faces (`preload:false`, no `subsets`).
- **`app/globals.css`:** full rewrite to Hearth tokens (OKLCH warm-oat paper,
  one signal-orange accent, hairline borders, restrained radii, named motion,
  focus-visible rings). Every surface — panels, forms, underline tabs, status
  callouts, history/cost/import/book panels, auth screens, session bar — plus
  the photographic Sermon-on-the-Mount hero (kept, re-typed).
- **`app/AuthGate.tsx`:** replaced the gilt corner/crest ornaments with a single
  Hearth mark. Icon, manifest, and theme-color reskinned to warm-ink + oat +
  signal-orange.
- Accessibility: darkened the muted text token, moved link/CTA/status colours to
  AA-safe pairings, lifted small controls to the 44px hit-target floor.

### Generated sermon summaries
- Summaries now use the same Hearth system instead of the old parchment /
  drop-cap / fleuron / gradient illuminated-manuscript style.
- **Architecture:** the app injects one complete Hearth stylesheet
  (`lib/enhance.ts`) into every document; the model outputs only semantic HTML
  with the standard component classes plus one required `:root` palette line —
  no CSS of its own. Reliably on-system and directly verifiable.
- **Colour is per-sermon**, not fixed white: each summary picks the fitting
  colour for its occasion/season (Lent → purple, Easter → gold, Ezra → rust,
  ordinary → warm oat + signal orange, …). The whole palette derives from four
  variables the model echoes — `--doc-paper` / `--doc-ink` / `--doc-accent` /
  `--doc-accent-strong` — via `color-mix`. `lib/themes.ts` maps seasons to
  palettes; "auto" lets the model choose from the sermon itself.
- Translations (`lib/translate-split.ts`) swap the pairing deterministically:
  English → Newsreader/Geist, Chinese → Noto Serif SC/Noto Sans SC.

### Notes
- Existing (already-generated) summaries keep their prior look — the design is
  baked in at generation time; new summaries use Hearth.
- The generated documents are the sermon only; all content rules are unchanged
  (pastor name 김영복, prose not bullets, self-contained, faithful translation).
