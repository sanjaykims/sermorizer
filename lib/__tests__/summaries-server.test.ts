import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Regression tests for the status invariant that governs every generation row.
 *
 * Both terminal writes are compare-and-set against `status`:
 *   - finalizeSummaryIfGeneratingServer requires status = 'generating'
 *   - markSummaryErrorServer            requires status <> 'done'
 *
 * So a row created at 'done' with empty docs is write-locked against BOTH
 * outcomes: the finished document is silently discarded AND the failure can't
 * be recorded. That is exactly what happened between 2026-07-12 and
 * 2026-08-22 — nine finalize attempts stored nothing and never raised a word.
 */

const captured: { insert?: Record<string, unknown> } = {};

/** Minimal chainable stand-in for the Supabase query builder. The candidate
 *  lookup resolves to "nothing to reclaim" so claim falls through to insert. */
function fakeClient() {
  const insertResult = {
    select: () => ({
      single: async () => ({
        data: {
          id: "row-1",
          title: "웃는 마음, 믿는 마음",
          service_date: "2026-08-16",
          occasion: null,
          docs: {},
          status: captured.insert?.status ?? null,
          error: null,
          parts: {},
          proofread_parts: {},
          usage: null,
          created_at: "2026-08-22T08:58:35Z",
          gen_token: "tok-1",
        },
        error: null,
      }),
    }),
  };

  const selectChain: Record<string, unknown> = {};
  for (const k of ["eq", "or", "gte", "order", "limit"]) {
    selectChain[k] = () => selectChain;
  }
  selectChain.maybeSingle = async () => ({ data: null, error: null });

  return {
    from: () => ({
      select: () => selectChain,
      insert: (payload: Record<string, unknown>) => {
        captured.insert = payload;
        return insertResult;
      },
    }),
  };
}

vi.mock("../supabase-server", () => ({
  getSupabaseAdmin: () => fakeClient(),
  withSupabaseRetry: async (fn: () => Promise<unknown>) => fn(),
}));

const { claimPendingSummaryServer } = await import("../summaries-server");

describe("claimPendingSummaryServer", () => {
  beforeEach(() => {
    delete captured.insert;
  });

  it("creates a fresh row at 'generating', never 'done'", async () => {
    await claimPendingSummaryServer({
      title: "웃는 마음, 믿는 마음",
      serviceDate: "2026-08-16",
      genToken: "tok-1",
    });
    expect(captured.insert).toBeDefined();
    // The whole bug in one assertion: a row born 'done' can never be finalized
    // (finalize needs 'generating') nor failed (markError needs <> 'done').
    expect(captured.insert?.status).toBe("generating");
    expect(captured.insert?.status).not.toBe("done");
  });

  it("still starts at 'generating' when there is no title/date to match on", async () => {
    // The "Generating…" placeholder title skips the reclaim lookup entirely and
    // goes straight to insert — the same path, and it must be just as safe.
    await claimPendingSummaryServer({ title: "Generating…", genToken: "tok-2" });
    expect(captured.insert?.status).toBe("generating");
  });

  it("carries the attempt token onto the new row so the fence can match it", async () => {
    await claimPendingSummaryServer({ title: "Generating…", genToken: "tok-3" });
    expect(captured.insert?.gen_token).toBe("tok-3");
  });

  it("starts with no document, which is why the status must allow a later write", async () => {
    await claimPendingSummaryServer({ title: "Generating…", genToken: "tok-4" });
    expect(captured.insert?.docs).toEqual({});
  });
});
