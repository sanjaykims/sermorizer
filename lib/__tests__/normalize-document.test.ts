import { describe, expect, it } from "vitest";
import { normalizeDocument } from "../normalize-document";
import { findStructuralProblems } from "../html-structure";

const doc = (body: string) =>
  `<!DOCTYPE html>\n<html lang="ko"><head><title>T</title></head><body>${body}</body></html>`;

describe("normalizeDocument", () => {
  it("returns a correct document byte-for-byte", () => {
    const html = doc(
      `<div class="key-verse">verse<p class="bref">여호수아 4:6–7</p></div>` +
        `<section id="sec-1"><div class="sec-head"><span class="sec-icon">1</span></div></section>`,
    );
    const out = normalizeDocument(html);
    expect(out.changes).toEqual([]);
    expect(out.html).toBe(html); // identical, not merely equivalent
  });

  /* The fault that shipped: .key-verse is already the quote surface, so a
     nested <blockquote> drew a second box inside the first. */
  it("unwraps a quote nested inside .key-verse and keeps the verse text", () => {
    const out = normalizeDocument(
      doc(`<div class="key-verse"><blockquote>후일에 너희의 자손들이</blockquote><p class="bref">수 4:6–7</p></div>`),
    );
    expect(out.html).toContain("후일에 너희의 자손들이");
    expect(out.html).not.toMatch(/<div class="key-verse">[^<]*<\/?blockquote/);
    expect(out.changes.join(" ")).toMatch(/box inside a box/);
  });

  /* THE important one. Repairing this by hand with regex is what produced an
     orphan </blockquote> and an unclosed <blockquote> — counts stayed equal,
     so a balance check passed and a reader found the damage. A parser cannot
     emit a mismatched pair, and the structural checker confirms it here. */
  it("never leaves a mismatched tag, unlike the hand-written regex repair", () => {
    const out = normalizeDocument(
      doc(
        `<div class="key-verse"><blockquote>verse</blockquote><p class="bref">수 4:6–7</p></div>` +
          `<section id="sec-1"><div class="sec-head"><span class="sec-icon">1</span></div>` +
          `<blockquote>사무엘이 돌을 취하여\n<span class="bref">삼상 7:12</span></blockquote></section>`,
      ),
    );
    expect(findStructuralProblems(out.html)).toEqual([]);
    const opens = (out.html.match(/<blockquote>/g) ?? []).length;
    const closes = (out.html.match(/<\/blockquote>/g) ?? []).length;
    expect(opens).toBe(closes);
    expect(opens).toBe(1); // the key-verse one unwrapped, the real quote intact
  });

  it("moves a trailing reference chip out of its quote onto its own line", () => {
    const out = normalizeDocument(
      doc(`<blockquote>사무엘이 돌을 취하여<span class="bref">삼상 7:12</span></blockquote>`),
    );
    expect(out.html).toContain('<p class="bref">삼상 7:12</p>');
    expect(out.html).not.toContain('<span class="bref">');
    expect(out.html).toMatch(/<\/blockquote>\s*<p class="bref">/);
  });

  it("leaves a reference cited mid-sentence inside the quote alone", () => {
    // Only a chip at the very END of a quote is the reference line; one in
    // running text is part of the sentence.
    const html = doc(
      `<blockquote>as <span class="bref">엡 6:2</span> says, honour your father</blockquote>`,
    );
    const out = normalizeDocument(html);
    expect(out.html).toBe(html);
  });

  it("normalises a tilde verse range in a reference to an en dash", () => {
    const out = normalizeDocument(doc(`<p class="bref">여호수아 4:6~7</p>`));
    expect(out.html).toContain("여호수아 4:6–7");
  });

  it("leaves a tilde in Korean running prose alone", () => {
    // "1~3절" in a sentence is idiomatic Korean, not a reference chip.
    const html = doc(`<p>하나님이 하신 말씀은 1~3절, 그저 돌을 취하라는 것이었습니다.</p>`);
    expect(normalizeDocument(html).html).toBe(html);
  });

  it("renumbers badges that restart mid-document", () => {
    const section = (id: string, badge: string) =>
      `<section id="${id}"><div class="sec-head"><span class="sec-icon">${badge}</span></div></section>`;
    // Exactly the shipped shape: part 2 restarted its own numbering.
    const out = normalizeDocument(
      doc(section("sec-1", "1") + section("sec-2", "2") + section("sec-3", "1") + section("sec-4", "2")),
    );
    const badges = [...out.html.matchAll(/<span class="sec-icon">([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(badges).toEqual(["1", "2", "3", "4"]);
    expect(findStructuralProblems(out.html)).toEqual([]);
  });

  it("does not renumber the at-a-glance star or touch ids and TOC links", () => {
    const html = doc(
      `<nav class="toc"><a href="#sec-1">A</a></nav>` +
        `<section id="sec-1"><div class="sec-head"><span class="sec-icon">1</span></div></section>` +
        `<section class="summary" id="summary"><div class="sec-head"><span class="sec-icon">★</span></div></section>`,
    );
    const out = normalizeDocument(html);
    expect(out.html).toContain('<span class="sec-icon">★</span>');
    expect(out.html).toContain('href="#sec-1"'); // in-page links must not break
    expect(out.changes).toEqual([]);
  });

  it("keeps the doctype so the document still renders in standards mode", () => {
    const out = normalizeDocument(doc(`<div class="key-verse"><blockquote>v</blockquote></div>`));
    expect(out.changes.length).toBeGreaterThan(0);
    expect(out.html.startsWith("<!DOCTYPE html>")).toBe(true);
  });

  /* Found by running the normaliser against the REAL broken 2026-11-08 file.
     An HTML parser recovers from a missing close tag by relocating everything
     after it, so rewriting a malformed document moves content instead of
     repairing it: the parser saw 10 sections instead of 11, mis-numbered a
     badge and left two <div>s unclosed. It made a broken document worse. */
  it("refuses to rewrite a document whose tags do not nest", () => {
    const broken = doc(
      `<div class="key-verse">verse</blockquote></div>` +
        `<section id="sec-1"><div class="sec-head"><span class="sec-icon">1</span></div>` +
        `<blockquote>unclosed quote</section>`,
    );
    const out = normalizeDocument(broken);
    expect(out.html).toBe(broken); // untouched, byte-for-byte
    expect(out.changes).toEqual([]);
    expect(out.skipped?.length).toBeGreaterThan(0);
    // and the faults are still reported for a human to act on
    expect(findStructuralProblems(out.html).length).toBeGreaterThan(0);
  });

  it("still normalises a well-formed document that only breaks house style", () => {
    // Same style faults, but every tag nests — safe to rewrite.
    const out = normalizeDocument(
      doc(
        `<div class="key-verse"><blockquote>verse</blockquote></div>` +
          `<section id="sec-1"><div class="sec-head"><span class="sec-icon">1</span></div></section>` +
          `<section id="sec-2"><div class="sec-head"><span class="sec-icon">1</span></div>` +
          `<blockquote>q<span class="bref">삼상 7:12</span></blockquote></section>`,
      ),
    );
    expect(out.skipped).toBeUndefined();
    expect(out.changes.length).toBeGreaterThan(0);
    expect(findStructuralProblems(out.html)).toEqual([]);
    expect(out.html).toContain('<p class="bref">삼상 7:12</p>');
    expect([...out.html.matchAll(/<span class="sec-icon">([^<]*)<\/span>/g)].map((m) => m[1]))
      .toEqual(["1", "2"]);
  });

  it("handles an empty document without throwing", () => {
    expect(normalizeDocument("")).toEqual({ html: "", changes: [] });
  });
});
