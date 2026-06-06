/* POST /api/auth/passcode — verify the passcode and issue a session cookie. */

import { getAuthConfig, setSessionCookie } from "@/lib/auth/server";
import { verifyPasscode } from "@/lib/auth/crypto";
import { supabaseAdminAvailable } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  if (!supabaseAdminAvailable()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 },
    );
  }
  let body: { passcode?: string };
  try {
    body = (await req.json()) as { passcode?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const passcode = (body.passcode ?? "").trim();
  if (!passcode) {
    return Response.json({ error: "Enter your passcode." }, { status: 400 });
  }
  try {
    const cfg = await getAuthConfig();
    if (!cfg.passcode_hash || !cfg.passcode_salt) {
      return Response.json(
        { error: "No passcode has been set yet — finish setup first." },
        { status: 409 },
      );
    }
    const ok = await verifyPasscode(passcode, cfg.passcode_hash, cfg.passcode_salt);
    if (!ok) {
      return Response.json({ error: "That passcode didn't match." }, { status: 401 });
    }
    await setSessionCookie();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Sign-in failed." },
      { status: 500 },
    );
  }
}
