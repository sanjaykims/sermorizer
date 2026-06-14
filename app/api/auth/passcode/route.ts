/* POST /api/auth/passcode — verify the passcode and issue a session cookie. */

import { getAuthConfig, setSessionCookie } from "@/lib/auth/server";
import { verifyPasscode } from "@/lib/auth/crypto";
import { supabaseAdminAvailable } from "@/lib/supabase-server";

export const runtime = "nodejs";

// Lightweight in-memory brute-force throttle. Per warm Lambda instance, so it's
// not a hard guarantee on serverless, but it adds real friction to a guessing
// loop on top of scrypt's slowness. Keyed by client IP.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const attempts = new Map<string, { count: number; first: number }>();

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0] : "").trim() || "unknown";
}

function tooMany(ip: string): boolean {
  const a = attempts.get(ip);
  if (!a) return false;
  if (Date.now() - a.first > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return a.count >= MAX_FAILS;
}

function recordFail(ip: string): void {
  const a = attempts.get(ip);
  if (!a || Date.now() - a.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: Date.now() });
  } else {
    a.count += 1;
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!supabaseAdminAvailable()) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
      { status: 503 },
    );
  }
  const ip = clientIp(req);
  if (tooMany(ip)) {
    return Response.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 },
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
      recordFail(ip);
      return Response.json({ error: "That passcode didn't match." }, { status: 401 });
    }
    attempts.delete(ip);
    await setSessionCookie();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Sign-in failed." },
      { status: 500 },
    );
  }
}
