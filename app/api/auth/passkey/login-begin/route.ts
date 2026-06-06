/* POST /api/auth/passkey/login-begin — fetch a challenge for fingerprint login.
   Open to unauthenticated callers (that's the whole point), but only useful
   when at least one passkey has been enrolled. */

import { rpInfoFrom, setChallengeCookie } from "@/lib/auth/server";
import { hasAnyPasskey, startAuthentication } from "@/lib/auth/webauthn";
import { supabaseAdminAvailable } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  if (!supabaseAdminAvailable()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 },
    );
  }
  try {
    if (!(await hasAnyPasskey())) {
      return Response.json(
        { error: "No passkey is enrolled on this app yet." },
        { status: 409 },
      );
    }
    const { rpID } = rpInfoFrom(req.url);
    const options = await startAuthentication(rpID);
    await setChallengeCookie({ purpose: "login", challenge: options.challenge });
    return Response.json({ options });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not begin fingerprint login." },
      { status: 500 },
    );
  }
}
