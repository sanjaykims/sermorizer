/* Server-only summaries module. Uses the service-role Supabase client so that
   the browser never holds any key with row write access — every read/write is
   routed through an authenticated API route. */

import { getSupabaseAdmin, withSupabaseRetry } from "./supabase-server";
import type { JobStatus, Lang, Summary } from "./types";

type Row = {
  id: string;
  title: string;
  service_date: string | null;
  occasion: string | null;
  docs: Partial<Record<Lang, string>> | null;
  status: JobStatus | null;
  error: string | null;
  parts: Record<string, string> | null;
  proofread_parts: Record<string, string> | null;
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
    proofreadParts: r.proofread_parts ?? undefined,
  };
}

export async function listSummariesServer(): Promise<Summary[]> {
  return withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa
      .from("summaries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map(toSummary);
  });
}

export async function getSummaryServer(id: string): Promise<Summary | null> {
  return withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa
      .from("summaries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toSummary(data as Row) : null;
  });
}

export async function insertSummaryServer(input: {
  title: string;
  serviceDate?: string;
  occasion?: string;
  docs?: Partial<Record<Lang, string>>;
  status?: JobStatus;
}): Promise<Summary> {
  return withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa
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
  });
}

export async function updateSummaryServer(
  id: string,
  patch: {
    docs?: Partial<Record<Lang, string>>;
    title?: string;
    status?: JobStatus;
    error?: string | null;
    parts?: Record<string, string>;
  },
): Promise<void> {
  await withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const { error } = await supa.from("summaries").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  });
}

export async function mergePartServer(id: string, key: string, html: string): Promise<void> {
  await withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const { error } = await supa.rpc("merge_summary_part", {
      p_id: id,
      p_key: key,
      p_html: html,
    });
    if (error) throw new Error(error.message);
  });
}

/** Atomically merge one proofread-cleaned transcript slice into the row's
 *  `proofread_parts` map — pre-phase counterpart of mergePartServer. */
export async function mergeProofreadPartServer(
  id: string,
  key: string,
  text: string,
): Promise<void> {
  await withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const { error } = await supa.rpc("merge_proofread_part", {
      p_id: id,
      p_key: key,
      p_text: text,
    });
    if (error) throw new Error(error.message);
  });
}

/** Atomically merge one language's HTML into the row's `docs` map and mark it
 *  done. Avoids the read-modify-write race when EN and ZH translations of the
 *  same summary finish concurrently. */
export async function mergeSummaryDocServer(
  id: string,
  lang: Lang,
  html: string,
): Promise<void> {
  await withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const { error } = await supa.rpc("merge_summary_doc", {
      p_id: id,
      p_lang: lang,
      p_html: html,
    });
    if (error) throw new Error(error.message);
  });
}

export async function deleteSummaryServer(id: string): Promise<void> {
  await withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const { error } = await supa.from("summaries").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });
}
