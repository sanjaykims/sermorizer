/* Auth helpers: read/write the singleton auth_config row, validate session
   cookies, and expose helpers for routes to gate requests. */

import { cookies } from "next/headers";
import { getSupabaseAdmin, withSupabaseRetry } from "../supabase-server";
import { newSecret, newRandomId, signToken, verifyToken } from "./session";

export const SESSION_COOKIE = "sermorizer_session";
export const CHALLENGE_COOKIE = "sermorizer_chal";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const CHALLENGE_TTL_SECONDS = 5 * 60; // 5 minutes

const isProd = () => process.env.NODE_ENV === "production";

export type AuthConfig = {
  id: "singleton";
  passcode_hash: string | null;
  passcode_salt: string | null;
  session_secret: string;
  webauthn_user_id: string;
  created_at: string;
  updated_at: string;
};

/** Read (and lazily initialise) the singleton auth_config row. Wrapped in
 *  withSupabaseRetry so a cold-start clock skew on the very first gated
 *  request doesn't spuriously 500. */
export async function getAuthConfig(): Promise<AuthConfig> {
  return withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const existing = await supa
      .from("auth_config")
      .select("*")
      .eq("id", "singleton")
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      // Backfill webauthn_user_id if a pre-migration row lacks it. The
      // conditional update (.is null) only writes when still empty, so two
      // concurrent requests can't both win — we then re-read to return
      // whichever value actually landed.
      if (!existing.data.webauthn_user_id) {
        const userId = newRandomId(16);
        const upd = await supa
          .from("auth_config")
          .update({ webauthn_user_id: userId })
          .eq("id", "singleton")
          .is("webauthn_user_id", null);
        if (upd.error) throw new Error(upd.error.message);
        const re = await supa
          .from("auth_config")
          .select("*")
          .eq("id", "singleton")
          .single();
        if (re.error) throw new Error(re.error.message);
        return re.data as AuthConfig;
      }
      return existing.data as AuthConfig;
    }
    const fresh = {
      id: "singleton",
      session_secret: newSecret(),
      webauthn_user_id: newRandomId(16),
    };
    // Use upsert(ignoreDuplicates) so concurrent first-time requests don't
    // collide on the singleton primary-key. If we lose the race the insert
    // returns no row — fall back to selecting the winner's row.
    const insert = await supa
      .from("auth_config")
      .upsert(fresh, { onConflict: "id", ignoreDuplicates: true })
      .select()
      .maybeSingle();
    if (insert.error) throw new Error(insert.error.message);
    if (insert.data) return insert.data as AuthConfig;
    const after = await supa
      .from("auth_config")
      .select("*")
      .eq("id", "singleton")
      .single();
    if (after.error) throw new Error(after.error.message);
    return after.data as AuthConfig;
  });
}

/** Has the install been set up (at least a passcode configured)? */
export async function isSetupComplete(): Promise<boolean> {
  const c = await getAuthConfig();
  return Boolean(c.passcode_hash && c.passcode_salt);
}

export async function persistPasscode(hash: string, salt: string): Promise<void> {
  const supa = getSupabaseAdmin();
  // Atomic first-run guard: only write when no passcode is set yet
  // (passcode_hash IS NULL). This closes the check-then-act race between two
  // concurrent first-run setups and prevents the setup route from silently
  // overwriting an existing passcode. A deliberate reset (DB sets the hash back
  // to null) re-enables setup, as intended.
  const { data, error } = await supa
    .from("auth_config")
    .update({
      passcode_hash: hash,
      passcode_salt: salt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "singleton")
    .is("passcode_hash", null)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("A passcode is already set. Sign in instead.");
  }
}

export type SessionPayload = { kind: "session"; authedAt: number };
export type ChallengePayload = {
  kind: "challenge";
  purpose: "register" | "login";
  challenge: string;
};

export async function readSession(): Promise<SessionPayload | null> {
  const cfg = await getAuthConfig();
  const c = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!c) return null;
  const payload = verifyToken<SessionPayload>(cfg.session_secret, c);
  // Verify kind, not just the signature: a signature-valid challenge token
  // (also signed with session_secret) must not be accepted as a session, or
  // /api/auth/status would report authed:true for an unauthenticated caller.
  return payload && payload.kind === "session" ? payload : null;
}

export async function setSessionCookie(): Promise<void> {
  const cfg = await getAuthConfig();
  const token = signToken<SessionPayload>(
    cfg.session_secret,
    { kind: "session", authedAt: Date.now() },
    SESSION_TTL_SECONDS,
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function setChallengeCookie(payload: Omit<ChallengePayload, "kind">): Promise<void> {
  const cfg = await getAuthConfig();
  const token = signToken<ChallengePayload>(
    cfg.session_secret,
    { kind: "challenge", ...payload },
    CHALLENGE_TTL_SECONDS,
  );
  (await cookies()).set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "strict",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

export async function readChallengeCookie(): Promise<ChallengePayload | null> {
  const cfg = await getAuthConfig();
  const c = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!c) return null;
  return verifyToken<ChallengePayload>(cfg.session_secret, c);
}

export async function clearChallengeCookie(): Promise<void> {
  (await cookies()).set(CHALLENGE_COOKIE, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

/** Used by API routes: require a valid session or return a 401 Response. */
export async function requireSessionOrUnauthorized(): Promise<Response | null> {
  const s = await readSession();
  if (s && s.kind === "session") return null;
  return Response.json({ error: "Not authenticated." }, { status: 401 });
}

/** Resolve the WebAuthn relying party from the request URL. */
export function rpInfoFrom(reqUrl: string): { rpID: string; origin: string } {
  const u = new URL(reqUrl);
  return { rpID: u.hostname, origin: u.origin };
}
