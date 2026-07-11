"use client";

/* Auth gate. Sits in front of the app and shows one of three screens until the
   user has a valid session cookie:
   - Misconfigured (server is missing SUPABASE_SERVICE_ROLE_KEY)
   - Setup (no passcode set yet — choose one)
   - Sign in (passcode and, if enrolled, fingerprint)
   On a valid session it just renders the wrapped app. */

import { useCallback, useEffect, useState } from "react";
import {
  startAuthentication as browserStartAuth,
  startRegistration as browserStartReg,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { apiFetch as api } from "@/lib/api";

/* ---- Inline icons (replace emoji glyphs; tinted via currentColor) ---- */
function IconFingerprint() {
  return (
    <svg
      className="ico"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M2 16h.01" />
      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg
      className="ico"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

type Status = {
  setup: boolean;
  authed: boolean;
  hasPasskey: boolean;
};

type Phase = "loading" | "config" | "setup" | "login" | "authed";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api<Status>("/api/auth/status");
      setStatus(s);
      if (s.authed) setPhase("authed");
      else if (!s.setup) setPhase("setup");
      else setPhase("login");
      setError(null);
    } catch (e) {
      setStatus(null);
      setPhase("config");
      setError(e instanceof Error ? e.message : "Could not reach the server.");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  if (phase === "loading") {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Sermorizer</h1>
          <p className="auth-sub">Checking sign-in…</p>
        </div>
      </div>
    );
  }
  if (phase === "config") {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Sermorizer</h1>
          <p className="auth-sub">Couldn&apos;t reach the server.</p>
          <p className="auth-err">{error ?? "Status check failed."}</p>
          <button
            type="button"
            className="auth-btn auth-btn-primary"
            onClick={() => {
              setPhase("loading");
              void refreshStatus();
            }}
          >
            Try again
          </button>
          <p className="auth-hint">
            If this keeps happening, set <code>SUPABASE_SERVICE_ROLE_KEY</code> in
            the Vercel project settings and redeploy. A brief hiccup right after
            a deploy usually clears on retry.
          </p>
        </div>
      </div>
    );
  }
  if (phase === "setup") {
    return <SetupScreen onDone={() => void refreshStatus()} />;
  }
  if (phase === "login") {
    return (
      <LoginScreen
        hasPasskey={status?.hasPasskey ?? false}
        onDone={() => void refreshStatus()}
      />
    );
  }
  return (
    <>
      <SessionBar
        hasPasskey={status?.hasPasskey ?? false}
        onChanged={() => void refreshStatus()}
      />
      {children}
    </>
  );
}

/* ---------- Setup screen (first-run) ---------- */

function SetupScreen({ onDone }: { onDone: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (passcode.length < 6) {
      setErr("Choose a passcode of at least 6 characters.");
      return;
    }
    if (passcode !== confirm) {
      setErr("The two passcodes don't match.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/setup", { method: "POST", body: { passcode } });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>Sermorizer</h1>
        <p className="auth-sub">
          First time here — choose a passcode to protect your sermon library.
        </p>
        <label className="auth-label">New passcode</label>
        <input
          className="auth-input"
          type="password"
          inputMode="text"
          autoComplete="new-password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="At least 6 characters"
          autoFocus
        />
        <label className="auth-label">Confirm passcode</label>
        <input
          className="auth-input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type it again"
        />
        {err && <p className="auth-err">{err}</p>}
        <button type="submit" className="auth-btn auth-btn-primary" disabled={busy}>
          {busy ? "Setting up…" : "Set passcode and continue"}
        </button>
        <p className="auth-hint">
          You&apos;ll be able to add fingerprint sign-in after this.
        </p>
      </form>
    </div>
  );
}

/* ---------- Login screen ---------- */

function LoginScreen({
  hasPasskey,
  onDone,
}: {
  hasPasskey: boolean;
  onDone: () => void;
}) {
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitPasscode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!passcode) {
      setErr("Enter your passcode.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/passcode", {
        method: "POST",
        body: { passcode },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPasskey() {
    setErr(null);
    setBusy(true);
    try {
      const { options } = await api<{
        options: PublicKeyCredentialRequestOptionsJSON;
      }>("/api/auth/passkey/login-begin", { method: "POST" });
      const assertion = await browserStartAuth({ optionsJSON: options });
      await api("/api/auth/passkey/login-finish", {
        method: "POST",
        body: { response: assertion },
      });
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fingerprint login failed.";
      // The browser throws "NotAllowedError" when the user cancels or no
      // credential is available — phrase that more kindly.
      setErr(
        /NotAllowedError|cancelled|cancel/i.test(msg)
          ? "Fingerprint sign-in was cancelled. Try again, or use your passcode."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Sermorizer</h1>
        <p className="auth-sub">Sign in to your sermon library.</p>

        {hasPasskey && (
          <>
            <button
              type="button"
              className="auth-btn auth-btn-primary"
              disabled={busy}
              onClick={loginWithPasskey}
            >
              <IconFingerprint /> Sign in with fingerprint
            </button>
            <div className="auth-divider">
              <span>or</span>
            </div>
          </>
        )}

        <form onSubmit={submitPasscode}>
          <label className="auth-label">Passcode</label>
          <input
            className="auth-input"
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Your passcode"
            autoFocus={!hasPasskey}
          />
          {err && <p className="auth-err">{err}</p>}
          <button
            type="submit"
            className={
              hasPasskey ? "auth-btn auth-btn-ghost" : "auth-btn auth-btn-primary"
            }
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in with passcode"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Session bar (small banner once signed in) ---------- */

function SessionBar({
  hasPasskey,
  onChanged,
}: {
  hasPasskey: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function enroll() {
    setBusy(true);
    setMsg(null);
    try {
      const { options } = await api<{
        options: PublicKeyCredentialCreationOptionsJSON;
      }>("/api/auth/passkey/register-begin", { method: "POST" });
      const attestation = await browserStartReg({ optionsJSON: options });
      await api("/api/auth/passkey/register-finish", {
        method: "POST",
        body: {
          response: attestation,
          deviceLabel:
            typeof navigator !== "undefined"
              ? navigator.userAgent.slice(0, 80)
              : undefined,
        },
      });
      setMsg("Fingerprint added. You can sign in with it next time.");
      onChanged();
    } catch (e) {
      const m = e instanceof Error ? e.message : "Could not add a passkey.";
      setMsg(
        /NotAllowedError|cancel/i.test(m)
          ? "Cancelled. Tap “Add fingerprint” to try again."
          : m,
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      onChanged();
    } catch (e) {
      // Surface a failed sign-out instead of swallowing it as an unhandled
      // rejection with no feedback (api() throws on non-2xx/network error).
      setMsg(e instanceof Error ? e.message : "Sign-out failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="session-bar">
      <span className="session-tag"><IconLock /> Signed in</span>
      <span className="session-spacer" />
      {!hasPasskey && (
        <button
          type="button"
          className="session-btn"
          onClick={enroll}
          disabled={busy}
        >
          + Add fingerprint
        </button>
      )}
      <button
        type="button"
        className="session-btn"
        onClick={logout}
        disabled={busy}
      >
        Sign out
      </button>
      {msg && <div className="session-msg">{msg}</div>}
    </div>
  );
}
