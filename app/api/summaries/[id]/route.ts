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

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const guard = await gate();
  if (guard) return guard;
  try {
    const { id } = await ctx.params;
    const patch = (await req.json()) as PatchBody;
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
