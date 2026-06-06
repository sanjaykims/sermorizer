/* GET /api/auth/status — what the AuthGate needs to decide which screen to show:
   whether a passcode has ever been set, whether the request is authenticated,
   and whether a passkey is available for fingerprint login. */

import { isSetupComplete, readSession } from "@/lib/auth/server";
import { hasAnyPasskey } from "@/lib/auth/webauthn";
import { supabaseAdminAvailable, withSupabaseRetry } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  if (!supabaseAdminAvailable()) {
    return Response.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Set it in Vercel project settings.",
      },
      { status: 503 },
    );
  }
  try {
    // Retry-once wrapper hides a brief cold-start clock skew between the
    // Vercel Lambda and Supabase that can otherwise surface as "JWT issued
    // at future" on the AuthGate's very first call.
    const [setup, session, passkey] = await withSupabaseRetry(() =>
      Promise.all([isSetupComplete(), readSession(), hasAnyPasskey()]),
    );
    return Response.json({
      setup,
      authed: Boolean(session),
      hasPasskey: passkey,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Status check failed." },
      { status: 500 },
    );
  }
}
