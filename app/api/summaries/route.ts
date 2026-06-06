/* GET /api/summaries — list. All access is session-gated. */

import { requireSessionOrUnauthorized } from "@/lib/auth/server";
import { listSummariesServer } from "@/lib/summaries-server";
import { supabaseAdminAvailable } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  if (!supabaseAdminAvailable()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 },
    );
  }
  const guard = await requireSessionOrUnauthorized();
  if (guard) return guard;
  try {
    const summaries = await listSummariesServer();
    return Response.json({ summaries });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to list summaries." },
      { status: 500 },
    );
  }
}
