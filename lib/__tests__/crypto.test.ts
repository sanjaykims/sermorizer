import { describe, it, expect } from "vitest";
import { hashPasscode, verifyPasscode } from "../auth/crypto";

describe("passcode hashing", () => {
  it("verifies the correct passcode", async () => {
    const { hash, salt } = await hashPasscode("hunter2-correct");
    expect(await verifyPasscode("hunter2-correct", hash, salt)).toBe(true);
  });

  it("rejects the wrong passcode", async () => {
    const { hash, salt } = await hashPasscode("hunter2-correct");
    expect(await verifyPasscode("wrong", hash, salt)).toBe(false);
  });

  it("normalizes unicode (NFKC) so equivalent input matches", async () => {
    // "ñ" composed vs decomposed should hash to the same key.
    const composed = "mañana";
    const decomposed = "mañana";
    const { hash, salt } = await hashPasscode(composed);
    expect(await verifyPasscode(decomposed, hash, salt)).toBe(true);
  });

  it("uses a fresh salt each time", async () => {
    const a = await hashPasscode("same");
    const b = await hashPasscode("same");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});
