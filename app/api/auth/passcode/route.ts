/* POST /api/auth/passcode — verify the passcode and issue a session cookie. */

import { getAuthConfig, setSessionCookie } from "@/lib/auth/server";
import { verifyPasscode } from "@/lib/auth/crypto";
import {
  getSupabaseAdmin,
  supabaseAdminAvailable,
  withSupabaseRetry,
} from "@/lib/supabase-server";

export const runtime = "nodejs";

// Cross-instance brute-force throttle. The bump_auth_attempt SQL function
// keeps a per-IP counter in Supabase so an attacker can't bypass an
// in-memory limit by hitting a cold Lambda or different Vercel region.
const MAX_FAILS = 10;

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0] : "").trim() || "unknown";
}

async function bumpAttempt(ip: string): Promise<number> {
  return withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa.rpc("bump_auth_attempt", { p_ip: ip });
    if (error) throw new Error(error.message);
    return typeof data === "number" ? data : 0;
  });
}

async function clearAttempt(ip: string): Promise<void> {
  try {
    await withSupabaseRetry(async () => {
      const supa = getSupabaseAdmin();
      await supa.rpc("clear_auth_attempt", { p_ip: ip });
    });
  } catch {
    /* clearing is best-effort */
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
      // Bump *after* the scrypt verify so the timing channel is identical for
      // every wrong passcode, and the lockout only counts real failures.
      let count = 0;
      try {
        count = await bumpAttempt(ip);
      } catch {
        /* if the DB throttle is unavailable, fall through to a plain 401 */
      }
      if (count >= MAX_FAILS) {
        return Response.json(
          { error: "Too many attempts. Please wait a few minutes and try again." },
          { status: 429 },
        );
      }
      return Response.json({ error: "That passcode didn't match." }, { status: 401 });
    }
    await clearAttempt(ip);
    await setSessionCookie();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Sign-in failed." },
      { status: 500 },
    );
  }
}
