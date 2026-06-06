/* Auth helpers: read/write the singleton auth_config row, validate session
   cookies, and expose helpers for routes to gate requests. */

import { cookies } from "next/headers";
import { getSupabaseAdmin } from "../supabase-server";
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

/** Read (and lazily initialise) the singleton auth_config row. */
export async function getAuthConfig(): Promise<AuthConfig> {
  const supa = getSupabaseAdmin();
  const existing = await supa
    .from("auth_config")
    .select("*")
    .eq("id", "singleton")
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    // Backfill webauthn_user_id if a pre-migration row exists without it.
    if (!existing.data.webauthn_user_id) {
      const userId = newRandomId(16);
      const upd = await supa
        .from("auth_config")
        .update({ webauthn_user_id: userId })
        .eq("id", "singleton")
        .select()
        .single();
      if (upd.error) throw new Error(upd.error.message);
      return upd.data as AuthConfig;
    }
    return existing.data as AuthConfig;
  }
  const fresh = {
    id: "singleton",
    session_secret: newSecret(),
    webauthn_user_id: newRandomId(16),
  };
  const insert = await supa.from("auth_config").insert(fresh).select().single();
  if (insert.error) throw new Error(insert.error.message);
  return insert.data as AuthConfig;
}

/** Has the install been set up (at least a passcode configured)? */
export async function isSetupComplete(): Promise<boolean> {
  const c = await getAuthConfig();
  return Boolean(c.passcode_hash && c.passcode_salt);
}

export async function persistPasscode(hash: string, salt: string): Promise<void> {
  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from("auth_config")
    .update({
      passcode_hash: hash,
      passcode_salt: salt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "singleton");
  if (error) throw new Error(error.message);
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
  return verifyToken<SessionPayload>(cfg.session_secret, c);
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
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
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
    sameSite: "lax",
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
    sameSite: "lax",
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
