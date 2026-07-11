import type { Lang, Summary } from "@/lib/summaries";
import { BOOK_CSS, BOOK_SCRIPTS } from "@/lib/book-css";
import { escapeHtml as esc } from "@/lib/util";

export type BookMeta = {
  title: string;
  subtitle: string;
  author: string;
  year: string;
  isbn: string;
  preface: string;
  lang: Lang;
};

export type BookLabels = {
  chapter: (n: number) => string;
  contents: string;
  preface: string;
  index: string;
  indexNote: string;
  editedBy: string;
  rights: string;
  scriptureNote: string;
  publisher: string;
};

export const LABELS: Record<Lang, BookLabels> = {
  ko: {
    chapter: (n) => `제 ${n} 장`,
    contents: "차 례",
    preface: "여는 글",
    index: "성구 색인",
    indexNote: "(숫자는 장 번호)",
    editedBy: "엮은이",
    rights: "이 책의 모든 권리는 갈릴리교회에 있습니다.",
    scriptureNote: "성경 인용은 개역개정판을 따릅니다.",
    publisher: "갈릴리교회 (기독교대한감리회)",
  },
  en: {
    chapter: (n) => `Chapter ${n}`,
    contents: "Contents",
    preface: "Preface",
    index: "Scripture Index",
    indexNote: "(numbers are chapters)",
    editedBy: "Edited by",
    rights: "All rights reserved.",
    scriptureNote: "Scripture quotations follow the ESV.",
    publisher: "Galilee Church (Korean Methodist Church)",
  },
  zh: {
    chapter: (n) => `第 ${n} 章`,
    contents: "目录",
    preface: "前言",
    index: "经文索引",
    indexNote: "(数字为章号)",
    editedBy: "编者",
    rights: "版权所有。",
    scriptureNote: "经文引用采用和合本。",
    publisher: "加利利教会 (基督教大韩监理会)",
  },
};

function cleanTitle(t: string): string {
  return (t || "").replace(/\s*[—–-]\s*갈릴리교회\s*$/u, "").trim();
}

function formatDate(s?: string, createdAt?: number): string {
  const raw = (s && s.trim()) || (createdAt ? new Date(createdAt).toISOString().slice(0, 10) : "");
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  return raw;
}

export type Chapter = {
  title: string;
  sub: string;
  scripture: string;
  keyVerse: string;
  body: string;
};

/** Pull one sermon's content out of its stored HTML for use as a book chapter. */
function extractChapter(html: string, summary: Summary): Chapter {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const rawTitle =
    doc.querySelector(".h-title")?.textContent ||
    doc.querySelector("h1")?.textContent ||
    doc.querySelector("title")?.textContent ||
    summary.title;
  const title = cleanTitle(rawTitle);

  const kvEl = doc.querySelector(".key-verse");
  const keyVerse = kvEl ? kvEl.innerHTML : "";

  const scripture = (
    doc.querySelector(".key-verse .kv-ref")?.textContent ||
    doc.querySelector(".scripture-ref")?.textContent ||
    // EN/ZH docs may use neither class — fall back to any verse-like text.
    findScriptureRef(doc.querySelector(".key-verse")?.textContent || "") ||
    ""
  )
    .replace(/^[\s—–\-·]+/, "")
    .trim();
  const date = formatDate(summary.serviceDate, summary.createdAt);
  const sub = [date, scripture, "김영복 담임목사"].filter(Boolean).join("  ·  ");

  // Split (multi-part) generations wrap the sermon in #sermon-body; single-call
  // generations and imported/legacy documents do NOT — for those, fall back to
  // the document's own <section>s so the chapter isn't silently empty.
  const bodyEl = doc.querySelector("#sermon-body");
  let body = "";
  if (bodyEl) {
    // Drop any screen-only chrome that slipped into the body.
    bodyEl
      .querySelectorAll(".toc, .summary, .footer, .header")
      .forEach((n) => n.remove());
    bodyEl.querySelectorAll("section").forEach((sec, i) => {
      const icon = sec.querySelector(".sec-icon");
      if (icon) icon.textContent = String(i + 1);
    });
    body = bodyEl.innerHTML;
  } else {
    const root = doc.body ?? doc.documentElement;
    // The at-a-glance summary and the key-verse are rendered separately in the
    // chapter head, so drop them (plus nav/footer chrome) before collecting.
    root
      .querySelectorAll(".summary, .toc, .footer, .key-verse, .info-card")
      .forEach((n) => n.remove());
    const secs = Array.from(root.querySelectorAll("section")).filter(
      (s) => !s.classList.contains("summary"),
    );
    secs.forEach((sec, i) => {
      const icon = sec.querySelector(".sec-icon");
      if (icon) icon.textContent = String(i + 1);
    });
    body = secs.map((s) => s.outerHTML).join("\n");
  }
  return { title, sub, scripture, keyVerse, body };
}

export function compileChapters(summaries: Summary[], lang: Lang): Chapter[] {
  return summaries
    .filter((s) => s.docs?.[lang])
    .map((s) => extractChapter(s.docs[lang] as string, s));
}

/* ---- Scripture index ---- */
// A reference looks like a book name followed by chapter[:verse] or chapter장,
// in Korean (창세기 1:1 / 출애굽기 20장), English (Genesis 1:1, Psalm 23), or
// Chinese (创世记 1:1 / 加拉太书 6:17).
const VERSE_RE = /[가-힣A-Za-z一-鿿].*?\d+\s*[:장章節节]?\s*\d*/;
const HAS_NUMBER = /\d/;

