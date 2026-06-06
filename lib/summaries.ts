import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Lang = "ko" | "en" | "zh";
export type JobStatus = "generating" | "translating" | "done" | "error";

export type Summary = {
  id: string;
  title: string;
  createdAt: number;
  serviceDate?: string;
  occasion?: string;
  docs: Partial<Record<Lang, string>>;
  status: JobStatus;
  error?: string;
  /** For split generation: each part's raw HTML, keyed by part index. */
  parts?: Record<string, string>;
};

// Public Supabase project for Sermorizer. A publishable key is meant to be
// shipped in the browser; access is governed by the row-level-security policies
// on the `summaries` table (public read/write — the "public link" model the
// user chose). Env vars override the baked-in defaults if ever needed. The same
// client is used server-side (in the background job) and client-side (polling).
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://aeygqjuhqjvlhjrslbxd.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_42WSYW05_KpJmdE543vx8w_7wyhy-Ew";

const client: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export function cloudEnabled(): boolean {
  return client !== null;
}

type Row = {
  id: string;
  title: string;
  service_date: string | null;
  occasion: string | null;
  docs: Partial<Record<Lang, string>> | null;
  status: JobStatus | null;
  error: string | null;
  parts: Record<string, string> | null;
  created_at: string | null;
};

function toSummary(r: Row): Summary {
  return {
    id: r.id,
    title: r.title,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    serviceDate: r.service_date ?? undefined,
    occasion: r.occasion ?? undefined,
    docs: r.docs ?? {},
    status: r.status ?? "done",
    error: r.error ?? undefined,
    parts: r.parts ?? undefined,
  };
}

export async function cloudList(): Promise<Summary[]> {
  if (!client) return [];
  const { data, error } = await client
    .from("summaries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toSummary);
}

export async function cloudGet(id: string): Promise<Summary | null> {
  if (!client) return null;
  const { data, error } = await client
    .from("summaries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSummary(data as Row) : null;
}

/** Insert a row (used by the server to create a pending job). Returns its id. */
export async function cloudInsert(input: {
  title: string;
  serviceDate?: string;
  occasion?: string;
  docs?: Partial<Record<Lang, string>>;
  status?: JobStatus;
}): Promise<Summary> {
  if (!client) throw new Error("Cloud storage is not configured.");
  const { data, error } = await client
    .from("summaries")
    .insert({
      title: input.title,
      service_date: input.serviceDate ?? null,
      occasion: input.occasion ?? null,
      docs: input.docs ?? {},
      status: input.status ?? "done",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toSummary(data as Row);
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
  if (!client) throw new Error("Cloud storage is not configured.");
  const { error } = await client.from("summaries").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cloudDelete(id: string): Promise<void> {
  if (!client) throw new Error("Cloud storage is not configured.");
  const { error } = await client.from("summaries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
