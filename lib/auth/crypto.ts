/* Passcode hashing with scrypt (Node built-in — no extra dependency).
   We use a strong cost factor and a per-passcode salt. */

import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 64;

export async function hashPasscode(
  passcode: string,
  saltB64?: string,
): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? Buffer.from(saltB64, "base64") : randomBytes(16);
  const derived = await scryptAsync(passcode.normalize("NFKC"), salt, KEY_LEN);
  return { hash: derived.toString("base64"), salt: salt.toString("base64") };
}

export async function verifyPasscode(
  passcode: string,
  hashB64: string,
  saltB64: string,
): Promise<boolean> {
  try {
    const expected = Buffer.from(hashB64, "base64");
    const salt = Buffer.from(saltB64, "base64");
    const derived = await scryptAsync(passcode.normalize("NFKC"), salt, expected.length);
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
