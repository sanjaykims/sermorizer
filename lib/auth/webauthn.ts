/* WebAuthn (passkey) server helpers — wraps @simplewebauthn/server and our
   passkeys table. */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { getSupabaseAdmin } from "../supabase-server";
import { getAuthConfig } from "./server";

const RP_NAME = "Sermorizer";

type AuthenticatorTransport =
  | "ble"
  | "cable"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb";

type StoredPasskey = {
  id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: AuthenticatorTransport[] | null;
  device_label: string | null;
};

async function listPasskeys(): Promise<StoredPasskey[]> {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("passkeys")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as StoredPasskey[];
}

export async function hasAnyPasskey(): Promise<boolean> {
  return (await listPasskeys()).length > 0;
}

export async function deletePasskey(credentialId: string): Promise<void> {
  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from("passkeys")
    .delete()
    .eq("credential_id", credentialId);
  if (error) throw new Error(error.message);
}

export async function startRegistration(rpID: string) {
  const cfg = await getAuthConfig();
  const existing = await listPasskeys();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(cfg.webauthn_user_id),
    userName: "Sermorizer",
    userDisplayName: "Sermorizer",
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: c.transports ?? undefined,
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
  });
  return options;
}

export async function finishRegistration(input: {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
  rpID: string;
  origin: string;
  deviceLabel?: string;
}): Promise<{ credentialId: string }> {
  const verification = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: input.origin,
    expectedRPID: input.rpID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration failed verification.");
  }
  const { credential } = verification.registrationInfo;
  const supa = getSupabaseAdmin();
  const { error } = await supa.from("passkeys").insert({
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString("base64"),
    counter: credential.counter,
    transports: credential.transports ?? null,
    device_label: input.deviceLabel ?? "Phone",
  });
  if (error) throw new Error(error.message);
  return { credentialId: credential.id };
}

export async function startAuthentication(rpID: string) {
  const existing = await listPasskeys();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: c.transports ?? undefined,
    })),
    userVerification: "required",
  });
  return options;
}

export async function finishAuthentication(input: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  rpID: string;
  origin: string;
}): Promise<void> {
  const supa = getSupabaseAdmin();
  const lookup = await supa
    .from("passkeys")
    .select("*")
    .eq("credential_id", input.response.id)
    .maybeSingle();
  if (lookup.error) throw new Error(lookup.error.message);
  if (!lookup.data) throw new Error("Unknown credential.");
  const stored = lookup.data as StoredPasskey;

  const verification = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: input.origin,
    expectedRPID: input.rpID,
    requireUserVerification: true,
    credential: {
      id: stored.credential_id,
      publicKey: new Uint8Array(Buffer.from(stored.public_key, "base64")),
      counter: Number(stored.counter ?? 0),
      transports: stored.transports ?? undefined,
    },
  });
  if (!verification.verified) {
    throw new Error("Login failed verification.");
  }
  await supa
    .from("passkeys")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("credential_id", input.response.id);
}
