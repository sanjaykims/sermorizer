import { describe, it, expect } from "vitest";
import { newSecret, signToken, verifyToken } from "../auth/session";

type P = { kind: "session"; n: number };

describe("session tokens", () => {
  it("round-trips a signed payload", () => {
    const secret = newSecret();
    const tok = signToken<P>(secret, { kind: "session", n: 7 }, 3600);
    const out = verifyToken<P & { iat: number; exp: number }>(secret, tok);
    expect(out?.kind).toBe("session");
    expect(out?.n).toBe(7);
    expect(typeof out?.exp).toBe("number");
  });

  it("rejects a token signed with a different secret", () => {
    const tok = signToken<P>(newSecret(), { kind: "session", n: 1 }, 3600);
    expect(verifyToken(newSecret(), tok)).toBeNull();
  });

  it("rejects a tampered token", () => {
    const secret = newSecret();
    const tok = signToken<P>(secret, { kind: "session", n: 1 }, 3600);
    const [head, sig] = tok.split(".");
    const forged = `${head}x.${sig}`;
    expect(verifyToken(secret, forged)).toBeNull();
  });

  it("rejects an expired token", () => {
    const secret = newSecret();
    const tok = signToken<P>(secret, { kind: "session", n: 1 }, -1);
    expect(verifyToken(secret, tok)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyToken(newSecret(), "not-a-token")).toBeNull();
  });
});
