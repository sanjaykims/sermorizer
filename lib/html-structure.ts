/* Structural checks for a finished sermon document.
 *
 * Why this exists: on 2026-11-08 a repair pass left one document with an
 * orphan `</blockquote>` in the key verse and an unclosed `<blockquote>` in a
 * later section. Counting opening and closing tags did NOT catch it — the
 * counts were 4 and 4. Only the ORDER was wrong. A balance check cannot see
 * that; a depth walk can, because depth dips below zero the moment a closing
 * tag arrives with nothing open.
 *
 * These are cheap string-level checks, deliberately not a full parse: they run
 * on every generated document, and their job is to catch the structural faults
 * that actually reach readers (a quote that swallows the rest of the page, a
 * section badge that disagrees with the tab bar), not to validate HTML.
 */

/** One structural fault, phrased for a log line. */
export type StructuralProblem = string;

type Tag = "div" | "section" | "blockquote";

/** Walk one tag's opens/closes in document order and report nesting faults. */
function checkNesting(html: string, tag: Tag): StructuralProblem[] {
  // `<div` (not `<div>`) so attributes are matched; the closing form is exact.
  const re = new RegExp(`<${tag}(?:[\\s>])|</${tag}>`, "g");
  const problems: StructuralProblem[] = [];
  let depth = 0;
  let opens = 0;
  let closes = 0;
  for (const m of html.matchAll(re)) {
    if (m[0].startsWith("</")) {
      closes++;
      depth--;
      if (depth < 0) {
        problems.push(
          `<${tag}>: a </${tag}> appears with none open (at character ${m.index}). ` +
            `This is the fault an open/close COUNT cannot see.`,
        );
        depth = 0; // keep walking so we report every fault, not just the first
      }
    } else {
      opens++;
      depth++;
    }
  }
  if (depth > 0) {
    problems.push(`<${tag}>: ${depth} unclosed (${opens} opened, ${closes} closed).`);
  }
  return problems;
}

/** The visible section badges must agree with the ids and the tab bar. */
function checkSectionNumbering(html: string): StructuralProblem[] {
  const problems: StructuralProblem[] = [];
  const badges = [...html.matchAll(/<span class="sec-icon">([^<]*)<\/span>/g)]
    .map((m) => m[1].trim())
    // The at-a-glance heading carries a non-numeric badge; it is not a section.
    .filter((t) => /^\d+$/.test(t))
    .map(Number);
  if (badges.length === 0) return problems;

  const expected = badges.map((_, i) => i + 1);
  if (badges.join(",") !== expected.join(",")) {
    problems.push(
      `.sec-icon badges read ${badges.join(",")} but should read ` +
        `${expected.join(",")}. A split sermon is stitched from parts that each ` +
        `number their own sections, so the badges must be renumbered on stitch.`,
    );
  }
  const ids = [...html.matchAll(/<section id="sec-(\d+)"/g)].map((m) => Number(m[1]));
  if (ids.length && ids.join(",") !== ids.map((_, i) => i + 1).join(",")) {
    problems.push(`<section> ids read ${ids.join(",")} but should run 1..${ids.length}.`);
  }
  if (ids.length && badges.length && ids.length === badges.length) {
    const mismatch = ids.findIndex((id, i) => id !== badges[i]);
    if (mismatch >= 0) {
      problems.push(
        `section #${mismatch + 1} has id "sec-${ids[mismatch]}" but badge ` +
          `"${badges[mismatch]}" — the page contradicts its own tab bar.`,
      );
    }
  }
  return problems;
}

/** `.key-verse` is already the quotation surface; a quote nested inside it
 *  paints a box inside a box (and is how the orphan tag above got created). */
function checkKeyVerse(html: string): StructuralProblem[] {
  return /<div class="key-verse">[^<]*<\/?blockquote/.test(html)
    ? [`.key-verse contains a <blockquote> tag — it is already the quote surface.`]
    : [];
}

/** One section, reduced to what a takeaway can be written from. */
export type SectionDigest = { heading: string; excerpt: string };

/**
 * True when the at-a-glance list is mostly a copy of the section headings.
 * The repair path keys off this, so it is exported rather than being buried
 * inside the problem text.
 */
export function summaryEchoesHeadings(html: string): boolean {
  const headings = [...html.matchAll(/<span class="sec-title">([^<]*)<\/span>/g)].map((m) =>
    m[1].trim(),
  );
  const items = [...html.matchAll(/<div class="sm-text">([^<]*)<\/div>/g)].map((m) => m[1].trim());
  if (items.length < 3) return false;
  const echoed = items.filter((t) => headings.includes(t)).length;
  return echoed >= Math.ceil(items.length / 2);
}

