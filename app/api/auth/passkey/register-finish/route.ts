/* POST /api/auth/passkey/register-finish — verify the attestation and save the
   credential. Still requires an active session — passkeys can only be enrolled
   by someone already signed in (initially via the passcode). */

import {
  clearChallengeCookie,
  readChallengeCookie,
  requireSessionOrUnauthorized,
  rpInfoFrom,
} from "@/lib/auth/server";
import { finishRegistration } from "@/lib/auth/webauthn";
import { supabaseAdminAvailable } from "@/lib/supabase-server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

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

  let body: { response?: RegistrationResponseJSON; deviceLabel?: string };
  try {
    body = (await req.json()) as {
      response?: RegistrationResponseJSON;
      deviceLabel?: string;
    };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.response) {
    return Response.json({ error: "Missing attestation response." }, { status: 400 });
  }
  const chal = await readChallengeCookie();
  if (!chal || chal.purpose !== "register") {
    return Response.json(
      { error: "Your enrollment session expired. Please tap “Add passkey” again." },
      { status: 400 },
    );
  }

  try {
    const { rpID, origin } = rpInfoFrom(req.url);
    const { credentialId } = await finishRegistration({
      response: body.response,
      expectedChallenge: chal.challenge,
      rpID,
      origin,
      deviceLabel: body.deviceLabel,
    });
    await clearChallengeCookie();
    return Response.json({ ok: true, credentialId });
  } catch (e) {
    await clearChallengeCookie();
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not save your passkey." },
      { status: 400 },
    );
  }
}
