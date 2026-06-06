// Layout guarantees shared by every summary, short or long. Colors/theme come
// from the model's own CSS; these rules only ensure the table of contents
// behaves as a sticky, horizontally-scrollable tab bar and the at-a-glance
// summary lays out as cards — so the features are present even if a particular
// generation's CSS is weak. Injected once, right before </head>.
export const ENHANCE_LAYOUT_CSS = `.toc{position:sticky;top:0;z-index:60;display:flex;flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch;}
.toc h3{display:none;}
.toc a{flex:0 0 auto;}
html{scroll-behavior:smooth;}
section[id],h1[id],h2[id],h3[id]{scroll-margin-top:60px;}
.sm-grid{display:grid;gap:12px;}
.sm-item{display:flex;gap:14px;align-items:flex-start;}
.sm-num{flex:0 0 auto;}`;

const MARKER = "sermorizer-layout";

/** Inject ENHANCE_LAYOUT_CSS once, just before </head>. Idempotent. */
export function ensureEnhanceCss(html: string): string {
  if (!html || html.includes(MARKER)) return html;
  const tag = `<style id="${MARKER}">${ENHANCE_LAYOUT_CSS}</style>`;
  return html.includes("</head>") ? html.replace("</head>", tag + "</head>") : html;
}
