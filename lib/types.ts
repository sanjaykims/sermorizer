/* Shared types used by both client (lib/summaries) and server (lib/summaries-server). */

export type Lang = "ko" | "en" | "zh";
export type JobStatus = "generating" | "translating" | "done" | "error";

/** Cumulative Anthropic token usage for one summary across every call we
 *  made for it (proofread + parts + translations). */
export type SummaryUsage = {
  input?: number;
  output?: number;
  cache_create?: number;
  cache_read?: number;
};

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
  /** For split generation w/ proofreading: each slice's cleaned transcript,
   *  keyed by part index. Populated by the proofread pre-phase. */
  proofreadParts?: Record<string, string>;
  /** Accumulated token usage across all Claude calls for this summary. */
  usage?: SummaryUsage;
};
