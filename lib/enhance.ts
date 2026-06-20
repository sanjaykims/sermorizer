// Layout + editorial guarantees shared by every summary, short or long.
// Colors/theme come from the model's own CSS; these rules only ensure the
// table of contents behaves as a sticky, horizontally-scrollable tab bar, the
// at-a-glance summary lays out as cards, and the Sermorizer house-style
// touches (parchment texture, drop cap, fleuron, Roman-numeral medallions)
// are present even when a particular generation's CSS is weak. Injected once,
// right before </head>, so it wins ties against the generated <style>.
//
// The Roman-numeral block is also a correctness fix for the split path: the
// stitcher injects plain Arabic digits into each .sm-num, and the counter here
// renders them as I, II, III, … so single-call and stitched docs match.
export const ENHANCE_LAYOUT_CSS = `.toc{position:sticky;top:0;z-index:60;display:flex;flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch;}
.toc h3{display:none;}
.toc a{flex:0 0 auto;}
html{scroll-behavior:smooth;}
section[id],h1[id],h2[id],h3[id]{scroll-margin-top:60px;}
.sm-grid{display:grid;gap:12px;}
.sm-item{display:flex;gap:14px;align-items:flex-start;}
.sm-num{flex:0 0 auto;}
body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.55 0 0 0 0 0.45 0 0 0 0 0.30 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:180px 180px;}
.dropcap::first-letter{float:left;font-family:'Gowun Batang',serif;font-weight:700;font-size:3.2em;line-height:.8;padding:.04em .1em 0 0;}
.fleuron{display:flex;align-items:center;justify-content:center;gap:14px;margin:24px 0;}
.fleuron::before,.fleuron::after{content:"";flex:1;max-width:120px;height:1px;background:currentColor;opacity:.28;}
.summary .sm-grid{counter-reset:smnum;}
.summary .sm-item{counter-increment:smnum;}
.summary .sm-num{font-size:0;}
.summary .sm-num::before{content:counter(smnum,upper-roman);font-size:.92rem;font-weight:700;line-height:1;}`;

const MARKER = "sermorizer-layout";

/** Inject ENHANCE_LAYOUT_CSS once, just before </head>. Idempotent. */
export function ensureEnhanceCss(html: string): string {
  if (!html || html.includes(MARKER)) return html;
  const tag = `<style id="${MARKER}">${ENHANCE_LAYOUT_CSS}</style>`;
  return html.includes("</head>") ? html.replace("</head>", tag + "</head>") : html;
}
