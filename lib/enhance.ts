// The complete Hearth design-system stylesheet for a generated sermon summary.
//
// The model now outputs semantic HTML using the standard component classes and
// (almost) no CSS of its own — this stylesheet, injected once right before
// </head>, is what actually gives every summary the Hearth look: warm-oat
// paper (never #fff), warm ink text, a Newsreader + Geist + Geist Mono pairing
// with Nanum Myeongjo / Noto Sans KR for Hangul, ONE signal-orange accent used
// sparingly as a highlighter, flat hairline surfaces, and restrained radii —
// the same system as the app shell. It is injected LAST in <head>, so it wins
// ties against any stray CSS a generation still emits, and it is applied to
// both single-call and stitched (multi-part) documents so they always match.
//
// The single accent hue is themeable per summary: the model echoes the chosen
// season's colour into `:root{--doc-accent;--doc-accent-strong}` (see
// lib/themes.ts). This sheet only *consumes* those with a signal-orange
// fallback, so it never overrides the model's choice and a summary with no
// theme still renders in signal orange.
export const ENHANCE_LAYOUT_CSS = `@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..600&family=Geist:wght@300..700&family=Geist+Mono:wght@400..600&family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Sans+KR:wght@400;500;700&display=swap');
:root{
/* Per-sermon palette: the model echoes --doc-paper / --doc-ink / --doc-accent /
   --doc-accent-strong for the sermon's season; the whole neutral ramp is derived
   from them so each summary carries its own colour. Warm-oat + signal-orange are
   the defaults. Static fallbacks precede each color-mix for old renderers. */
--paper:var(--doc-paper,#faf6ef);
--ink:var(--doc-ink,#1e1712);
--accent:var(--doc-accent,#FC4C02);
--accent-strong:var(--doc-accent-strong,#c83500);
--accent-ink:#fdfbf7;
--paper-2:#f1ece3;--paper-2:color-mix(in oklab,var(--paper),var(--ink) 5%);
--paper-3:#e9e2d8;--paper-3:color-mix(in oklab,var(--paper),var(--ink) 9%);
--rule:#dcd6cd;--rule:color-mix(in oklab,var(--paper),var(--ink) 15%);
--rule-2:#c3bdb4;--rule-2:color-mix(in oklab,var(--paper),var(--ink) 27%);
--ink-2:#38312d;--ink-2:color-mix(in oklab,var(--ink),var(--paper) 13%);
--neutral:#6a635e;--neutral:color-mix(in oklab,var(--ink),var(--paper) 44%);
--muted:#7a746e;--muted:color-mix(in oklab,var(--ink),var(--paper) 53%);
--accent-wash:#f7e7dc;--accent-wash:color-mix(in oklab,var(--paper),var(--accent) 13%);
--fd:'Newsreader','Nanum Myeongjo',ui-serif,Georgia,serif;
--fb:'Geist','Noto Sans KR',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
--fm:'Geist Mono',ui-monospace,'SF Mono',monospace;
--maxw:760px;}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;}
*{box-sizing:border-box;}
body,body.sermon-paper{margin:0!important;padding:0!important;background:var(--paper)!important;color:var(--ink)!important;font-family:var(--fb)!important;font-size:17px;line-height:1.7;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
body::before,body::after{content:none!important;background:none!important;}
[id]{scroll-margin-top:64px;}
.container,main,article,.wrap{max-width:var(--maxw);margin:0 auto;padding:0 20px;}
h1,h2,h3,h4,h5{font-family:var(--fd);color:var(--ink);font-weight:600;letter-spacing:-0.015em;line-height:1.2;}
p{margin:0 0 1em;max-width:66ch;}
a{color:var(--accent-strong);text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px;}
strong,b{font-weight:600;color:var(--ink);}
em,i{font-style:italic;}
ul,ol{padding-left:1.4em;margin:0 0 1em;}
li{margin:.3em 0;}
img{max-width:100%;height:auto;border-radius:8px;display:block;}
hr,.divider{border:0;height:1px;background:var(--rule);margin:2.4em 0;max-width:none;width:100%;}
/* header — flat, editorial; no gradient */
.header{max-width:var(--maxw);margin:0 auto;padding:44px 20px 26px;background:none!important;color:var(--ink);border-bottom:1px solid var(--rule);text-align:left;}
.header h1,.header .h-title{font-family:var(--fd);font-size:2.1rem;font-weight:700;letter-spacing:-0.02em;line-height:1.12;margin:0 0 .35em;color:var(--ink);text-wrap:balance;}
.header .preacher,.header .h-sub,.header .scripture,.header .h-meta,.header p{font-family:var(--fm);font-size:.76rem;letter-spacing:.09em;text-transform:uppercase;color:var(--neutral);margin:.2em 0;max-width:none;}
/* key verse */
.key-verse{max-width:var(--maxw);margin:24px auto;padding:22px 24px;background:var(--paper-2);border:1px solid var(--rule);border-radius:12px;font-family:var(--fd);font-size:1.25rem;line-height:1.6;color:var(--ink);font-style:italic;}
.key-verse .ref,.key-verse cite,.key-verse .kv-ref,.key-verse .bref{display:block;margin-top:12px;font-family:var(--fm);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-strong);font-style:normal;}
/* sticky tab-bar table of contents */
.toc{position:sticky;top:0;z-index:60;display:flex;flex-wrap:nowrap;gap:2px;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch;background:color-mix(in srgb,var(--paper) 92%,transparent);backdrop-filter:saturate(1.2) blur(6px);border-bottom:1px solid var(--rule);padding:0 12px;margin:8px 0 4px;scrollbar-width:none;}
.toc::-webkit-scrollbar{display:none;}
.toc h3{display:none;}
.toc a{flex:0 0 auto;display:inline-flex;align-items:center;min-height:44px;padding:0 14px;color:var(--neutral);text-decoration:none;font-family:var(--fb);font-size:.82rem;font-weight:500;border-bottom:2px solid transparent;}
.toc a:hover{color:var(--ink);}
.toc a:target,.toc a.active{color:var(--ink);border-bottom-color:var(--accent);}
/* info card */
.info-card{max-width:var(--maxw);margin:16px auto;padding:14px 18px;background:var(--paper);border:1px solid var(--rule);border-radius:12px;display:flex;flex-wrap:wrap;gap:8px 26px;font-family:var(--fb);font-size:.9rem;color:var(--ink-2);}
.info-card dt,.info-card .label,.info-card b,.info-card strong{font-family:var(--fm);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:500;margin-right:6px;}
.info-card dd{margin:0;}
/* sections */
.section,section{max-width:var(--maxw);margin:0 auto;padding:6px 20px;}
.sec-head{display:flex;align-items:center;gap:12px;margin:34px 0 12px;}
.sec-icon{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:var(--accent-strong);color:var(--accent-ink);font-family:var(--fm);font-size:.85rem;font-weight:600;}
.sec-title{font-family:var(--fd);font-size:1.5rem;font-weight:600;letter-spacing:-0.015em;line-height:1.2;color:var(--ink);}
.section h2,.section h3{font-family:var(--fd);}
/* cards + illustrations */
.card,.illus,.example{background:var(--paper-2);border:1px solid var(--rule);border-radius:12px;padding:18px 20px;margin:18px 0;}
.card .card-title,.card h3,.card h4,.card .title{font-family:var(--fd);font-size:1.1rem;font-weight:600;margin:0 0 .4em;}
/* highlighter marks — an inline <span> over a short phrase/clause within
   running prose (a listener's-note emphasis), like a highlighter pen. MUST
   stay inline: display is forced so even a malformed <div>/<p> wrapper still
   renders safely instead of becoming a block box that bleeds into the lines
   above/below. Padding is small enough to sit inside the paragraph's own
   line-height, and box-decoration-break:clone keeps the mark's background/
   radius correct if the phrase wraps onto a second line. (Previously these
   carried block-box padding/margin sized for a <div> callout, which any
   <span> usage rendered as a background box overlapping neighboring lines —
   see CHANGELOG. Never reintroduce vertical padding/margin larger than a
   fraction of an em here.) */
.hl,.hl-cream,.hl-gold,.hl-rust,.hl-dark{
display:inline!important;
box-decoration-break:clone;-webkit-box-decoration-break:clone;
padding:.05em .3em;
margin:0;
border:0;
border-radius:4px;
background:var(--paper-3);
color:inherit;
}
.hl-gold{background:var(--accent-wash);}
.hl-rust{background:var(--paper-3);}
.hl-dark{background:var(--accent-strong);color:var(--accent-ink);}
/* inline Bible-reference chip */
.bref{display:inline-block;font-family:var(--fm);font-size:.78em;padding:.08em .5em;border-radius:5px;background:var(--paper-3);color:var(--ink-2);white-space:nowrap;text-decoration:none;}
/* pull quote */
.key-quote,.pullquote{font-family:var(--fd);font-style:italic;font-size:1.45rem;line-height:1.5;color:var(--ink);border-left:2px solid var(--accent);padding:4px 0 4px 22px;margin:28px 0;max-width:none;}
.key-quote cite,.pullquote cite{display:block;margin-top:10px;font-family:var(--fm);font-style:normal;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--neutral);}
/* pastor box */
.pastor-box{background:var(--paper-2);border:1px solid var(--rule);border-radius:12px;padding:18px 20px;margin:20px 0;}
.pastor-box .label,.pastor-box .pb-label{font-family:var(--fm);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-strong);display:block;margin-bottom:6px;}
/* scripture boxes */
blockquote,.scripture,.verse-box,.verse{background:var(--paper-2);border:1px solid var(--rule);border-radius:12px;padding:16px 20px;margin:18px 0;font-family:var(--fd);font-size:1.06rem;line-height:1.65;color:var(--ink);}
blockquote p:last-child,.scripture p:last-child{margin-bottom:0;}
/* at-a-glance summary */
.summary{max-width:var(--maxw);margin:40px auto;padding:0 20px 8px;}
.sm-grid{display:grid;gap:12px;grid-template-columns:1fr;margin-top:16px;}
@media(min-width:560px){.sm-grid{grid-template-columns:1fr 1fr;}}
.sm-item{display:flex;gap:14px;align-items:flex-start;background:var(--paper-2);border:1px solid var(--rule);border-radius:12px;padding:14px 16px;}
.sm-num{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 8px;border-radius:999px;background:var(--accent-strong);color:var(--accent-ink);font-family:var(--fm);font-size:.82rem;font-weight:600;font-variant-numeric:tabular-nums;}
.sm-text{font-family:var(--fb);font-size:.95rem;line-height:1.5;color:var(--ink-2);}
/* footer */
.footer{max-width:var(--maxw);margin:48px auto 0;padding:24px 20px 44px;border-top:1px solid var(--rule);font-family:var(--fm);font-size:.72rem;letter-spacing:.05em;color:var(--muted);text-align:center;background:none!important;}
/* neutralize legacy illuminated-manuscript ornaments (drop cap, fleuron) */
.dropcap::first-letter{float:none;font-size:inherit;font-family:inherit;font-weight:inherit;line-height:inherit;padding:0;color:inherit;}
.fleuron{display:block;height:1px;width:100%;max-width:none;background:var(--rule);color:transparent;font-size:0;line-height:0;margin:2.4em auto;overflow:hidden;}
.fleuron::before,.fleuron::after{content:none!important;}
@media (max-width:640px){body,body.sermon-paper{font-size:16px;}.header h1,.header .h-title{font-size:1.7rem;}.sec-title{font-size:1.3rem;}.key-quote,.pullquote{font-size:1.2rem;}}`;

