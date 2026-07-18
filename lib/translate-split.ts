/* Splits a generated Korean sermon-summary HTML document into independently
   translatable pieces, and reassembles the translated pieces into one
   document. This lets translation of a long (or long, stitched multi-part)
   document run as several bounded, parallel model calls instead of one huge
   pass that risks truncating past the output-token cap and the function's
   300s time limit.

   The <head> (styles, fonts) never goes through the model: the two Korean
   font families the generation prompts always use are swapped deterministically
   for the target language's pairing, and <title> is copied from the
   translated first heading. Only the <body> content needs an LLM — it's the
   only place with human-readable text to translate. This also means every
   translation (long or short) skips reproducing the sermon's (often several
   KB) <style> block, which the old whole-document approach paid for on every
   call. */

import { parse, HTMLElement, NodeType } from "node-html-parser";

export type SplitTranslationDoc = {
  /** Raw <head>...</head> outerHTML from the source document (untranslated). */
  headHtml: string;
  /** The source <html ...> tag's attribute string (e.g. `lang="ko"`). */
  htmlRawAttrs: string;
  /** The source <body ...> tag's attribute string (e.g. `class="sermon-paper"`). */
  bodyRawAttrs: string;
  /** Body content split into 1+ HTML fragments — each a run of the body's
   *  top-level element children, bounded by MAX_CHUNK_CHARS. */
  chunks: string[];
};

// Each chunk becomes one independent translation call. Bounded so a chunk's
// translated output — roughly the same order of magnitude as its input,
// since this is fragment translation, not full-document reproduction —
// finishes comfortably inside the 300s function limit even when several
// chunks run concurrently.
const MAX_CHUNK_CHARS = 9000;

/** Parse a generated summary document into a head/body split, ready to
 *  translate the body in independent chunks. */
export function splitHtmlForTranslation(html: string): SplitTranslationDoc {
  const root = parse(html);
  const htmlEl = root.querySelector("html");
  const headEl = root.querySelector("head");
  const bodyEl = root.querySelector("body");
  if (!bodyEl) {
    throw new Error("Source document has no <body> to translate.");
  }

  const headHtml = headEl ? headEl.outerHTML : "<head></head>";
  const htmlRawAttrs = htmlEl?.rawAttrs ?? "";
  const bodyRawAttrs = bodyEl.rawAttrs ?? "";

  const elementChildren = bodyEl.childNodes.filter(
    (n): n is HTMLElement => n.nodeType === NodeType.ELEMENT_NODE,
  );
  const pieces =
    elementChildren.length > 0 ? elementChildren.map((el) => el.outerHTML) : [bodyEl.innerHTML];

  const chunks: string[] = [];
  let cur = "";
  for (const piece of pieces) {
    if (cur && cur.length + piece.length > MAX_CHUNK_CHARS) {
      chunks.push(cur);
      cur = piece;
    } else {
      cur += piece;
    }
  }
  if (cur) chunks.push(cur);
  if (chunks.length === 0) chunks.push("");

  return { headHtml, htmlRawAttrs, bodyRawAttrs, chunks };
}

/** Font pairing per target language — mirrors the translation rule in CLAUDE.md. */
const FONT_SWAP: Record<
  "en" | "zh",
  { importUrl: string; displayName: string; bodyName: string }
> = {
  // English keeps the Hearth Latin faces: Newsreader (display) + Geist (body).
  en: {
    importUrl:
      "@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..600&family=Geist:wght@300..700&family=Geist+Mono:wght@400..600&display=swap');",
    displayName: "'Newsreader'",
    bodyName: "'Geist'",
  },
  // Chinese swaps Hangul for the Simplified-Chinese Noto pair, keeping the
  // Hearth Latin/mono faces for numerals and Latin fragments.
  zh: {
    importUrl:
      "@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..600&family=Geist:wght@300..700&family=Geist+Mono:wght@400..600&family=Noto+Serif+SC:wght@400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap');",
    displayName: "'Noto Serif SC'",
    bodyName: "'Noto Sans SC'",
  },
};
// The Korean companion faces the Hearth stylesheet pairs with the Latin fonts:
// Nanum Myeongjo (display) + Noto Sans KR (body). Also match the pre-Hearth
// pairing (Gowun Batang + Noto Serif KR) so translating an older, already-stored
// summary still swaps its fonts. Match quoted or not, with an optional "+".
const KOREAN_DISPLAY_FONT = /['"]?(?:Nanum\s*\+?\s*Myeongjo|Gowun\s*\+?\s*Batang)['"]?/gi;
const KOREAN_BODY_FONT = /['"]?Noto\s*\+?\s*(?:Sans|Serif)\s*\+?\s*KR['"]?/gi;

/** Deterministically swap the Korean font @import + font-family declarations
 *  for the target language's pairing. Regex-based (matching this codebase's
 *  existing tag-detection style in lib/enhance.ts) rather than a full CSS
 *  parse — cheap, and font names never appear inside sermon prose. */
function swapFonts(headHtml: string, lang: "en" | "zh"): string {
  const swap = FONT_SWAP[lang];
  const importRe = /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com[^)]*\)\s*;?/i;
  let out = importRe.test(headHtml)
    ? headHtml.replace(importRe, swap.importUrl)
    : headHtml.replace(/<style([^>]*)>/i, `<style$1>${swap.importUrl}\n`);
  out = out.replace(KOREAN_DISPLAY_FONT, swap.displayName);
  out = out.replace(KOREAN_BODY_FONT, swap.bodyName);
  return out;
}

function withLang(rawAttrs: string, lang: "en" | "zh"): string {
  if (/\blang\s*=/i.test(rawAttrs)) {
    return rawAttrs.replace(/\blang\s*=\s*["'][^"']*["']/i, `lang="${lang}"`);
  }
  return (rawAttrs ? rawAttrs + " " : "") + `lang="${lang}"`;
}

/** Pull the translated document's title from its first heading, so the
 *  browser tab title is translated too without a dedicated model call. */
function extractTitleText(translatedBodyHtml: string): string | null {
  const m =
    translatedBodyHtml.match(/class="[^"]*\bh-title\b[^"]*"[^>]*>([^<]+)</i) ??
    translatedBodyHtml.match(/<h1[^>]*>([^<]+)</i);
  return m ? m[1].trim() : null;
}

/** Reassemble the split document from its translated body chunks (in order). */
export function reassembleTranslatedHtml(
  doc: SplitTranslationDoc,
  lang: "en" | "zh",
  translatedChunks: string[],
): string {
  const translatedBody = translatedChunks.join("\n");
  const head = swapFonts(doc.headHtml, lang);
  const title = extractTitleText(translatedBody);
  const headWithTitle = title
    ? head.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
    : head;
  const htmlOpen = `<html ${withLang(doc.htmlRawAttrs, lang)}>`;
  const bodyOpen = doc.bodyRawAttrs ? `<body ${doc.bodyRawAttrs}>` : "<body>";
  return `<!DOCTYPE html>\n${htmlOpen}\n${headWithTitle}\n${bodyOpen}\n${translatedBody}\n</body>\n</html>`;
}
