/* POST /api/push/unsubscribe — remove a stored Web Push subscription. */

import { requireSessionOrUnauthorized } from "@/lib/auth/server";
import { supabaseAdminAvailable } from "@/lib/supabase-server";
import { deletePushSubscription } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  if (!supabaseAdminAvailable()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 },
    );
  }
  const guard = await requireSessionOrUnauthorized();
  if (guard) return guard;

  let endpoint = "";
  try {
    endpoint = ((await req.json()) as { endpoint?: string }).endpoint ?? "";
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!endpoint) return Response.json({ error: "Missing endpoint." }, { status: 400 });
  try {
    await deletePushSubscription(endpoint);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not remove subscription." },
      { status: 500 },
    );
  }
}
