/* Pure parsing helpers for the "import existing summaries" feature. Kept free
   of any Next/server/DOM dependency so they're cheap to unit-test. The upload
   route composes these with node-html-parser for title extraction. */

import type { Lang } from "./types";

/** Detect KO / EN / ZH from the filename suffix first, then <html lang>. */
export function detectLang(filename: string, html: string): Lang {
  const fn = filename.toLowerCase();
  if (
    fn.endsWith("-en.html") ||
    fn.endsWith("-en.htm") ||
    /[-_ ]english\b/i.test(fn)
  ) {
    return "en";
  }
  if (
    filename.includes("中文") ||
    fn.endsWith("-zh.html") ||
    fn.endsWith("-zh.htm") ||
    fn.endsWith("-zhs.html") ||
    /[-_ ]chinese\b/i.test(fn)
  ) {
    return "zh";
  }
  const m = html.match(/<html[^>]*\blang=["']?([A-Za-z-]+)["']?/i);
  if (m) {
    const t = m[1].toLowerCase();
    if (t.startsWith("en")) return "en";
    if (t.startsWith("zh")) return "zh";
    if (t.startsWith("ko")) return "ko";
  }
  return "ko";
}

/** Pull a YYYY-MM-DD date and the occasion segment from the standard filename
 *  pattern (YYYY-MM-DD-<occasion>-<title>[-EN|-中文版].html). Both optional. */
export function parseFilename(filename: string): {
  date?: string;
  occasion?: string;
} {
  const base = filename
    .replace(/\.[Hh][Tt][Mm][Ll]?$/, "")
    .replace(/[-_]?中文(?:版)?$/i, "")
    .replace(/[-_]?(?:EN|English|ZH|Chinese)$/i, "");

  const dateMatch = base.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch?.[1];

  let occasion: string | undefined;
  if (date) {
    const rest = base.slice(base.indexOf(date) + date.length).replace(/^[-_]+/, "");
    const occMatch = rest.match(/^([^-_]+)/);
    if (occMatch && occMatch[1].length > 0) occasion = occMatch[1];
  }
  return { date, occasion };
}

/** The grouping key that merges a KO/EN/ZH triple sharing a date prefix into
 *  one summary row; date-less files get their own group. */
export function importGroupKey(filename: string, date?: string): string {
  return date ? `d:${date}` : `f:${filename}`;
}
