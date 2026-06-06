import type { Lang, Summary } from "@/lib/summaries";
import {
  compileChapters,
  coverInner,
  scriptureIndexInner,
  collectScriptureRefs,
  LABELS,
  type BookMeta,
  type Chapter,
} from "@/lib/book";
import { escapeXml as escXml } from "@/lib/util";

/* Reflowable stylesheet for the EPUB (color; the reader controls fonts/size). */
const EPUB_CSS = `
body { font-family: serif; color: #241f18; line-height: 1.7; margin: 0; padding: 0 4%; }
.cover-img { margin: 0 -4%; text-align: center; }
.cover-img img { max-width: 100%; height: auto; }
h1, h2, .ch-title, .sec-title, .card h4, .card-title { font-family: serif; }
.book-cover { background: linear-gradient(160deg,#1f3a2e,#2d5a3d 58%,#3a6b4a); color: #f5efe2; text-align: center; padding: 22% 8%; min-height: 90vh; box-sizing: border-box; margin: 0 -4%; }
.bc-cross { font-size: 2em; color: #c8a96a; margin-bottom: .5em; }
.bc-title { font-size: 1.9em; font-weight: 700; line-height: 1.25; margin: 0 0 .3em; color: #f5efe2; }
.bc-sub { font-size: 1.05em; color: #e7d9b6; margin: 0 0 .3em; }
.bc-rule { width: 64px; height: 2px; background: #c8a96a; margin: 1.2em auto; }
.bc-church { letter-spacing: .12em; color: #f0e6cf; margin: 0; }
.bc-year { font-size: .85em; color: #cdbf9c; margin: .3em 0 0; }
.copyright { font-size: .82em; color: #6b6257; line-height: 1.85; }
.copyright .cp-title { font-size: 1.1em; color: #3a2f23; margin-bottom: .4em; }
.preface h1 { text-align: center; color: #3a2f23; }
.preface p { text-indent: 1em; margin: 0 0 .7em; }
.ch-num { text-align: center; color: #a9764f; letter-spacing: .3em; font-size: .85em; margin: 1em 0 .4em; }
.ch-title { font-size: 1.6em; font-weight: 700; color: #3a2f23; text-align: center; line-height: 1.3; margin: 0 0 .3em; }
.ch-sub { text-align: center; color: #7c4a32; font-size: .85em; margin: 0 0 1.4em; }
.ch-epigraph { text-align: center; font-size: .95em; line-height: 1.85; color: #4a4036; border-top: 1px solid #d8cdb4; border-bottom: 1px solid #d8cdb4; padding: .9em .5em; margin: 0 auto 1.6em; }
.ch-epigraph .kv-ref, .ch-epigraph .ref { display: block; color: #a9764f; font-size: .78em; letter-spacing: .1em; margin-top: .6em; }
.ch-epigraph .verse-mark { display: none; }
.section { margin: 1.4em 0; }
.sec-head { border-bottom: 1.5px solid #e0d7c2; padding-bottom: .35em; margin-bottom: .7em; }
.sec-icon { color: #a9764f; font-weight: 700; margin-right: .4em; }
.sec-title { font-size: 1.15em; font-weight: 700; color: #3a2f23; }
.section p { margin: 0 0 .6em; text-align: justify; }
.card { background: #faf6ee; border: 1px solid #e0d7c2; border-radius: 5px; padding: .8em 1em; margin: 1em 0; }
.card h4, .card .card-title { color: #7c4a32; margin: 0 0 .5em; }
.hl { background: #f3efe4; border-left: 3px solid #4a7c5c; padding: .8em 1em; margin: 1em 0; }
.hl-gold { background: #faf3df; border-left-color: #c8a96a; }
.hl-rust { background: #f6e9e2; border-left-color: #a85a3c; }
.hl-cream { background: #f7f2e6; border-left-color: #a9764f; }
.hl-dark { background: #efe9da; border-left-color: #6b5b3e; }
.hl strong, .hl-rust strong { color: #7c4a32; }
.hl-dark em { color: #7c4a32; font-style: normal; }
.bref { display: inline-block; background: #eef2ec; color: #2d5a3d; padding: 0 .5em; border-radius: 3px; font-size: .92em; }
.bref .ref { display: block; color: #a85a3c; font-size: .8em; margin-top: .4em; }
.key-quote { font-size: 1.15em; line-height: 1.6; color: #3a2f23; text-align: center; padding: .8em; margin: 1em 0; border-top: 2px solid #c8a96a; border-bottom: 2px solid #c8a96a; font-style: italic; }
.pastor-box { background: #faf6ee; border: 1px solid #c8a96a; border-radius: 5px; padding: .8em 1em; margin: 1em 0; font-style: italic; }
.pastor-box .label { font-size: .72em; letter-spacing: .12em; color: #a85a3c; font-style: normal; display: block; margin-bottom: .4em; }
.divider { text-align: center; color: #c8a96a; letter-spacing: .8em; margin: 1em 0; }
.scripture-index h2 { text-align: center; color: #3a2f23; }
.scripture-index .si-note { text-align: center; color: #8a8072; font-size: .8em; margin: 0 0 1em; }
.scripture-index ul { list-style: none; padding: 0; }
.scripture-index li { display: flex; gap: 6px; align-items: baseline; margin: 0 0 .4em; }
.scripture-index .si-ref { font-weight: 600; color: #3a2f23; }
.scripture-index .si-dots { flex: 1; border-bottom: 1px dotted #c9bfa9; }
.scripture-index .si-ch { color: #6b6257; font-size: .9em; }
.toc, .summary, .footer, .header { display: none; }
`;