/**
 * Heading plus a little of each section's prose — enough for a model to write
 * one takeaway per section, small enough to keep that call cheap. Tags are
 * stripped because the model is being asked for a sentence, not for markup.
 */
export function extractSectionDigest(html: string, excerptChars = 320): SectionDigest[] {
  const start = html.indexOf("<body");
  const body = start >= 0 ? html.slice(start) : html;
  const out: SectionDigest[] = [];
  for (const m of body.matchAll(/<section\b(?![^>]*class="[^"]*summary)[^>]*>([\s\S]*?)<\/section>/g)) {
    const inner = m[1];
    const heading = (inner.match(/<span class="sec-title">([^<]*)<\/span>/) ??
      inner.match(/<h[23][^>]*>([^<]*)<\/h[23]>/))?.[1]?.trim();
    if (!heading) continue;
    const prose = inner
      .replace(/<div class="sec-head">[\s\S]*?<\/div>/, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    out.push({ heading, excerpt: prose.slice(0, excerptChars) });
  }
  return out;
}

/** The at-a-glance list exists to add something: a takeaway per section. When
 *  it merely repeats the headings, the reader gets the tab bar twice and learns
 *  nothing. Cannot be auto-fixed — only the model can write a takeaway — so it
 *  is reported. */
function checkSummaryIsNotHeadingEcho(html: string): StructuralProblem[] {
  if (!summaryEchoesHeadings(html)) return [];
  const headings = [...html.matchAll(/<span class="sec-title">([^<]*)<\/span>/g)].map((m) =>
    m[1].trim(),
  );
  const items = [...html.matchAll(/<div class="sm-text">([^<]*)<\/div>/g)].map((m) => m[1].trim());
  const echoed = items.filter((t) => headings.includes(t)).length;
  return [
    `the at-a-glance list repeats ${echoed} of ${items.length} section headings ` +
      `verbatim — those headings are already in the tab bar, so the list adds ` +
      `nothing. Split parts should supply data-takeaway.`,
  ];
}

/** Emphasis only reads as emphasis while it stays scarce. Judging WHICH mark to
 *  cut is editorial, so this reports the budget rather than enforcing it. */
function checkEmphasisBudget(html: string): StructuralProblem[] {
  const sections = (html.match(/<section(?:[\s>])/g) ?? []).length;
  if (sections < 3) return [];
  const problems: StructuralProblem[] = [];
  const quotes = (html.match(/class="(?:key-quote|pullquote)"/g) ?? []).length;
  const marks = (html.match(/class="hl(?:-[a-z]+)?"/g) ?? []).length;
  if (quotes > sections) {
    problems.push(`${quotes} pull quotes across ${sections} sections — more than one each.`);
  }
  if (marks > sections * 3) {
    problems.push(`${marks} highlighter marks across ${sections} sections — over three each.`);
  }
  return problems;
}

/**
 * Nesting faults ONLY — unclosed or orphaned tags. Separate from the full
 * check because it answers a different question: "is this document safe to
 * parse and rewrite?". An HTML parser recovers from a missing close tag by
 * relocating the content that follows, so running a rewrite over a document
 * with a broken tag can scramble it further rather than fix it. Callers that
 * modify a document must consult this first and refuse when it is non-empty.
 */
export function findNestingProblems(html: string): StructuralProblem[] {
  if (!html || !html.trim()) return ["document is empty"];
  const start = html.indexOf("<body");
  const body = start >= 0 ? html.slice(start) : html;
  return [
    ...checkNesting(body, "div"),
    ...checkNesting(body, "section"),
    ...checkNesting(body, "blockquote"),
  ];
}

/**
 * Report every structural fault found in a finished document. Empty array
 * means the document passed. Callers log these; they do NOT discard a
 * document over them — a readable summary with a cosmetic fault is worth far
 * more to the reader than no summary at all.
 */
export function findStructuralProblems(html: string): StructuralProblem[] {
  if (!html || !html.trim()) return ["document is empty"];
  // Only the body: the injected stylesheet's comments mention tags like <div>
  // in prose, which would skew any tag scan over the whole file.
  const start = html.indexOf("<body");
  const body = start >= 0 ? html.slice(start) : html;
  return [
    ...findNestingProblems(html),
    ...checkSectionNumbering(body),
    ...checkKeyVerse(body),
    ...checkSummaryIsNotHeadingEcho(body),
    ...checkEmphasisBudget(body),
  ];
}
