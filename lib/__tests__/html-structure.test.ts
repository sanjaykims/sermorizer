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
