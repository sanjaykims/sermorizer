import type { Lang, Summary } from "@/lib/summaries";
import { BOOK_CSS, BOOK_SCRIPTS } from "@/lib/book-css";

export type BookMeta = {
  title: string;
  subtitle: string;
  author: string;
  year: string;
  isbn: string;
  preface: string;
  lang: Lang;
};

const LANG_NAMES: Record<Lang, string> = { ko: "ko", en: "en", zh: "zh" };

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanTitle(t: string): string {
  return (t || "")
    .replace(/\s*[—–-]\s*갈릴리교회\s*$/u, "")
    .trim();
}

function formatDate(s?: string, createdAt?: number): string {
  const raw = (s && s.trim()) || (createdAt ? new Date(createdAt).toISOString().slice(0, 10) : "");
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
  return raw;
}

type Chapter = { title: string; sub: string; keyVerse: string; body: string };

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

  const scripture =
    doc.querySelector(".key-verse .kv-ref")?.textContent ||
    doc.querySelector(".scripture-ref")?.textContent ||
    "";
  const date = formatDate(summary.serviceDate, summary.createdAt);
  const sub = [date, scripture.trim(), "김영복 담임목사"].filter(Boolean).join("  ·  ");

  const bodyEl = doc.querySelector("#sermon-body");
  let body = "";
  if (bodyEl) {
    // Unify section icons to chapter-local numbers for a consistent book look.
    bodyEl.querySelectorAll("section").forEach((sec, i) => {
      const icon = sec.querySelector(".sec-icon");
      if (icon) icon.textContent = String(i + 1);
    });
    body = bodyEl.innerHTML;
  }
  return { title, sub, keyVerse, body };
}

/** Assemble selected summaries into one complete, printable book HTML document. */
export function buildBookHtml(summaries: Summary[], meta: BookMeta): string {
  const lang = meta.lang;
  const usable = summaries.filter((s) => s.docs?.[lang]);
  const chapters = usable.map((s) => extractChapter(s.docs[lang] as string, s));

  const langCode = LANG_NAMES[lang] ?? "ko";
  const bookTitle = meta.title.trim() || "설교 모음집";

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
  <div class="ch-num">제 ${i + 1} 장</div>
  <h2 class="ch-title">${esc(c.title)}</h2>
  ${c.sub ? `<div class="ch-sub">${esc(c.sub)}</div>` : ""}
  ${c.keyVerse ? `<div class="ch-epigraph">${c.keyVerse}</div>` : ""}
  <div class="ch-body">${c.body}</div>
</section>`,
    )
    .join("\n");

  const prefaceHtml = meta.preface.trim()
    ? `<section class="preface"><h2>여는 글</h2>${meta.preface
        .trim()
        .split(/\n{2,}/)
        .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
        .join("")}</section>`
    : "";

  const copyrightLines = [
    `<p>${esc(bookTitle)}</p>`,
    meta.author.trim() ? `<p>엮은이 · ${esc(meta.author.trim())}</p>` : "",
    `<p>© ${esc(meta.year.trim() || String(new Date().getFullYear()))} 갈릴리교회</p>`,
    meta.isbn.trim() ? `<p>ISBN ${esc(meta.isbn.trim())}</p>` : "",
    `<p>설교 김영복 담임목사 · 갈릴리교회 (기독교대한감리회)</p>`,
    `<p style="margin-top:14px">Sermorizer로 엮음</p>`,
  ]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${langCode}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(bookTitle)}</title>
<style>${BOOK_CSS}</style>
</head>
<body>
<section class="title-page">
  <h1 class="tp-title">${esc(bookTitle)}</h1>
  ${meta.subtitle.trim() ? `<div class="tp-sub">${esc(meta.subtitle.trim())}</div>` : ""}
  ${meta.author.trim() ? `<div class="tp-author">${esc(meta.author.trim())}</div>` : ""}
  <div class="tp-church">갈릴리교회</div>
</section>

<section class="copyright-page">
${copyrightLines}
</section>

${prefaceHtml}

<nav class="book-toc">
  <h2>차 례</h2>
  <ol>
${toc}
  </ol>
</nav>

${chapterHtml}

${BOOK_SCRIPTS}
</body>
</html>`;
}
