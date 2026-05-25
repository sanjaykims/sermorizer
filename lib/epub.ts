import JSZip from "jszip";
import type { Lang, Summary } from "@/lib/summaries";
import { compileChapters, type BookMeta, type Chapter } from "@/lib/book";

/* Reflowable stylesheet for the EPUB (color; the reader controls fonts/size). */
const EPUB_CSS = `
body { font-family: serif; color: #241f18; line-height: 1.7; margin: 0; padding: 0 4%; }
h1, h2, .ch-title, .sec-title, .card h4, .card-title { font-family: serif; }
.title-page { text-align: center; margin: 18% 0; }
.title-page .tp-title { font-size: 1.9em; font-weight: 700; color: #3a2f23; margin: 0 0 .4em; }
.title-page .tp-sub { font-size: 1.1em; color: #7c4a32; margin: 0 0 1.5em; }
.title-page .tp-author { font-size: 1em; color: #4a4036; margin-top: 2.5em; }
.title-page .tp-church { color: #7c4a32; letter-spacing: .08em; margin-top: .4em; }
.copyright { font-size: .8em; color: #6b6257; line-height: 1.9; }
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
.toc, .summary, .footer, .header { display: none; }
`;

const LABELS: Record<Lang, { chapter: (n: number) => string; contents: string; preface: string }> = {
  ko: { chapter: (n) => `제 ${n} 장`, contents: "차 례", preface: "여는 글" },
  en: { chapter: (n) => `Chapter ${n}`, contents: "Contents", preface: "Preface" },
  zh: { chapter: (n) => `第 ${n} 章`, contents: "目录", preface: "前言" },
};

function escXml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
    `<p class="ch-num">${escXml(LABELS[lang].chapter(i + 1))}</p>` +
    `<h1 class="ch-title">${escXml(c.title)}</h1>` +
    (c.sub ? `<p class="ch-sub">${escXml(c.sub)}</p>` : "") +
    (c.keyVerse ? `<div class="ch-epigraph">${toXhtml(c.keyVerse)}</div>` : "") +
    `<div class="ch-body">${toXhtml(c.body)}</div>` +
    `</section>`;
  return xhtmlDoc(lang, c.title, inner);
}

/** Build a downloadable EPUB Blob from the selected summaries. */
export async function buildEpub(summaries: Summary[], meta: BookMeta): Promise<Blob> {
  const lang = meta.lang;
  const L = LABELS[lang] ?? LABELS.ko;
  const chapters = compileChapters(summaries, lang);
  const bookTitle = meta.title.trim() || "설교 모음집";
  const author = meta.author.trim() || "김영복 담임목사";
  const id = uuid();
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const hasPreface = Boolean(meta.preface.trim());

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

  // Title page
  oebps.file(
    "title.xhtml",
    xhtmlDoc(
      lang,
      bookTitle,
      `<section class="title-page">
<h1 class="tp-title">${escXml(bookTitle)}</h1>
${meta.subtitle.trim() ? `<p class="tp-sub">${escXml(meta.subtitle.trim())}</p>` : ""}
${author ? `<p class="tp-author">${escXml(author)}</p>` : ""}
<p class="tp-church">갈릴리교회</p>
<p class="copyright">© ${escXml(meta.year.trim() || String(new Date().getFullYear()))} 갈릴리교회${meta.isbn.trim() ? ` · ISBN ${escXml(meta.isbn.trim())}` : ""}<br/>Sermorizer로 엮음</p>
</section>`,
    ),
  );

  // Preface
  if (hasPreface) {
    const paras = meta.preface
      .trim()
      .split(/\n{2,}/)
      .map((p) => `<p>${escXml(p).replace(/\n/g, "<br/>")}</p>`)
      .join("");
    oebps.file(
      "preface.xhtml",
      xhtmlDoc(lang, L.preface, `<section class="preface"><h1>${escXml(L.preface)}</h1>${paras}</section>`),
    );
  }

  // Chapters
  chapters.forEach((c, i) => oebps.file(`ch${i + 1}.xhtml`, chapterXhtml(c, i, lang)));

  // Navigation (EPUB3 nav doc)
  const navItems =
    (hasPreface ? `<li><a href="preface.xhtml">${escXml(L.preface)}</a></li>` : "") +
    chapters
      .map((c, i) => `<li><a href="ch${i + 1}.xhtml">${i + 1}. ${escXml(c.title)}</a></li>`)
      .join("");
  oebps.file(
    "nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="utf-8"/><title>${escXml(L.contents)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<nav epub:type="toc" id="toc"><h1>${escXml(L.contents)}</h1><ol>${navItems}</ol></nav>
</body>
</html>`,
  );

  // Package document
  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="style.css" media-type="text/css"/>`,
    `<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>`,
    hasPreface ? `<item id="preface" href="preface.xhtml" media-type="application/xhtml+xml"/>` : "",
    ...chapters.map(
      (_, i) => `<item id="ch${i + 1}" href="ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`,
    ),
  ]
    .filter(Boolean)
    .join("\n    ");
  const spineItems = [
    `<itemref idref="title"/>`,
    hasPreface ? `<itemref idref="preface"/>` : "",
    ...chapters.map((_, i) => `<itemref idref="ch${i + 1}"/>`),
  ]
    .filter(Boolean)
    .join("\n    ");
  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${id}</dc:identifier>
    <dc:title>${escXml(bookTitle)}</dc:title>
    <dc:language>${lang}</dc:language>
    <dc:creator>${escXml(author)}</dc:creator>
    <dc:publisher>갈릴리교회</dc:publisher>
    <meta property="dcterms:modified">${modified}</meta>
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
