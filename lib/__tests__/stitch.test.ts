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
