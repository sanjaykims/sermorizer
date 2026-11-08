/* Reading the `service_date` field, which is NOT always a plain date.
 *
 * Found by auditing the stored corpus: two rows hold `2026-07-19-19-30` and
 * `2026-08-16-12-00`. That is deliberate, not corruption — when a second
 * service falls on a Sunday that already has one, the time is appended so the
 * two rows stay distinct. The value is load-bearing in two ways, so it must
 * not be normalised away in the database:
 *
 *  - `claimPendingSummaryServer` identifies a row to reuse by matching
 *    `service_date` exactly, and
 *  - the book sorts chapters by comparing these strings, where the appended
 *    time happens to put the evening service after the morning one.
 *
 * What WAS wrong is the display: every formatter here tested for
 * `^\d{4}-\d{2}-\d{2}$` and fell through on a longer value, so the book's
 * chapter subtitle and the history list printed a raw `2026-07-19-19-30` at
 * the reader. This module parses both shapes instead.
 */

export type ServiceDateParts = {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:MM`, when the stored value carried a time. */
  time?: string;
};

/** Split a stored `service_date` into its date and optional time. Returns null
 *  for anything that is not one of the two shapes the column actually holds,
 *  so callers can fall back rather than print something misleading. */
export function parseServiceDate(raw?: string | null): ServiceDateParts | null {
  const s = raw?.trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[-T ](\d{2})[-:](\d{2}))?$/);
  if (!m) return null;
  return m[2] ? { date: m[1], time: `${m[2]}:${m[3]}` } : { date: m[1] };
}

/** The date alone, for sorting and filenames: `2026-07-19`. */
export function serviceDateOnly(raw?: string | null): string | undefined {
  return parseServiceDate(raw)?.date;
}

/**
 * The reader-facing form. `sep` joins the date's parts, so the book can ask
 * for `2026.07.19` and the app for `2026-07-19`; a time is appended when the
 * stored value has one. An unrecognised value is returned trimmed rather than
 * dropped — a date in an unexpected format is still better than no date — but
 * it is never reformatted on a guess.
 */
export function formatServiceDate(raw?: string | null, sep = "-"): string {
  const parts = parseServiceDate(raw);
  if (!parts) return raw?.trim() ?? "";
  const date = sep === "-" ? parts.date : parts.date.split("-").join(sep);
  return parts.time ? `${date} ${parts.time}` : date;
}
