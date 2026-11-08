import { describe, expect, it } from "vitest";
import { stitchPartsServer } from "../stitch";

const part0 = `<!DOCTYPE html>
<html lang="ko">
<head><title>Long Sermon</title></head>
<body>
  <header class="header"><h1 class="h-title">Long Sermon</h1></header>
  <nav class="toc"></nav>
  <div id="sermon-body">
    <section><div class="sec-head"><span class="sec-title">첫 번째 흐름</span></div><p>첫 본문</p></section>
  </div>
</body>
</html>`;

describe("stitchPartsServer", () => {
  it("merges sermon-body sections, renumbers ids, and builds navigation", () => {
    const part1 = `<!DOCTYPE html>
<html lang="ko"><body>
  <div id="sermon-body">
    <section><div class="sec-head"><span class="sec-title">두 번째 흐름</span></div><p>둘째 본문</p></section>
  </div>
</body></html>`;

    const html = stitchPartsServer({ "0": part0, "1": part1 }, 2);

    expect(html).toContain('<a href="#sec-1">첫 번째 흐름</a>');
    expect(html).toContain('<a href="#sec-2">두 번째 흐름</a>');
    expect(html).toContain('<a href="#summary">한눈에 보기</a>');
    expect(html).toContain('id="sermon-body"');
    expect(html).toContain('id="sec-1"');
    expect(html).toContain('id="sec-2"');
    expect(html).toContain('class="summary"');
    expect(html).toContain("둘째 본문");
    expect(html).toContain('id="sermorizer-layout"');
  });

  /* Regression: the 2026-11-08 sermon shipped with section ids 1..11 but badges
     reading 1,2,3,4,5,6,4,5,6,7,8 — each part numbers its own sections, and the
     stitcher renumbered only the ids, so the document contradicted its own TOC
     and at-a-glance list in all three languages. */
  it("renumbers the visible .sec-icon badges, not just the ids", () => {
    const numbered0 = `<!DOCTYPE html>
<html lang="ko"><body><nav class="toc"></nav>
  <div id="sermon-body">
    <section><div class="sec-head"><span class="sec-icon">1</span><span class="sec-title">하나</span></div><p>A</p></section>
    <section><div class="sec-head"><span class="sec-icon">2</span><span class="sec-title">둘</span></div><p>B</p></section>
  </div>
</body></html>`;
    // Part 2 restarts its own numbering — exactly what produced the bug.
    const numbered1 = `<!DOCTYPE html>
<html lang="ko"><body>
  <div id="sermon-body">
    <section><div class="sec-head"><span class="sec-icon">1</span><span class="sec-title">셋</span></div><p>C</p></section>
    <section><div class="sec-head"><span class="sec-icon">2</span><span class="sec-title">넷</span></div><p>D</p></section>
  </div>
</body></html>`;

    const html = stitchPartsServer({ "0": numbered0, "1": numbered1 }, 2);
    const badges = [...html.matchAll(/<span class="sec-icon">([^<]*)<\/span>/g)].map((m) => m[1]);

    // Four sections numbered 1-4, then the summary's star.
    expect(badges).toEqual(["1", "2", "3", "4", "★"]);
    // Badges and ids must agree, which is what actually broke.
    expect(html).toContain('id="sec-3"');
    expect(html).toContain('id="sec-4"');
  });

  it("leaves a non-numeric .sec-icon alone", () => {
    const iconPart = `<!DOCTYPE html>
<html lang="ko"><body><nav class="toc"></nav>
  <div id="sermon-body">
    <section><div class="sec-head"><span class="sec-icon">✝</span><span class="sec-title">하나</span></div><p>A</p></section>
  </div>
</body></html>`;
    const html = stitchPartsServer({ "0": iconPart }, 1);
    expect(html).toContain('<span class="sec-icon">✝</span>');
  });

  it("puts a divider at the seam between two parts", () => {
    const html = stitchPartsServer({ "0": part0, "1": `<!DOCTYPE html>
<html lang="ko"><body><div id="sermon-body">
  <section><div class="sec-head"><span class="sec-title">두 번째</span></div><p>둘째</p></section>
</div></body></html>` }, 2);
    // Without this the join was the one section boundary in the document with
    // no rule, which is how the seam became visible to a reader.
    expect(html).toContain('<div class="divider"></div>');
  });

  /* The at-a-glance list is built by the stitcher, so for a split sermon itは
     only as good as what the parts hand it. Before data-takeaway it reused the
     section title, making the list a verbatim echo of the tab bar. */
  it("builds the at-a-glance list from data-takeaway when a section supplies one", () => {
    const withTakeaway = `<!DOCTYPE html>
<html lang="ko"><body><nav class="toc"></nav>
  <div id="sermon-body">
    <section data-takeaway="은혜를 기억하는 사람이 감사하며 삽니다."><div class="sec-head"><span class="sec-title">하나를 듣고 열을 아는 지도자</span></div><p>A</p></section>
  </div>
</body></html>`;
    const html = stitchPartsServer({ "0": withTakeaway }, 1);

    expect(html).toContain('<div class="sm-text">은혜를 기억하는 사람이 감사하며 삽니다.</div>');
    // The heading still drives the tab bar, but must NOT be the summary text.
    expect(html).toContain('<a href="#sec-1">하나를 듣고 열을 아는 지도자</a>');
    expect(html).not.toContain('<div class="sm-text">하나를 듣고 열을 아는 지도자</div>');
  });

  it("falls back to the heading when a section omits data-takeaway", () => {
    const html = stitchPartsServer({ "0": part0 }, 1);
    expect(html).toContain('<div class="sm-text">첫 번째 흐름</div>');
  });

  it("escapes a data-takeaway rather than letting it inject markup", () => {
    const nasty = `<!DOCTYPE html>
<html lang="ko"><body><nav class="toc"></nav>
  <div id="sermon-body">
    <section data-takeaway="a &lt;script&gt;x&lt;/script&gt; b"><div class="sec-head"><span class="sec-title">T</span></div><p>A</p></section>
  </div>
</body></html>`;
    const html = stitchPartsServer({ "0": nasty }, 1);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("salvages thematic sections when a later part omits sermon-body", () => {
    const malformedPart = `<!DOCTYPE html>
<html lang="ko"><body>
  <section><div class="sec-head"><span class="sec-title">살린 흐름</span></div><p>살린 본문</p></section>
</body></html>`;

    const html = stitchPartsServer({ "0": part0, "1": malformedPart }, 2);

    expect(html).toContain("살린 흐름");
    expect(html).toContain("살린 본문");
    expect(html).toContain('<a href="#sec-2">살린 흐름</a>');
  });
});
