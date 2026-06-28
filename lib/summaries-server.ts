/* Server-only summaries module. Uses the service-role Supabase client so that
   the browser never holds any key with row write access — every read/write is
   routed through an authenticated API route. */

import { getSupabaseAdmin, withSupabaseRetry } from "./supabase-server";
import type { JobStatus, Lang, Summary, SummaryUsage } from "./types";

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
  usage: SummaryUsage | null;
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
    usage: r.usage ?? undefined,
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

/**
 * Get a pending row to write a fresh generation into — reusing a recent FAILED
 * attempt for the same sermon instead of piling up a new row on every retry.
 *
 * Only rows with status `error` are reclaimed, so an in-progress generation is
 * never hijacked, and reuse requires a real title + service date so two
 * genuinely different sermons are never collapsed onto one row. On reuse the
 * row is fully reset (docs / parts / proofread_parts cleared, status back to
 * generating) so no stale fragment from the failed attempt leaks into the new
 * document. Falls back to a fresh insert when there's nothing safe to reuse.
 */
export async function claimPendingSummaryServer(input: {
  title: string;
  serviceDate?: string;
  occasion?: string;
}): Promise<Summary> {
  const title = input.title?.trim();
  const date = input.serviceDate?.trim();
  if (title && title !== "Generating…" && date) {
    const reusedId = await withSupabaseRetry(async () => {
      const supa = getSupabaseAdmin();
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supa
        .from("summaries")
        .select("id")
        .eq("title", title)
        .eq("service_date", date)
        .eq("status", "error")
        .gte("created_at", dayAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as { id: string } | null)?.id;
    });
    if (reusedId) {
      const row = await withSupabaseRetry(async () => {
        const supa = getSupabaseAdmin();
        const { data, error } = await supa
          .from("summaries")
          .update({
            status: "generating",
            docs: {},
            parts: {},
            proofread_parts: {},
            error: null,
            occasion: input.occasion ?? null,
          })
          .eq("id", reusedId)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as Row;
      });
      return toSummary(row);
    }
  }
  return insertSummaryServer(input);
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
/** Atomically accumulate one Anthropic call's token usage onto the row.
 *  Safe under the parallel proofread fan-out — the SQL function does an
 *  additive update so no two writers can clobber each other. Never throws:
 *  usage tracking must not be allowed to fail a generation. */
export async function addUsageServer(id: string, u: SummaryUsage): Promise<void> {
  try {
    await withSupabaseRetry(async () => {
      const supa = getSupabaseAdmin();
      const { error } = await supa.rpc("add_summary_usage", {
        p_id: id,
        p_input: Math.max(0, u.input ?? 0),
        p_output: Math.max(0, u.output ?? 0),
        p_cache_create: Math.max(0, u.cache_create ?? 0),
        p_cache_read: Math.max(0, u.cache_read ?? 0),
      });
      if (error) throw new Error(error.message);
    });
  } catch (e) {
    console.warn("[sermorizer] usage tracking failed", {
      id,
      err: e instanceof Error ? e.message : String(e),
    });
  }
}

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
