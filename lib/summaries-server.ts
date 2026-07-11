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
    // Deliberately omit `parts` and `proofread_parts`: those hold the raw
    // multi-part / proofread HTML for an in-flight job and can be several MB
    // per row. Shipping them for up to 200 rows can blow past the platform
    // response limit (then cloudList silently returns []). The list only needs
    // metadata + the finished docs; the polling path re-fetches a single row
    // (with parts) by id when it actually needs them.
    const { data, error } = await supa
      .from("summaries")
      .select("id,title,service_date,occasion,docs,status,error,usage,created_at")
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
 * Safety rails (each closes a real data-loss path):
 * - Only rows with status `error` are reclaimed, so an in-progress generation
 *   is never hijacked.
 * - Rows whose `docs` is non-empty are NEVER reclaimed. A finished summary
 *   whose translation later failed sits at status='error' with the completed
 *   Korean doc (and any sibling translation) still in `docs`; resetting that
 *   row would permanently destroy the only stored copy.
 * - The reset UPDATE re-checks status='error' (compare-and-set), so if the row
 *   changed between the lookup and the reset — e.g. a concurrent retry claimed
 *   it first — we fall through to a fresh insert instead of clobbering it.
 * - Reuse requires a real title + service date so two genuinely different
 *   sermons are never collapsed onto one row.
 * On reuse the row is fully reset (parts / proofread_parts cleared, status
 * back to generating). Falls back to a fresh insert when nothing is safe to
 * reuse.
 */
export async function claimPendingSummaryServer(input: {
  title: string;
  serviceDate?: string;
  occasion?: string;
}): Promise<Summary> {
  const title = input.title?.trim();
  const date = input.serviceDate?.trim();
  if (title && title !== "Generating…" && date) {
    const candidate = await withSupabaseRetry(async () => {
      const supa = getSupabaseAdmin();
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // A stale 'generating' row (older than 15 min — well past the 800s
      // function ceiling) is a dead attempt that was abandoned mid-flight
      // (e.g. the client died between the proofread and part phases). Reclaim
      // those too, so a retry reuses the stranded row instead of leaving it
      // stuck forever and inserting a duplicate. 15 min can never catch a
      // genuinely-live run.
      const staleTs = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data, error } = await supa
        .from("summaries")
        .select("id, docs, status")
        .eq("title", title)
        .eq("service_date", date)
        .or(`status.eq.error,and(status.eq.generating,created_at.lt.${staleTs})`)
        .gte("created_at", dayAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as { id: string; docs: Record<string, string> | null; status: string } | null;
    });
    const hasDocs = Object.keys(candidate?.docs ?? {}).length > 0;
    if (candidate && !hasDocs) {
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
            // Reset accumulated usage too: the fresh attempt starts a new token
            // tally, so the previous failed attempt's tokens must not linger and
            // double-count in the cost panel.
            usage: null,
            // Stamp the reclaimed row with the retry time: a reused row is
            // effectively a new generation, so its spend buckets under the
            // current month (not the failed attempt's month) and it sorts to
            // the top of history like any fresh summary.
            created_at: new Date().toISOString(),
          })
          .eq("id", candidate.id)
          // Compare-and-set on the exact status we read: if a concurrent claim
          // (or a straggler worker) changed the row since the lookup, this
          // no-ops and we fall through to a fresh insert.
          .eq("status", candidate.status)
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data as Row | null;
      });
      if (row) return toSummary(row);
      // CAS lost — the row changed under us; take the safe path.
    }
  }
  return insertSummaryServer(input);
}

/**
 * Mark a job failed WITHOUT ever stomping a row that already reached 'done'.
 * A finished document's status must not be overwritten by a stale worker from
 * a previous attempt or by a failure that raced a concurrent success.
 */
export async function markSummaryErrorServer(id: string, message: string): Promise<void> {
  await withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const { error } = await supa
      .from("summaries")
      .update({ status: "error", error: message })
      .eq("id", id)
      .neq("status", "done");
    if (error) throw new Error(error.message);
  });
}

/**
 * Atomically finalize a split job: apply the patch only if the row is still
 * 'generating'. Returns whether THIS caller won. Two parts finishing in the
 * same instant both see "all parts present" and both try to finalize; the
 * status compare-and-set in the WHERE clause guarantees a single winner, so
 * the stitch is stored once and only one completion push is sent.
 */
export async function finalizeSummaryIfGeneratingServer(
  id: string,
  patch: {
    docs: Partial<Record<Lang, string>>;
    title: string;
    status: JobStatus;
    error: string | null;
    parts: Record<string, string>;
  },
): Promise<boolean> {
  return withSupabaseRetry(async () => {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa
      .from("summaries")
      .update(patch)
      .eq("id", id)
      .eq("status", "generating")
      .select("id");
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
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
