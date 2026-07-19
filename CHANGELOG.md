# Changelog

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
