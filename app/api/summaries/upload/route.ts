/* POST /api/summaries/upload — import existing sermon summary HTML files into
   the app. Each item is a (filename, html) pair; the server extracts language
   from <html lang> + filename suffix, title from <h1>/<title>, and date +
   occasion from the filename pattern that CLAUDE.md establishes:

     YYYY-MM-DD-<occasion>-<title>[-EN | -中文版].html

   Files that share the same date prefix are grouped into ONE summary so a
   KO + EN + ZH triple uploaded together becomes one row with all three
   languages. Files without a date prefix get their own row. */

import { parse } from "node-html-parser";
import { requireSessionOrUnauthorized } from "@/lib/auth/server";
import { supabaseAdminAvailable } from "@/lib/supabase-server";
import { insertSummaryServer } from "@/lib/summaries-server";
import { extractHtmlTitle } from "@/lib/util";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Item = { filename?: string; html?: string };
type Body = { items?: Item[] };

const MAX_DOC_HTML = 1_500_000;
const MAX_ITEMS = 200;

type Parsed = {
  filename: string;
  html: string;
  lang: Lang;
  date?: string;
  occasion?: string;
  title: string;
  groupKey: string;
};

/** Detect KO / EN / ZH from filename suffix first, then <html lang> as fallback. */
function detectLang(filename: string, html: string): Lang {
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
  // <html lang="…"> is also reliable when the filename is ambiguous.
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
 *  pattern. Returns whatever it can find — both pieces are optional. */
function parseFilename(filename: string): { date?: string; occasion?: string } {
  const base = filename
    .replace(/\.[Hh][Tt][Mm][Ll]?$/, "")
    // Strip trailing language markers so the occasion segment isn't polluted.
    .replace(/[-_]?中文(?:版)?$/i, "")
    .replace(/[-_]?(?:EN|English|ZH|Chinese)$/i, "");

  const dateMatch = base.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch?.[1];

  // After the date and one separator, occasion is the next dash-separated word.
  let occasion: string | undefined;
  if (date) {
    const rest = base.slice(base.indexOf(date) + date.length).replace(/^[-_]+/, "");
    const occMatch = rest.match(/^([^-_]+)/);
    if (occMatch && occMatch[1].length > 0) occasion = occMatch[1];
  }
  return { date, occasion };
}

/** Pull a friendly title out of the document — preferring <h1> over <title>. */
function bestTitle(html: string, filename: string): string {
  const fromUtil = extractHtmlTitle(html);
  if (fromUtil) return fromUtil;
  try {
    const root = parse(html);
    const h1 = root.querySelector("h1")?.textContent?.trim();
    if (h1) return h1;
    const t = root.querySelector("title")?.textContent?.trim();
    if (t) return t;
  } catch {
    /* ignore */
  }
  return filename.replace(/\.[Hh][Tt][Mm][Ll]?$/, "");
}

function parseItem(it: Item): Parsed | null {
  const filename = (it.filename ?? "").trim();
  const html = (it.html ?? "").trim();
  if (!filename || !html) return null;
  if (html.length > MAX_DOC_HTML) return null;
  if (!html.toLowerCase().includes("<html") && !html.toLowerCase().includes("<!doctype"))
    return null;
  const { date, occasion } = parseFilename(filename);
  const lang = detectLang(filename, html);
  const title = bestTitle(html, filename);
  // Files that share a date prefix merge into one summary row. No date → its
  // own group (use the filename as the unique key).
  const groupKey = date ? `d:${date}` : `f:${filename}`;
  return { filename, html, lang, date, occasion, title, groupKey };
}

export async function POST(req: Request): Promise<Response> {
  if (!supabaseAdminAvailable()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 },
    );
  }
  const guard = await requireSessionOrUnauthorized();
  if (guard) return guard;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return Response.json({ error: "No files to upload." }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return Response.json(
      { error: `Too many files at once (max ${MAX_ITEMS}).` },
      { status: 413 },
    );
  }

  const parsed: Parsed[] = [];
  const skipped: string[] = [];
  for (const it of items) {
    const p = parseItem(it);
    if (p) parsed.push(p);
    else skipped.push(it.filename ?? "(unnamed)");
  }
  if (parsed.length === 0) {
    return Response.json(
      { error: "None of the uploaded files looked like sermon HTML." },
      { status: 400 },
    );
  }

  // Group, then write one row per group with whatever languages are present.
  type Group = {
    docs: Partial<Record<Lang, string>>;
    title?: string;
    date?: string;
    occasion?: string;
  };
  const groups = new Map<string, Group>();
  for (const p of parsed) {
    const g = groups.get(p.groupKey) ?? { docs: {} };
    // Don't overwrite an already-populated language for this group (first
    // wins — typically the Korean file when several upload together).
    if (!g.docs[p.lang]) g.docs[p.lang] = p.html;
    // Prefer the Korean entry's title; otherwise fall back to whatever we
    // have. The "ko" file's title is canonical for the sermon.
    if (!g.title || p.lang === "ko") g.title = p.title;
    if (!g.date && p.date) g.date = p.date;
    if (!g.occasion && p.occasion) g.occasion = p.occasion;
    groups.set(p.groupKey, g);
  }

  const created: { id: string; title: string; langs: Lang[] }[] = [];
  for (const g of groups.values()) {
    try {
      const row = await insertSummaryServer({
        title: g.title ?? "Untitled sermon",
        serviceDate: g.date,
        occasion: g.occasion,
        docs: g.docs,
        status: "done",
      });
      created.push({
        id: row.id,
        title: row.title,
        langs: Object.keys(g.docs) as Lang[],
      });
    } catch (e) {
      skipped.push(
        `${g.title ?? "Untitled"} (${e instanceof Error ? e.message : "insert failed"})`,
      );
    }
  }

  return Response.json({ created, skipped });
}
