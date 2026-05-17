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
  { key: "auto", label: "자동 — Sermorizer가 절기에 맞게 선택", hint: "" },
  { key: "purple", label: "사순절 / 종려주일 — 깊은 보라", hint: "deep liturgical purple" },
  { key: "gold", label: "부활절 — 따뜻한 금빛 / 호박색", hint: "warm gold and amber" },
  { key: "teal", label: "요한복음 4장 (우물) — 청록", hint: "teal" },
  { key: "green", label: "어린이주일 — 초록", hint: "fresh green" },
  { key: "forest", label: "말씀 / 성경 세미나 — 진녹색 & 금색", hint: "forest green and gold" },
  { key: "rose", label: "어버이주일 — 장미 / 카네이션 / 금색", hint: "rose, carnation pink and gold" },
  { key: "tealgold", label: "스승의 주일 — 청록 & 금색", hint: "teal and gold" },
  { key: "rust", label: "에스라 — 적갈색 / 갈색", hint: "rust and warm brown" },
  { key: "blue", label: "고린도후서 12:9 — 파랑", hint: "calm, contemplative blue" },
];

export function themeHint(key: string | undefined): string {
  const t = THEMES.find((x) => x.key === key);
  if (!t || t.key === "auto" || !t.hint) {
    return "Choose a liturgical color theme appropriate to the sermon's occasion and season.";
  }
  return `Use a ${t.hint} color theme.`;
}
