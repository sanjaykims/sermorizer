/* Shared types used by both client (lib/summaries) and server (lib/summaries-server). */

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
  /** For split generation w/ proofreading: each slice's cleaned transcript,
   *  keyed by part index. Populated by the proofread pre-phase. */
  proofreadParts?: Record<string, string>;
};
