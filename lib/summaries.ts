/* Client-side summaries helpers. The browser never talks to Supabase directly
   any more — every call goes through an authenticated API route that uses the
   server-side service-role client. The session cookie travels automatically. */

import type { JobStatus, Lang, Summary } from "./types";
import { apiFetch } from "./api";

export type { JobStatus, Lang, Summary };

export async function cloudList(): Promise<Summary[]> {
  try {
    const { summaries } = await apiFetch<{ summaries: Summary[] }>("/api/summaries");
    return summaries;
  } catch {
    return [];
  }
}

export async function cloudGet(id: string): Promise<Summary | null> {
  try {
    const { summary } = await apiFetch<{ summary: Summary | null }>(
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
  await apiFetch<{ ok: true }>(`/api/summaries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function cloudDelete(id: string): Promise<void> {
  await apiFetch<{ ok: true }>(`/api/summaries/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
