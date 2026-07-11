/* GET / PATCH / DELETE a single summary. All session-gated. */

import { requireSessionOrUnauthorized } from "@/lib/auth/server";
import {
  deleteSummaryServer,
  getSummaryServer,
  updateSummaryServer,
} from "@/lib/summaries-server";
import { supabaseAdminAvailable } from "@/lib/supabase-server";
import type { JobStatus, Lang } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type PatchBody = {
  docs?: Partial<Record<Lang, string>>;
  title?: string;
  status?: JobStatus;
  error?: string | null;
  parts?: Record<string, string>;
};

async function gate(): Promise<Response | null> {
  if (!supabaseAdminAvailable()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 },
    );
  }
  return await requireSessionOrUnauthorized();
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const guard = await gate();
  if (guard) return guard;
  try {
    const { id } = await ctx.params;
    const summary = await getSummaryServer(id);
    return Response.json({ summary });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to load summary." },
      { status: 500 },
    );
  }
}

// Per-language HTML cap — generous for a sermon document, but bounds a
// malicious or buggy client from writing multi-MB blobs.
const MAX_DOC_HTML = 1_500_000;
const ALLOWED_STATUS: ReadonlySet<string> = new Set([
  "generating",
  "translating",
  "done",
  "error",
]);

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const guard = await gate();
  if (guard) return guard;
  try {
    const { id } = await ctx.params;
    const raw = (await req.json()) as Record<string, unknown>;

    // Whitelist fields and validate shapes/sizes — never pass the body straight
    // through to the DB.
    const patch: PatchBody = {};
    if (typeof raw.title === "string") patch.title = raw.title.slice(0, 500);
    if (typeof raw.status === "string" && ALLOWED_STATUS.has(raw.status)) {
      patch.status = raw.status as JobStatus;
    }
    if (raw.error === null || typeof raw.error === "string") {
      patch.error = raw.error === null ? null : (raw.error as string).slice(0, 2000);
    }
    if (raw.docs && typeof raw.docs === "object") {
      const docs: Partial<Record<Lang, string>> = {};
      for (const lang of ["ko", "en", "zh"] as Lang[]) {
        const v = (raw.docs as Record<string, unknown>)[lang];
        if (typeof v === "string") {
          if (v.length > MAX_DOC_HTML) {
            return Response.json(
              { error: `The ${lang} document is too large.` },
              { status: 413 },
            );
          }
          docs[lang] = v;
        }
      }
      // A PATCH sets the whole docs column. Only apply it when at least one
      // language was provided — an empty/keyless docs object would otherwise
      // erase every stored document in one request.
      if (Object.keys(docs).length > 0) patch.docs = docs;
    }
    if (raw.parts && typeof raw.parts === "object") {
      const parts: Record<string, string> = {};
      let total = 0;
      for (const [k, v] of Object.entries(raw.parts as Record<string, unknown>)) {
        if (typeof v === "string") {
          total += v.length;
          parts[k] = v;
        }
      }
      if (total > MAX_DOC_HTML * 4) {
        return Response.json({ error: "Parts payload is too large." }, { status: 413 });
      }
      patch.parts = parts;
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "No valid fields to update." }, { status: 400 });
    }

    await updateSummaryServer(id, patch);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to update summary." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const guard = await gate();
  if (guard) return guard;
  try {
    const { id } = await ctx.params;
    await deleteSummaryServer(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to delete summary." },
      { status: 500 },
    );
  }
}
