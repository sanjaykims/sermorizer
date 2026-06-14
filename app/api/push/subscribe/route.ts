/* POST /api/push/subscribe — store a Web Push subscription for the signed-in
   user so the server can notify them when a summary/translation finishes,
   even with the app closed. Session-gated. */

import { requireSessionOrUnauthorized } from "@/lib/auth/server";
import { supabaseAdminAvailable } from "@/lib/supabase-server";
import { savePushSubscription } from "@/lib/push";

export const runtime = "nodejs";

type Body = {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
};

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
  const s = body.subscription;
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth) {
    return Response.json({ error: "Incomplete push subscription." }, { status: 400 });
  }
  try {
    await savePushSubscription({
      endpoint: s.endpoint,
      p256dh: s.keys.p256dh,
      auth: s.keys.auth,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not save subscription." },
      { status: 500 },
    );
  }
}
