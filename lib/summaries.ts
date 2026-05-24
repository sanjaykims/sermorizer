import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Lang = "ko" | "en" | "zh";

export type Summary = {
  id: string;
  title: string;
  createdAt: number;
  serviceDate?: string;
  occasion?: string;
  docs: Partial<Record<Lang, string>>;
};

// Public Supabase project for Sermorizer. A publishable key is meant to be
// shipped in the browser; access is governed by the row-level-security policies
// on the `summaries` table (public read/write — the "public link" model the
// user chose). Env vars override the baked-in defaults if ever needed.
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
  scripture: string | null;
  service_date: string | null;
  occasion: string | null;
  docs: Partial<Record<Lang, string>> | null;
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

export async function cloudInsert(input: {
  title: string;
  serviceDate?: string;
  occasion?: string;
  docs: Partial<Record<Lang, string>>;
}): Promise<Summary> {
  if (!client) throw new Error("Cloud storage is not configured.");
  const { data, error } = await client
    .from("summaries")
    .insert({
      title: input.title,
      service_date: input.serviceDate ?? null,
      occasion: input.occasion ?? null,
      docs: input.docs,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toSummary(data as Row);
}

export async function cloudUpdateDocs(
  id: string,
  docs: Partial<Record<Lang, string>>,
): Promise<void> {
  if (!client) throw new Error("Cloud storage is not configured.");
  const { error } = await client.from("summaries").update({ docs }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cloudDelete(id: string): Promise<void> {
  if (!client) throw new Error("Cloud storage is not configured.");
  const { error } = await client.from("summaries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
