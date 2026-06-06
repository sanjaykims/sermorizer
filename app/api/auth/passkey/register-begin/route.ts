/* POST /api/auth/passkey/register-begin — kick off passkey enrollment for the
   currently signed-in user. The challenge is stored in a signed, short-lived
   cookie so the finish call can verify it. */

import {
  requireSessionOrUnauthorized,
  rpInfoFrom,
  setChallengeCookie,
} from "@/lib/auth/server";
import { startRegistration } from "@/lib/auth/webauthn";
import { supabaseAdminAvailable } from "@/lib/supabase-server";

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

  try {
    const { rpID } = rpInfoFrom(req.url);
    const options = await startRegistration(rpID);
    await setChallengeCookie({ purpose: "register", challenge: options.challenge });
    return Response.json({ options });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not begin passkey setup." },
      { status: 500 },
    );
  }
}
