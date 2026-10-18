/* Pricing math for displayed cost.
   Claude Opus 5.5 from the Anthropic pricing table (USD per 1M tokens):
     input        $4.00
     output      $20.00
     cache write  $5.00 (1.25× input, 5-minute TTL — the app never sets a
                  1-hour TTL, which would be $8.00)
     cache read   $0.20
   NOTE: cache read is 0.05× input on Opus 5.5, NOT the 0.1× that applies to
   most models (it was $0.50 = 0.1× on Opus 5). Do not re-derive it from the
   usual ratio — read it off the pricing table.
   Update here if you switch the service model. */

import type { SummaryUsage } from "./types";

const PER_M = {
  input: 4,
  output: 20,
  cache_create: 5,
  cache_read: 0.2,
} as const;

/** Convert accumulated tokens to a dollar figure. */
export function usageToCost(u: SummaryUsage | undefined): number {
  if (!u) return 0;
  return (
    ((u.input ?? 0) * PER_M.input +
      (u.output ?? 0) * PER_M.output +
      (u.cache_create ?? 0) * PER_M.cache_create +
      (u.cache_read ?? 0) * PER_M.cache_read) /
    1_000_000
  );
}

/** Format a dollar amount for the UI. Sub-cent amounts render with more
 *  precision so we don't show "$0.00" for a finished sermon. */
export function formatCost(usd: number): string {
  if (!isFinite(usd) || usd <= 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function totalTokens(u: SummaryUsage | undefined): number {
  if (!u) return 0;
  return (
    (u.input ?? 0) + (u.output ?? 0) + (u.cache_create ?? 0) + (u.cache_read ?? 0)
  );
}
