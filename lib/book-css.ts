// Print stylesheet for the compiled book (6×9" trade paperback, color interior).
// Google Fonts @import works here because the book is paginated and printed in
// the browser (the user is online); Paged.js — if it loads — adds running heads,
// page numbers, and a page-numbered table of contents. Without it, the book
// still prints cleanly (chapters start on new pages, browser supplies numbers).
export const BOOK_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Noto+Serif+KR:wght@300;400;500;600;700&display=swap');

@page {
  size: 6in 9in;
  margin: 20mm 17mm 18mm 17mm;
  @bottom-center { content: counter(page); font-family: 'Noto Serif KR', serif; font-size: 9pt; color: #6b6257; }
  @top-center { content: string(running-title); font-family: 'Gowun Batang', serif; font-size: 8.5pt; letter-spacing: .08em; color: #9a9082; }
}
@page :first { margin: 0; @top-center { content: none } @bottom-center { content: none } }

* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0; padding: 0;
  font-family: 'Noto Serif KR', serif;
  color: #241f18; line-height: 1.75; font-size: 10.8pt;
  background: #fff;
}

/* On-screen viewport (before print) */
.book-screen-pad { max-width: 820px; margin: 0 auto; padding: 24px; }

/* ---- Cover (fills the first page) ---- */
.book-cover {
  break-after: page; width: 100%; min-height: 9in; box-sizing: border-box;
  background: linear-gradient(160deg, #1f3a2e 0%, #2d5a3d 58%, #3a6b4a 100%);
  color: #f5efe2; display: flex; align-items: center; justify-content: center; text-align: center;
}
.book-cover .bc-pad { padding: 0 14mm; width: 100%; }
.bc-cross { font-size: 30pt; color: #c8a96a; margin: 0 0 18px; }
.bc-title { font-family: 'Gowun Batang', serif; font-size: 30pt; font-weight: 700; line-height: 1.25; margin: 0 0 10px; }
.bc-sub { font-family: 'Gowun Batang', serif; font-size: 13pt; color: #e7d9b6; margin: 0 0 6px; }
.bc-rule { width: 64px; height: 2px; background: #c8a96a; margin: 24px auto; }
.bc-church { font-size: 12pt; letter-spacing: .14em; color: #f0e6cf; margin: 0; }
.bc-year { font-size: 10pt; color: #cdbf9c; margin: 6px 0 0; }

/* ---- Front matter ---- */
.title-page { text-align: center; padding-top: 28%; break-after: page; }
.title-page .tp-title { font-family: 'Gowun Batang', serif; font-size: 30pt; font-weight: 700; line-height: 1.25; color: #3a2f23; margin: 0 0 14px; }
.title-page .tp-sub { font-family: 'Gowun Batang', serif; font-size: 14pt; color: #7c4a32; margin: 0 0 40px; }
.title-page .tp-author { font-size: 12pt; color: #4a4036; margin-top: 60px; }
.title-page .tp-church { font-size: 11pt; color: #7c4a32; letter-spacing: .1em; margin-top: 8px; }

.copyright-page { font-size: 8.5pt; color: #6b6257; line-height: 1.85; break-after: page; padding-top: 45%; }
.copyright-page .cp-title { font-family: 'Gowun Batang', serif; font-size: 11pt; color: #3a2f23; margin-bottom: 6px; }
.copyright-page p { margin: 2px 0; }

.preface { break-after: page; }
.preface h2 { font-family: 'Gowun Batang', serif; font-size: 17pt; color: #3a2f23; text-align: center; margin: 0 0 22px; }
.preface p { margin: 0 0 12px; text-indent: 1em; }

/* ---- Table of contents ---- */
.book-toc { break-after: page; }
.book-toc h2 { font-family: 'Gowun Batang', serif; font-size: 18pt; color: #3a2f23; text-align: center; margin: 0 0 26px; letter-spacing: .15em; }
.book-toc ol { list-style: none; margin: 0; padding: 0; }
.book-toc li { margin: 0 0 11px; font-size: 10.5pt; }
.book-toc a { color: #241f18; text-decoration: none; display: flex; align-items: baseline; gap: 6px; }
.book-toc .toc-t { font-weight: 600; }
.book-toc .toc-leader { flex: 1; border-bottom: 1px dotted #c9bfa9; transform: translateY(-3px); }
.book-toc a::after { content: target-counter(attr(href), page); color: #6b6257; font-size: 9.5pt; }
.book-toc .toc-d { color: #8a8072; font-size: 9pt; }

/* ---- Chapters ---- */
.chapter { break-before: page; }
.ch-num { text-align: center; font-family: 'Gowun Batang', serif; color: #a9764f; font-size: 11pt; letter-spacing: .3em; margin: 6px 0 10px; }
.ch-title { string-set: running-title content(); font-family: 'Gowun Batang', serif; font-size: 22pt; font-weight: 700; color: #3a2f23; text-align: center; line-height: 1.3; margin: 0 0 8px; }
.ch-sub { text-align: center; color: #7c4a32; font-size: 10pt; margin: 0 0 22px; }
.ch-epigraph {
  margin: 0 auto 26px; max-width: 86%; text-align: center;
  font-family: 'Gowun Batang', serif; font-size: 11pt; line-height: 1.9; color: #4a4036;
  border-top: 1px solid #d8cdb4; border-bottom: 1px solid #d8cdb4; padding: 16px 8px;
}
.ch-epigraph .kv-ref, .ch-epigraph .ref { display: block; color: #a9764f; font-size: 8.5pt; letter-spacing: .12em; margin-top: 10px; }
.ch-epigraph .verse-mark { display: none; }

/* ---- Sermon components (unified book styling) ---- */
.section { margin: 0 0 18px; }
.section:not(:first-child) { margin-top: 22px; }
.sec-head { display: flex; align-items: baseline; gap: 9px; margin: 0 0 12px; border-bottom: 1.5px solid #e0d7c2; padding-bottom: 7px; }
.sec-icon {
  flex: 0 0 auto; width: auto; height: auto; min-width: 1.4em; padding: 0 .35em;
  background: none; color: #a9764f; border-radius: 0;
  font-family: 'Gowun Batang', serif; font-weight: 700; font-size: 13pt;
}
.sec-title { font-family: 'Gowun Batang', serif; font-size: 13.5pt; font-weight: 700; color: #3a2f23; margin: 0; line-height: 1.4; }
.section p, .card p, .hl p { margin: 0 0 9px; text-align: justify; orphans: 2; widows: 2; }

.card { background: #faf6ee; border: 1px solid #e0d7c2; border-radius: 5px; padding: 12px 15px; margin: 14px 0; break-inside: avoid; }
.card h4, .card .card-title { font-family: 'Gowun Batang', serif; color: #7c4a32; margin: 0 0 7px; font-size: 11pt; }

.hl { background: #f3efe4; border-left: 3px solid #4a7c5c; padding: 12px 15px; margin: 14px 0; border-radius: 0 4px 4px 0; break-inside: avoid; }
.hl-gold { background: #faf3df; border-left-color: #c8a96a; }
.hl-rust { background: #f6e9e2; border-left-color: #a85a3c; }
.hl-cream { background: #f7f2e6; border-left-color: #a9764f; }
.hl-dark { background: #efe9da; border-left-color: #6b5b3e; color: #2a2418; }
.hl strong, .hl-rust strong { color: #7c4a32; }
.hl-dark em { color: #7c4a32; font-style: normal; }

.bref { display: inline-block; background: #eef2ec; color: #2d5a3d; padding: 1px 8px; border-radius: 3px; font-size: 9.5pt; font-family: 'Gowun Batang', serif; }
.bref .ref { display: block; color: #a85a3c; font-size: 8.5pt; margin-top: 5px; }

.key-quote {
  font-family: 'Gowun Batang', serif; font-size: 13pt; line-height: 1.7; color: #3a2f23;
  text-align: center; padding: 16px 14px; margin: 18px 0;
  border-top: 2px solid #c8a96a; border-bottom: 2px solid #c8a96a; font-style: italic; break-inside: avoid;
}

.pastor-box { background: #faf6ee; border: 1px solid #c8a96a; border-radius: 5px; padding: 13px 16px; margin: 16px 0; font-style: italic; color: #3a2f23; break-inside: avoid; }
.pastor-box .label { font-size: 8pt; letter-spacing: .15em; color: #a85a3c; font-style: normal; display: block; margin-bottom: 6px; }

.divider { text-align: center; color: #c8a96a; letter-spacing: .8em; margin: 18px 0; }

/* ---- Scripture index ---- */
.scripture-index { break-before: page; }
.scripture-index h2 { font-family: 'Gowun Batang', serif; font-size: 17pt; color: #3a2f23; text-align: center; margin: 0 0 6px; letter-spacing: .1em; }
.scripture-index .si-note { text-align: center; color: #8a8072; font-size: 8.5pt; margin: 0 0 20px; }
.scripture-index ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 22px; }
.scripture-index li { display: flex; align-items: baseline; gap: 6px; font-size: 9.5pt; margin: 0 0 6px; break-inside: avoid; }
.scripture-index .si-ref { font-weight: 600; color: #3a2f23; }
.scripture-index .si-dots { flex: 1; border-bottom: 1px dotted #c9bfa9; transform: translateY(-3px); }
.scripture-index .si-ch { color: #6b6257; font-size: 9pt; }

/* Neutralize leftover screen-only bits if any slip through */
.toc, .summary, .footer, .header { display: none !important; }

/* On-screen helper bar (hidden in print and after Paged.js) */
.print-bar { position: fixed; bottom: 18px; right: 18px; z-index: 9999; }
.print-bar button {
  font: 600 15px 'Noto Serif KR', serif; background: #7c4a32; color: #fff;
  border: none; border-radius: 10px; padding: 13px 20px; cursor: pointer; box-shadow: 0 3px 12px rgba(0,0,0,.25);
}
@media print { .print-bar { display: none !important; } }
`;

// Progressive-enhancement scripts appended to the book HTML: Paged.js paginates
// (running heads, page numbers, TOC page refs) and a print button is added after.
export const BOOK_SCRIPTS = `
<div class="print-bar"><button onclick="window.print()">🖨 Save as PDF / 인쇄</button></div>
<script>
  window.PagedConfig = { auto: true };
</script>
<script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>
`;
