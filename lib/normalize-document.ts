/* Deterministic repairs applied to every finished sermon document.
 *
 * Why this exists: the 2026-11-08 review found faults that the prompts now ask
 * the model to avoid — a <blockquote> nested inside .key-verse, scripture
 * references given three different ways, section badges restarting mid-document.
 * A prompt rule is guidance; the model may still get it wrong, and when it does
 * the fault reaches a reader. Everything in this file is mechanical, so it is
 * enforced here rather than requested.
 *
 * Two deliberate constraints:
 *
 *  - It uses a real parser, never regex. Hand-written regex surgery on these
 *    same faults is exactly what left the documents with an orphan
 *    </blockquote> and an unclosed <blockquote>: a pattern that removes an
 *    opening tag can consume a closing tag belonging to something else.
 *    A parser cannot produce a mismatched pair.
 *
 *  - It only rewrites when it actually changed something. A document the model
 *    got right is returned byte-for-byte, so normalization can never be the
 *    reason a good document differs from what the model produced.
 *
 * Judgement is deliberately NOT here. Whether a claim should be attributed to
 * the preacher, or whether a paragraph deserves emphasis, cannot be decided by
 * a rule — those stay prompt guidance, and `findStructuralProblems` reports
 * them instead.
 */

import { parse, type HTMLElement } from "node-html-parser";
import { findNestingProblems } from "./html-structure";

export type NormalizationChange = string;

/** A `.bref` sitting at the very end of a quote belongs after it, on its own
 *  line — the house form. Returns true if the chip is the quote's last content. */
function isTrailing(quote: HTMLElement, chip: HTMLElement): boolean {
  const inner = quote.innerHTML;
  const at = inner.lastIndexOf(chip.outerHTML);
  if (at < 0) return false;
  return inner.slice(at + chip.outerHTML.length).trim() === "";
}

/** `.key-verse` is already the quotation surface; a quote nested inside paints
 *  a box inside a box. Unwrap it, keeping the verse text. */
function unwrapKeyVerseQuotes(root: HTMLElement, changes: NormalizationChange[]): void {
  for (const kv of root.querySelectorAll(".key-verse")) {
    for (const inner of kv.querySelectorAll("blockquote, .scripture, .verse-box, .verse")) {
      inner.replaceWith(inner.innerHTML);
      changes.push("unwrapped a quote nested inside .key-verse (box inside a box)");
    }
  }
}

/** Move a trailing reference chip out of its quote and into the `<p class="bref">`
 *  that follows it, so every reference in the document takes one form. */
function liftTrailingRefs(root: HTMLElement, changes: NormalizationChange[]): void {
  for (const quote of root.querySelectorAll("blockquote")) {
    const chips = quote.querySelectorAll(".bref");
    const chip = chips[chips.length - 1];
    if (!chip || !isTrailing(quote, chip)) continue;
    const text = chip.textContent.trim();
    chip.remove();
    // Trim the whitespace the chip left behind so the quote does not end with
    // a dangling blank line.
    quote.set_content(quote.innerHTML.replace(/\s+$/, ""));
    quote.insertAdjacentHTML("afterend", `\n<p class="bref">${text}</p>`);
    changes.push(`moved the reference "${text}" out of its quote onto its own line`);
  }
}

/** Verse ranges use an en dash. Only reference chips are touched — a tilde in
 *  Korean running prose ("1~3절") is idiomatic and must survive. */
function normalizeRangeDashes(root: HTMLElement, changes: NormalizationChange[]): void {
  for (const chip of root.querySelectorAll(".bref")) {
    const before = chip.textContent;
    const after = before.replace(/(\d)\s*~\s*(\d)/g, "$1–$2");
    if (after !== before) {
      chip.set_content(after);
      changes.push(`normalised the verse range "${before.trim()}" to use an en dash`);
    }
  }
}

/** Section badges must run 1..N in document order. Each generated part numbers
 *  its own sections, so a stitched document can otherwise restart mid-page and
 *  contradict its own tab bar. Only purely numeric badges are rewritten, so a
 *  ★ or emoji icon survives; ids and TOC links are left alone so no in-page
 *  link can break. */
function renumberBadges(root: HTMLElement, changes: NormalizationChange[]): void {
  const sections = root
    .querySelectorAll("section")
    .filter((s) => !(s.getAttribute("class") ?? "").includes("summary"));
  let n = 0;
  for (const section of sections) {
    const badge = section.querySelector(".sec-icon");
    if (!badge) continue;
    n++;
    const current = badge.textContent.trim();
    if (!/^\d+$/.test(current)) continue; // ★ and the like stay as they are
    if (current !== String(n)) {
      badge.set_content(String(n));
      changes.push(`renumbered a section badge from ${current} to ${n}`);
    }
  }
}

/**
 * Apply every mechanical repair. Returns the document and what was changed;
 * `changes` is empty and `html` is the untouched input when nothing needed
 * fixing.
 */
export function normalizeDocument(html: string): {
  html: string;
  changes: NormalizationChange[];
  skipped?: NormalizationChange[];
} {
  if (!html || !html.trim()) return { html, changes: [] };

  // Refuse to rewrite a document whose tags do not nest. An HTML parser
  // recovers from a missing close tag by relocating everything after it, so
  // re-serialising such a document moves content rather than repairing it.
  // Measured on the real 2026-11-08 file: normalising it while a <blockquote>
  // was unclosed made the parser see 10 sections instead of 11, mis-numbered a
  // badge and left two <div>s unclosed — it made a broken document worse.
  // A broken document is reported and returned untouched; repair comes first.
  const broken = findNestingProblems(html);
  if (broken.length) return { html, changes: [], skipped: broken };

  const root = parse(html);
  const changes: NormalizationChange[] = [];

  unwrapKeyVerseQuotes(root, changes);
  liftTrailingRefs(root, changes);
  normalizeRangeDashes(root, changes);
  renumberBadges(root, changes);

  // Nothing to fix: hand back the exact input. Re-serialising a correct
  // document would risk changing it for no reason.
  if (changes.length === 0) return { html, changes };

  const htmlEl = root.querySelector("html");
  const body = htmlEl ? htmlEl.toString() : root.toString();
  // node-html-parser does not keep the doctype; restore it when the input had
  // one, so the document still renders in standards mode.
  const out = /^\s*<!DOCTYPE/i.test(html) ? `<!DOCTYPE html>\n${body}` : body;
  return { html: out, changes };
}

/**
 * Rewrite the at-a-glance card text with freshly written takeaways.
 *
 * The last step of the repair path: when the stitched summary turned out to be
 * a copy of the section headings (because the parts supplied no
 * `data-takeaway`), the app asks the model for one takeaway per section and
 * puts them here. Returns null — changing nothing — when the document is not
 * safe to rewrite, or when the number of takeaways does not match the number
 * of cards, since a partial rewrite would pair takeaways with the wrong
 * sections.
 */
export function replaceSummaryTakeaways(
  html: string,
  takeaways: string[],
): string | null {
  if (findNestingProblems(html).length) return null;
  const root = parse(html);
  const cards = root.querySelectorAll(".sm-text");
  if (cards.length === 0 || cards.length !== takeaways.length) return null;
  if (takeaways.some((t) => !t.trim())) return null;
  cards.forEach((card, i) => card.set_content(escapeText(takeaways[i].trim())));
  const htmlEl = root.querySelector("html");
  const body = htmlEl ? htmlEl.toString() : root.toString();
  return /^\s*<!DOCTYPE/i.test(html) ? `<!DOCTYPE html>\n${body}` : body;
}

/** The takeaways come back from a model, so they are text, not markup. */
function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
