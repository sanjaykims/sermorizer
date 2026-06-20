export type Palette = {
  /** page background / parchment */
  paper: string;
  /** primary body text */
  ink: string;
  /** brand accent — header gradient start, section headings, links */
  brand: string;
  /** deep brand — gradient end, hovers, strong emphasis */
  brandDeep: string;
  /** gilt — key verse, current TOC tab, summary medallions (use sparingly) */
  gilt: string;
};

export type Theme = {
  /** stable key sent from the UI */
  key: string;
  /** human-readable label shown in the selector */
  label: string;
  /** phrasing handed to the model; empty for "auto" */
  hint: string;
  /** anchored hex palette emitted to the model; absent for "auto" */
  palette?: Palette;
};

/**
 * Liturgical color themes seen in past Galilee Church documents.
 * "auto" lets the model pick a theme from the occasion/season.
 *
 * Each non-auto theme carries an anchored hex `palette`. Passing exact hexes
 * (instead of an adjective like "deep purple") keeps two different sermons in
 * the same theme from drifting apart visually.
 */
export const THEMES: Theme[] = [
  { key: "auto", label: "Auto — let Sermorizer choose by season", hint: "" },
  {
    key: "purple",
    label: "Lent / Palm Sunday — deep purple",
    hint: "deep liturgical purple",
    palette: { paper: "#f7f4f9", ink: "#2a2230", brand: "#5b3b7c", brandDeep: "#3a2452", gilt: "#b8893f" },
  },
  {
    key: "gold",
    label: "Easter — warm gold & amber",
    hint: "warm gold and amber",
    palette: { paper: "#fdf8ea", ink: "#2a2117", brand: "#b8862f", brandDeep: "#7c5a14", gilt: "#d8a93f" },
  },
  {
    key: "teal",
    label: "John 4 (the well) — teal",
    hint: "teal",
    palette: { paper: "#f0f7f5", ink: "#1c2a28", brand: "#2c6f6a", brandDeep: "#184542", gilt: "#b8893f" },
  },
  {
    key: "green",
    label: "Children's Sunday — green",
    hint: "fresh green",
    palette: { paper: "#f1f6ee", ink: "#20271c", brand: "#4a7c3f", brandDeep: "#2e5226", gilt: "#c9a73f" },
  },
  {
    key: "forest",
    label: "Word / Bible seminar — forest green & gold",
    hint: "forest green and gold",
    palette: { paper: "#f2f5ee", ink: "#1f261c", brand: "#2f5d35", brandDeep: "#1c3a20", gilt: "#b8893f" },
  },
  {
    key: "rose",
    label: "Parents' Day — rose, carnation & gold",
    hint: "rose, carnation pink and gold",
    palette: { paper: "#fbf2f1", ink: "#2e2122", brand: "#a14a5e", brandDeep: "#6c2438", gilt: "#cf9b6a" },
  },
  {
    key: "tealgold",
    label: "Teachers' Sunday — teal & gold",
    hint: "teal and gold",
    palette: { paper: "#f0f6f5", ink: "#1c2a28", brand: "#2c6f6a", brandDeep: "#184542", gilt: "#c79a3a" },
  },
  {
    key: "rust",
    label: "Ezra — rust & brown",
    hint: "rust and warm brown",
    palette: { paper: "#faf4ec", ink: "#2a1f17", brand: "#a1502f", brandDeep: "#6c3018", gilt: "#b8893f" },
  },
  {
    key: "blue",
    label: "2 Corinthians 12:9 — calm blue",
    hint: "calm, contemplative blue",
    palette: { paper: "#f0f4f9", ink: "#1f2630", brand: "#3a5a8c", brandDeep: "#243a5a", gilt: "#b8893f" },
  },
];

export function themeHint(key: string | undefined): string {
  const t = THEMES.find((x) => x.key === key);
  if (!t || t.key === "auto" || !t.palette) {
    return (
      "Choose a liturgical color theme appropriate to the sermon's occasion and " +
      "season, then build a cohesive palette around it: a warm parchment page " +
      "background, near-black warm ink for body text, one brand accent (header " +
      "gradient, section headings, links) with a deeper shade for gradients and " +
      "hovers, and a restrained gilt for emphasis (key verse, current TOC tab, " +
      "the 한눈에 보기 medallions)."
    );
  }
  const p = t.palette;
  return (
    `Use this anchored ${t.hint} palette — build the whole document from these ` +
    `exact hex values and do not drift to other colors:\n` +
    `- Page background (parchment): ${p.paper}\n` +
    `- Body text (ink): ${p.ink}\n` +
    `- Brand accent — header gradient start, section headings, links: ${p.brand}\n` +
    `- Deep brand — header gradient end, hovers, strong emphasis: ${p.brandDeep}\n` +
    `- Gilt — key verse, current TOC tab, summary medallions (use sparingly): ${p.gilt}\n` +
    `Build the header gradient from the brand and deep-brand colors; reserve the ` +
    `gilt for small accents only.`
  );
}
