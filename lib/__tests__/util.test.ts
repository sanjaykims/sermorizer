import { describe, it, expect } from "vitest";
import { slug, escapeHtml, escapeXml, extractHtmlTitle } from "../util";

describe("slug", () => {
  it("strips filesystem-unsafe chars and spaces", () => {
    expect(slug('a/b:c*?"<>|d e')).toBe("a-b-c-d-e");
  });
  it("falls back when empty", () => {
    expect(slug("   ")).toBe("sermon");
    expect(slug("", "x")).toBe("x");
  });
});

describe("escapeHtml / escapeXml", () => {
  it("escapes the dangerous five", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;'");
    expect(escapeXml("'")).toBe("&apos;");
  });
});

describe("extractHtmlTitle", () => {
  it("prefers the <h1>", () => {
    expect(extractHtmlTitle("<title>T</title><h1>당연한 사랑은 없습니다</h1>")).toBe(
      "당연한 사랑은 없습니다",
    );
  });
  it("decodes entities in the <h1>", () => {
    expect(extractHtmlTitle("<h1>Faith &amp; Hope</h1>")).toBe("Faith & Hope");
  });
  it("falls back to <title>", () => {
    expect(extractHtmlTitle("<title>My Sermon Title</title>")).toBe("My Sermon Title");
  });
  it("rejects placeholder titles", () => {
    expect(extractHtmlTitle("<title>Untitled</title>")).toBe("");
    expect(extractHtmlTitle("<title>Sermon Summary</title>")).toBe("");
  });
  it("returns empty when there's nothing usable", () => {
    expect(extractHtmlTitle("<p>no title here</p>")).toBe("");
  });
});