/** Map our short lang codes to BCP-47 for EPUB metadata. */
function bcp47(lang: Lang): string {
  return lang === "zh" ? "zh-Hans" : lang;
}

/** Render the book cover to a PNG (canvas) so readers show a library thumbnail. */
async function renderCoverPng(meta: BookMeta, bookTitle: string): Promise<Uint8Array | null> {
  if (typeof document === "undefined") return null;
  const W = 1200;
  const H = 1800;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#1f3a2e");
  grad.addColorStop(0.58, "#2d5a3d");
  grad.addColorStop(1, "#3a6b4a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#c8a96a";
  ctx.font = "120px serif";
  ctx.fillText("✝", W / 2, 360);

  // Title — wrap to the canvas width.
  ctx.fillStyle = "#f5efe2";
  const titleSize = bookTitle.length > 16 ? 84 : 104;
  ctx.font = `700 ${titleSize}px serif`;
  const maxW = W - 220;
  const words = bookTitle.split(/(\s+)/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line + w;
    if (ctx.measureText(test).width > maxW && line.trim()) {
      lines.push(line.trim());
      line = w;
    } else {
      line = test;
    }
  }
  if (line.trim()) lines.push(line.trim());
  let y = 620;
  for (const l of lines) {
    ctx.fillText(l, W / 2, y);
    y += titleSize * 1.3;
  }

  if (meta.subtitle.trim()) {
    ctx.fillStyle = "#e7d9b6";
    ctx.font = "52px serif";
    ctx.fillText(meta.subtitle.trim().slice(0, 40), W / 2, y + 40);
    y += 100;
  }

  ctx.strokeStyle = "#c8a96a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 90, y + 90);
  ctx.lineTo(W / 2 + 90, y + 90);
  ctx.stroke();

  ctx.fillStyle = "#f0e6cf";
  ctx.font = "56px serif";
  ctx.fillText("갈릴리교회", W / 2, H - 230);
  ctx.fillStyle = "#cdbf9c";
  ctx.font = "40px serif";
  ctx.fillText(meta.year.trim() || String(new Date().getFullYear()), W / 2, H - 150);

  const blob: Blob | null = await new Promise((res) =>
    canvas.toBlob((b) => res(b), "image/png"),
  );
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Re-serialize an HTML fragment as well-formed XHTML for strict EPUB readers. */
function toXhtml(fragment: string): string {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${fragment}</body></html>`,
    "text/html",
  );
  const ser = new XMLSerializer();
  return Array.from(doc.body.childNodes)
    .map((n) => ser.serializeToString(n))
    .join("");
}

function xhtmlDoc(lang: string, title: string, inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}">
<head><meta charset="utf-8"/><title>${escXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${inner}
</body>
</html>`;
}

function chapterXhtml(c: Chapter, i: number, lang: Lang): string {
  const inner =
    `<section class="chapter" id="ch${i + 1}">` +
    `<p class="ch-num">${escXml((LABELS[lang] ?? LABELS.ko).chapter(i + 1))}</p>` +
    `<h1 class="ch-title">${escXml(c.title)}</h1>` +
    (c.sub ? `<p class="ch-sub">${escXml(c.sub)}</p>` : "") +
    (c.keyVerse ? `<div class="ch-epigraph">${toXhtml(c.keyVerse)}</div>` : "") +
    `<div class="ch-body">${toXhtml(c.body)}</div>` +
    `</section>`;
  return xhtmlDoc(bcp47(lang), c.title, inner);
}

/** Build a downloadable EPUB Blob from the selected summaries. */
export async function buildEpub(summaries: Summary[], meta: BookMeta): Promise<Blob> {
  const lang = meta.lang;
  const L = LABELS[lang] ?? LABELS.ko;
  const chapters = compileChapters(summaries, lang);
  const bookTitle = meta.title.trim() || "설교 모음집";
  const author = meta.author.trim() || "김영복 담임목사";
  const year = meta.year.trim() || String(new Date().getFullYear());
  const id = uuid();
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const hasPreface = Boolean(meta.preface.trim());
  const indexInner = scriptureIndexInner(chapters, lang);
  const hasIndex = Boolean(indexInner) && collectScriptureRefs(chapters).length > 0;

  const langTag = bcp47(lang);
  const coverPng = await renderCoverPng(meta, bookTitle);

  // Lazy-load JSZip so it isn't shipped in the initial bundle.
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );

  const oebps = zip.folder("OEBPS");
  if (!oebps) throw new Error("Could not create EPUB structure.");
  oebps.file("style.css", EPUB_CSS);

  // Cover — a raster image (for the reader's library thumbnail) when the canvas
  // is available, otherwise the CSS gradient cover as a fallback.
  if (coverPng) {
    oebps.file("cover.png", coverPng);
    oebps.file(
      "cover.xhtml",
      xhtmlDoc(
        langTag,
        bookTitle,
        `<section class="cover-img"><img src="cover.png" alt="${escXml(bookTitle)}"/></section>`,
      ),
    );
  } else {
    oebps.file("cover.xhtml", xhtmlDoc(langTag, bookTitle, coverInner(meta, bookTitle)));
  }

  // Copyright
  const copyrightInner = `<section class="copyright">
<p class="cp-title">${escXml(bookTitle)}</p>
${meta.subtitle.trim() ? `<p>${escXml(meta.subtitle.trim())}</p>` : ""}
<p>${escXml(L.editedBy)} · ${escXml(author)}</p>
<p>© ${escXml(year)} ${escXml(L.publisher)}</p>
<p>${escXml(L.rights)}</p>
${meta.isbn.trim() ? `<p>ISBN ${escXml(meta.isbn.trim())}</p>` : ""}
<p>설교 · 김영복 담임목사</p>
<p>${escXml(L.scriptureNote)}</p>
<p>Sermorizer로 엮음</p>
</section>`;
  oebps.file("copyright.xhtml", xhtmlDoc(langTag, "©", copyrightInner));

  // Preface
  if (hasPreface) {
    const paras = meta.preface
      .trim()
      .split(/\n{2,}/)
      .map((p) => `<p>${escXml(p).replace(/\n/g, "<br/>")}</p>`)
      .join("");
    oebps.file(
      "preface.xhtml",
      xhtmlDoc(langTag, L.preface, `<section class="preface"><h1>${escXml(L.preface)}</h1>${paras}</section>`),
    );
  }

  // Chapters
  chapters.forEach((c, i) => oebps.file(`ch${i + 1}.xhtml`, chapterXhtml(c, i, lang)));

  // Scripture index
  if (hasIndex) {
    oebps.file("index.xhtml", xhtmlDoc(langTag, L.index, toXhtml(indexInner)));
  }

  // Navigation (EPUB3 nav doc)
  const navItems =
    (hasPreface ? `<li><a href="preface.xhtml">${escXml(L.preface)}</a></li>` : "") +
    chapters
      .map((c, i) => `<li><a href="ch${i + 1}.xhtml">${i + 1}. ${escXml(c.title)}</a></li>`)
      .join("") +
    (hasIndex ? `<li><a href="index.xhtml">${escXml(L.index)}</a></li>` : "");
  oebps.file(
    "nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${langTag}" lang="${langTag}">
<head><meta charset="utf-8"/><title>${escXml(L.contents)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<nav epub:type="toc" id="toc"><h1>${escXml(L.contents)}</h1><ol>${navItems}</ol></nav>
<nav epub:type="landmarks" hidden="hidden"><ol><li><a epub:type="cover" href="cover.xhtml">Cover</a></li><li><a epub:type="bodymatter" href="ch1.xhtml">Start</a></li><li><a epub:type="toc" href="nav.xhtml">${escXml(L.contents)}</a></li></ol></nav>
</body>
</html>`,
  );

  // Package document
  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="style.css" media-type="text/css"/>`,
    coverPng ? `<item id="cover-img" href="cover.png" media-type="image/png" properties="cover-image"/>` : "",
    `<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>`,
    hasPreface ? `<item id="preface" href="preface.xhtml" media-type="application/xhtml+xml"/>` : "",
    ...chapters.map(
      (_, i) => `<item id="ch${i + 1}" href="ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`,
    ),
    hasIndex ? `<item id="index" href="index.xhtml" media-type="application/xhtml+xml"/>` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
  const spineItems = [
    `<itemref idref="cover"/>`,
    `<itemref idref="copyright"/>`,
    hasPreface ? `<itemref idref="preface"/>` : "",
    ...chapters.map((_, i) => `<itemref idref="ch${i + 1}"/>`),
    hasIndex ? `<itemref idref="index"/>` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${langTag}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${id}</dc:identifier>
    <dc:title>${escXml(bookTitle)}</dc:title>
    <dc:language>${langTag}</dc:language>
    <dc:creator>${escXml(author)}</dc:creator>
    <dc:publisher>${escXml(L.publisher)}</dc:publisher>
    <meta property="dcterms:modified">${modified}</meta>${coverPng ? `\n    <meta name="cover" content="cover-img"/>` : ""}
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`,
  );

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });
}
