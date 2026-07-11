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
import { detectLang, parseFilename, importGroupKey } from "@/lib/import-parse";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
// Up to 200 sequential inserts; 60s risked a mid-loop kill (leaving a partial
// import that duplicates on re-upload). 300s gives comfortable headroom.
export const maxDuration = 300;

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
  // own group (keyed by filename).
  const groupKey = importGroupKey(filename, date);
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
    // If this date-group already holds this language, the incoming file is a
    // DIFFERENT same-day sermon (e.g. a morning and an evening service), not a
    // translation of the same one — give it its own group instead of silently
    // dropping it. (KO/EN/ZH of ONE sermon still merge, since they occupy
    // different language slots.)
    let key = p.groupKey;
    for (let i = 1; groups.get(key)?.docs[p.lang]; i++) key = `${p.groupKey}#${i}`;
    const g = groups.get(key) ?? { docs: {} };
    g.docs[p.lang] = p.html;
    // Prefer the Korean entry's title/occasion; otherwise fall back to whatever
    // we have. The "ko" file's values are canonical for the sermon.
    if (!g.title || p.lang === "ko") g.title = p.title;
    if (!g.date && p.date) g.date = p.date;
    if ((!g.occasion || p.lang === "ko") && p.occasion) g.occasion = p.occasion;
    groups.set(key, g);
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
