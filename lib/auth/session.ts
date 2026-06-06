/* Compact, signed-cookie tokens (HMAC-SHA256). We avoid bringing in a JWT
   library — Node's built-in crypto is enough. */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const padNeeded = (4 - (t.length % 4)) % 4;
  return Buffer.from(t + "=".repeat(padNeeded), "base64");
}

export function newSecret(): string {
  return randomBytes(32).toString("base64");
}

export function newRandomId(bytes = 16): string {
  return b64url(randomBytes(bytes));
}

/** Sign a JSON payload with an HMAC, embedding iat + exp. */
export function signToken<T extends object>(
  secretB64: string,
  payload: T,
  ttlSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const head = b64url(Buffer.from(JSON.stringify(body)));
  const mac = createHmac("sha256", Buffer.from(secretB64, "base64"))
    .update(head)
    .digest();
  return `${head}.${b64url(mac)}`;
}

/** Returns the payload (typed by caller) or null when the token is invalid/expired. */
export function verifyToken<T = unknown>(
  secretB64: string,
  token: string,
): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [head, sig] = parts;

  let expected: Buffer;
  try {
    expected = createHmac("sha256", Buffer.from(secretB64, "base64"))
      .update(head)
      .digest();
  } catch {
    return null;
  }
  let actual: Buffer;
  try {
    actual = fromB64url(sig);
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }
  let payload: { iat?: number; exp?: number };
  try {
    payload = JSON.parse(fromB64url(head).toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof payload.exp === "number" &&
    Math.floor(Date.now() / 1000) > payload.exp
  ) {
    return null;
  }
  return payload as T;
}