const MARKER = "sermorizer-layout";

/** Inject ENHANCE_LAYOUT_CSS once, near the top of the document. Idempotent.
 *  Prefers just-before-</head>, but tolerates a document that uses </HEAD>,
 *  omits the optional </head> tag, or has no <head> at all (all spec-valid) —
 *  otherwise the layout/house-style CSS would be silently dropped and the doc
 *  would ship with a non-sticky TOC and no summary grid. */
export function ensureEnhanceCss(html: string): string {
  if (!html || html.includes(MARKER)) return html;
  const tag = `<style id="${MARKER}">${ENHANCE_LAYOUT_CSS}</style>`;
  // 1) before a (case-insensitive) </head>
  const headClose = html.match(/<\/head\s*>/i);
  if (headClose) return html.replace(headClose[0], tag + headClose[0]);
  // 2) else after an opening <body ...> so the style still lands in the doc
  const bodyOpen = html.match(/<body\b[^>]*>/i);
  if (bodyOpen) return html.replace(bodyOpen[0], bodyOpen[0] + tag);
  // 3) else after <html ...>, or as an outright prefix — a <style> before the
  //    content is still honored by browsers.
  const htmlOpen = html.match(/<html\b[^>]*>/i);
  if (htmlOpen) return html.replace(htmlOpen[0], htmlOpen[0] + tag);
  return tag + html;
}