/** Pull the first verse-like reference out of a free-text string, if any. */
function findScriptureRef(text: string): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  const m = t.match(/[가-힣A-Za-z一-鿿][^.,;\n]*?\d+(?:\s*[:장章節节]\s*\d+(?:[-–]\d+)?)?/);
  return m ? m[0].trim() : "";
}

export function collectScriptureRefs(
  chapters: Chapter[],
): { ref: string; chapters: number[] }[] {
  const map = new Map<string, Set<number>>();
  const add = (raw: string, ch: number) => {
    const ref = (raw || "").replace(/^[\s—–\-·]+/, "").replace(/\s+/g, " ").trim();
    if (!ref || ref.length > 80 || !HAS_NUMBER.test(ref) || !VERSE_RE.test(ref)) return;
    if (!map.has(ref)) map.set(ref, new Set());
    map.get(ref)!.add(ch);
  };
  chapters.forEach((c, i) => {
    const ch = i + 1;
    if (c.scripture) add(c.scripture, ch);
    const doc = new DOMParser().parseFromString(
      `<div>${c.keyVerse}${c.body}</div>`,
      "text/html",
    );
    doc.querySelectorAll(".bref, .ref, .kv-ref, .scripture-ref").forEach((el) =>
      add(el.textContent || "", ch),
    );
  });
  return Array.from(map.entries())
    .map(([ref, set]) => ({ ref, chapters: Array.from(set).sort((a, b) => a - b) }))
    .sort((a, b) => a.chapters[0] - b.chapters[0] || a.ref.localeCompare(b.ref));
}

/** Cover page inner HTML (shared by the print PDF and the EPUB). */
export function coverInner(meta: BookMeta, bookTitle: string): string {
  const year = meta.year.trim() || String(new Date().getFullYear());
  return `<section class="book-cover"><div class="bc-pad">
  <div class="bc-cross">✝</div>
  <h1 class="bc-title">${esc(bookTitle)}</h1>
  ${meta.subtitle.trim() ? `<p class="bc-sub">${esc(meta.subtitle.trim())}</p>` : ""}
  <div class="bc-rule"></div>
  <p class="bc-church">갈릴리교회</p>
  <p class="bc-year">${esc(year)}</p>
</div></section>`;
}

/** Scripture-index inner HTML (shared). Returns "" when there are no refs. */
export function scriptureIndexInner(chapters: Chapter[], lang: Lang): string {
  const refs = collectScriptureRefs(chapters);
  if (!refs.length) return "";
  const L = LABELS[lang] ?? LABELS.ko;
  const items = refs
    .map(
      (r) =>
        `<li><span class="si-ref">${esc(r.ref)}</span><span class="si-dots"></span><span class="si-ch">${r.chapters.join(", ")}</span></li>`,
    )
    .join("");
  return `<section class="scripture-index"><h2>${esc(L.index)}</h2><p class="si-note">${esc(L.indexNote)}</p><ul>${items}</ul></section>`;
}

/** Assemble selected summaries into one complete, printable book HTML document. */
export function buildBookHtml(summaries: Summary[], meta: BookMeta): string {
  const lang = meta.lang;
  const L = LABELS[lang] ?? LABELS.ko;
  const chapters = compileChapters(summaries, lang);
  const bookTitle = meta.title.trim() || "설교 모음집";
  const year = meta.year.trim() || String(new Date().getFullYear());

  const toc = chapters
    .map(
      (c, i) =>
        `<li><a href="#ch${i + 1}"><span class="toc-t">${i + 1}. ${esc(c.title)}</span><span class="toc-leader"></span></a>${c.sub ? `<div class="toc-d">${esc(c.sub.replace(/\s*·\s*김영복 담임목사$/, ""))}</div>` : ""}</li>`,
    )
    .join("\n");

  const chapterHtml = chapters
    .map(
      (c, i) => `
<section class="chapter" id="ch${i + 1}">
  <div class="ch-num">${esc(L.chapter(i + 1))}</div>
  <h2 class="ch-title">${esc(c.title)}</h2>
  ${c.sub ? `<div class="ch-sub">${esc(c.sub)}</div>` : ""}
  ${c.keyVerse ? `<div class="ch-epigraph">${c.keyVerse}</div>` : ""}
  <div class="ch-body">${c.body}</div>
</section>`,
    )
    .join("\n");

  const prefaceHtml = meta.preface.trim()
    ? `<section class="preface"><h2>${esc(L.preface)}</h2>${meta.preface
        .trim()
        .split(/\n{2,}/)
        .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
        .join("")}</section>`
    : "";

  const copyright = `<section class="copyright-page">
  <p class="cp-title">${esc(bookTitle)}</p>
  ${meta.subtitle.trim() ? `<p>${esc(meta.subtitle.trim())}</p>` : ""}
  <p>${esc(L.editedBy)} · ${esc(meta.author.trim() || "김영복 담임목사")}</p>
  <p style="margin-top:14px">© ${esc(year)} ${esc(L.publisher)}</p>
  <p>${esc(L.rights)}</p>
  ${meta.isbn.trim() ? `<p>ISBN ${esc(meta.isbn.trim())}</p>` : ""}
  <p style="margin-top:14px">설교 · 김영복 담임목사</p>
  <p>${esc(L.scriptureNote)}</p>
  <p style="margin-top:14px">Sermorizer로 엮음</p>
</section>`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(bookTitle)}</title>
<style>${BOOK_CSS}</style>
</head>
<body>
${coverInner(meta, bookTitle)}

${copyright}

${prefaceHtml}

<nav class="book-toc">
  <h2>${esc(L.contents)}</h2>
  <ol>
${toc}
  </ol>
</nav>

${chapterHtml}

${scriptureIndexInner(chapters, lang)}

${BOOK_SCRIPTS}
</body>
</html>`;
}
