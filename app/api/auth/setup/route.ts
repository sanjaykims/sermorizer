/* POST /api/auth/setup — set the initial passcode. Only allowed when no
   passcode exists yet (first-run). Successful setup signs the caller in. */

import {
  isSetupComplete,
  persistPasscode,
  setSessionCookie,
} from "@/lib/auth/server";
import { hashPasscode } from "@/lib/auth/crypto";
import { supabaseAdminAvailable } from "@/lib/supabase-server";

export const runtime = "nodejs";

const MIN_LEN = 6;
const MAX_LEN = 128;

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
  if (passcode.length < MIN_LEN || passcode.length > MAX_LEN) {
    return Response.json(
      { error: `Passcode must be ${MIN_LEN}–${MAX_LEN} characters.` },
      { status: 400 },
    );
  }
  if (await isSetupComplete()) {
    return Response.json(
      { error: "A passcode has already been set. Use sign-in instead." },
      { status: 409 },
    );
  }
  try {
    const { hash, salt } = await hashPasscode(passcode);
    await persistPasscode(hash, salt);
    await setSessionCookie();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Setup failed." },
      { status: 500 },
    );
  }
}
