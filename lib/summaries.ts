/* Client-side summaries helpers. The browser never talks to Supabase directly
   any more — every call goes through an authenticated API route that uses the
   server-side service-role client. The session cookie travels automatically. */

import type { JobStatus, Lang, Summary } from "./types";

export type { JobStatus, Lang, Summary };

/** Always available — the browser uses the API, which is gated server-side. */
export function cloudEnabled(): boolean {
  return true;
}

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
  if (!res.ok) {
    let msg = `Request failed (HTTP ${res.status}).`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function cloudList(): Promise<Summary[]> {
  try {
    const { summaries } = await api<{ summaries: Summary[] }>("/api/summaries");
    return summaries;
  } catch {
    return [];
  }
}

export async function cloudGet(id: string): Promise<Summary | null> {
  try {
    const { summary } = await api<{ summary: Summary | null }>(
      `/api/summaries/${encodeURIComponent(id)}`,
    );
    return summary;
  } catch {
    return null;
  }
}

export async function cloudUpdate(
  id: string,
  patch: {
    docs?: Partial<Record<Lang, string>>;
    title?: string;
    status?: JobStatus;
    error?: string | null;
    parts?: Record<string, string>;
  },
): Promise<void> {
  await api<{ ok: true }>(`/api/summaries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function cloudDelete(id: string): Promise<void> {
  await api<{ ok: true }>(`/api/summaries/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
