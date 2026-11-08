import { describe, expect, it } from "vitest";
import { findStructuralProblems } from "../html-structure";

const wrap = (body: string) =>
  `<!DOCTYPE html><html lang="ko"><head><style>/* a <div> mentioned in a comment */</style></head><body>${body}</body></html>`;

const section = (n: number, extra = "") =>
  `<section id="sec-${n}"${extra}><div class="sec-head"><span class="sec-icon">${n}</span><span class="sec-title">T${n}</span></div><p>p</p></section>`;

describe("findStructuralProblems", () => {
  it("passes a well-formed document", () => {
    expect(findStructuralProblems(wrap(section(1) + section(2)))).toEqual([]);
  });

  /* The exact pair of faults that reached the 2026-11-08 documents. Both have
     EQUAL opening and closing counts, which is why a balance check missed them
     and a reader found them instead. */
  it("catches a closing tag that arrives with nothing open", () => {
    const body = `<div class="key-verse">text</blockquote></div><blockquote>q</blockquote>`;
    const problems = findStructuralProblems(wrap(body));
    expect(problems.some((p) => p.includes("none open"))).toBe(true);
  });

  it("catches an unclosed tag even when the overall counts balance", () => {
    // 2 <blockquote> and 2 </blockquote> — perfectly balanced, badly ordered.
    const body = `<div class="key-verse">text</blockquote></div><blockquote>a<blockquote>b</blockquote>`;
    const problems = findStructuralProblems(wrap(body));
    const opens = (wrap(body).match(/<blockquote>/g) ?? []).length;
    const closes = (wrap(body).match(/<\/blockquote>/g) ?? []).length;
    expect(opens).toBe(closes); // the check a balance test would have made
    expect(problems.length).toBeGreaterThan(0); // this one still fails it
  });

  it("catches section badges that disagree with the tab bar", () => {
    // Part 2 restarted its own numbering: 1,2,1,2 instead of 1,2,3,4.
    const body =
      `<section id="sec-1"><div class="sec-head"><span class="sec-icon">1</span></div></section>` +
      `<section id="sec-2"><div class="sec-head"><span class="sec-icon">2</span></div></section>` +
      `<section id="sec-3"><div class="sec-head"><span class="sec-icon">1</span></div></section>` +
      `<section id="sec-4"><div class="sec-head"><span class="sec-icon">2</span></div></section>`;
    const problems = findStructuralProblems(wrap(body));
    expect(problems.some((p) => p.includes("badges read 1,2,1,2"))).toBe(true);
  });

  it("ignores the non-numeric at-a-glance badge", () => {
    const body =
      section(1) +
      `<section class="summary" id="summary"><div class="sec-head"><span class="sec-icon">★</span></div></section>`;
    expect(findStructuralProblems(wrap(body))).toEqual([]);
  });

  it("catches a quote nested inside .key-verse", () => {
    const body = `<div class="key-verse"><blockquote>v</blockquote></div>` + section(1);
    const problems = findStructuralProblems(wrap(body));
    expect(problems.some((p) => p.includes("key-verse"))).toBe(true);
  });

  it("does not trip on <div> mentioned in the injected stylesheet's comments", () => {
    // The whole-file div count is skewed by the comment; the body is clean.
    expect(findStructuralProblems(wrap(section(1)))).toEqual([]);
  });

  /* Reported, not auto-fixed: only the model can write a takeaway. This is the
     shape the 2026-11-08 summary shipped with — eleven headings, twice. */
  it("reports an at-a-glance list that just repeats the headings", () => {
    const heads = ["하나", "둘", "셋", "넷"];
    const body =
      heads
        .map((h, i) => `<section id="sec-${i + 1}"><div class="sec-head"><span class="sec-icon">${i + 1}</span><span class="sec-title">${h}</span></div></section>`)
        .join("") +
      `<div class="sm-grid">${heads.map((h) => `<div class="sm-text">${h}</div>`).join("")}</div>`;
    const problems = findStructuralProblems(wrap(body));
    expect(problems.some((p) => p.includes("repeats 4 of 4 section headings"))).toBe(true);
  });

  it("accepts an at-a-glance list of real takeaways", () => {
    const heads = ["하나", "둘", "셋", "넷"];
    const body =
      heads
        .map((h, i) => `<section id="sec-${i + 1}"><div class="sec-head"><span class="sec-icon">${i + 1}</span><span class="sec-title">${h}</span></div></section>`)
        .join("") +
      `<div class="sm-grid">${heads.map((_, i) => `<div class="sm-text">실제 요약 문장 ${i + 1}</div>`).join("")}</div>`;
    expect(findStructuralProblems(wrap(body))).toEqual([]);
  });

  it("reports emphasis that has stopped being scarce", () => {
    const body =
      [1, 2, 3].map((n) => section(n)).join("") +
      `<p class="key-quote">a</p><p class="key-quote">b</p><p class="key-quote">c</p><p class="key-quote">d</p>`;
    const problems = findStructuralProblems(wrap(body));
    expect(problems.some((p) => p.includes("pull quotes"))).toBe(true);
  });

  it("does not complain about restrained emphasis", () => {
    const body =
      [1, 2, 3].map((n) => section(n)).join("") +
      `<p class="key-quote">a</p><p>x <span class="hl">y</span> z</p>`;
    expect(findStructuralProblems(wrap(body))).toEqual([]);
  });

  it("reports an empty document rather than silently passing it", () => {
    expect(findStructuralProblems("")).toEqual(["document is empty"]);
    expect(findStructuralProblems("   ")).toEqual(["document is empty"]);
  });

  it("does not confuse <divider>-like names for <div>", () => {
    // `<div` must not match a longer tag name that merely starts with it.
    const body = `<div class="divider"></div>` + section(1);
    expect(findStructuralProblems(wrap(body))).toEqual([]);
  });
});
