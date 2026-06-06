/* POST /api/auth/passkey/login-finish — verify a fingerprint assertion and,
   on success, mint a session cookie. */

import {
  clearChallengeCookie,
  readChallengeCookie,
  rpInfoFrom,
  setSessionCookie,
} from "@/lib/auth/server";
import { finishAuthentication } from "@/lib/auth/webauthn";
import { supabaseAdminAvailable } from "@/lib/supabase-server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  if (!supabaseAdminAvailable()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 },
    );
  }
  let body: { response?: AuthenticationResponseJSON };
  try {
    body = (await req.json()) as { response?: AuthenticationResponseJSON };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.response) {
    return Response.json({ error: "Missing assertion response." }, { status: 400 });
  }
  const chal = await readChallengeCookie();
  if (!chal || chal.purpose !== "login") {
    return Response.json(
      { error: "Your sign-in session expired. Please tap fingerprint again." },
      { status: 400 },
    );
  }

  try {
    const { rpID, origin } = rpInfoFrom(req.url);
    await finishAuthentication({
      response: body.response,
      expectedChallenge: chal.challenge,
      rpID,
      origin,
    });
    await clearChallengeCookie();
    await setSessionCookie();
    return Response.json({ ok: true });
  } catch (e) {
    await clearChallengeCookie();
    return Response.json(
      { error: e instanceof Error ? e.message : "Fingerprint login failed." },
      { status: 401 },
    );
  }
}
