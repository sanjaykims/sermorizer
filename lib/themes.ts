export type Theme = {
  /** stable key sent from the UI */
  key: string;
  /** human-readable label shown in the selector */
  label: string;
  /** phrasing handed to the model; empty for "auto" */
  hint: string;
};

/**
 * Liturgical color themes seen in past Galilee Church documents.
 * "auto" lets the model pick a theme from the occasion/season.
 */
export const THEMES: Theme[] = [
  { key: "auto", label: "Auto — let Sermorizer choose by season", hint: "" },
  { key: "purple", label: "Lent / Palm Sunday — deep purple", hint: "deep liturgical purple" },
  { key: "gold", label: "Easter — warm gold & amber", hint: "warm gold and amber" },
  { key: "teal", label: "John 4 (the well) — teal", hint: "teal" },
  { key: "green", label: "Children's Sunday — green", hint: "fresh green" },
  { key: "forest", label: "Word / Bible seminar — forest green & gold", hint: "forest green and gold" },
  { key: "rose", label: "Parents' Day — rose, carnation & gold", hint: "rose, carnation pink and gold" },
  { key: "tealgold", label: "Teachers' Sunday — teal & gold", hint: "teal and gold" },
  { key: "rust", label: "Ezra — rust & brown", hint: "rust and warm brown" },
  { key: "blue", label: "2 Corinthians 12:9 — calm blue", hint: "calm, contemplative blue" },
];

export function themeHint(key: string | undefined): string {
  const t = THEMES.find((x) => x.key === key);
  if (!t || t.key === "auto" || !t.hint) {
    return "Choose a liturgical color theme appropriate to the sermon's occasion and season.";
  }
  return `Use a ${t.hint} color theme.`;
}
