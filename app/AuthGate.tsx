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

type Status = {
  setup: boolean;
  authed: boolean;
  hasPasskey: boolean;
};

type Phase = "loading" | "config" | "setup" | "login" | "authed";

async function api<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err =
      (payload as { error?: string } | null)?.error ??
      `Request failed (HTTP ${res.status}).`;
    throw new Error(err);
  }
  return payload as T;
}

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
          <p className="auth-sub">The server isn&apos;t set up yet.</p>
          <p className="auth-err">{error ?? "Status check failed."}</p>
          <p className="auth-hint">
            Set <code>SUPABASE_SERVICE_ROLE_KEY</code> in the Vercel project
            settings and redeploy, then reload this page.
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
              👆 Sign in with fingerprint
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="session-bar">
      <span className="session-tag">🔒 Signed in</span>
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
