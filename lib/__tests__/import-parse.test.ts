import { describe, it, expect } from "vitest";
import { detectLang, parseFilename, importGroupKey } from "../import-parse";

describe("detectLang", () => {
  it("reads the -EN suffix", () => {
    expect(detectLang("2026-05-17-x-Grace-EN.html", "")).toBe("en");
  });
  it("reads the 中文版 marker", () => {
    expect(detectLang("2026-05-17-스승의주일-師恩-中文版.html", "")).toBe("zh");
  });
  it("reads -ZH / Chinese suffixes", () => {
    expect(detectLang("a-zh.html", "")).toBe("zh");
    expect(detectLang("a chinese.html", "")).toBe("zh");
  });
  it("falls back to <html lang> when the filename is ambiguous", () => {
    expect(detectLang("sermon.html", '<html lang="en">')).toBe("en");
    expect(detectLang("sermon.html", "<html lang='zh-Hans'>")).toBe("zh");
    expect(detectLang("sermon.html", '<html lang="ko">')).toBe("ko");
  });
  it("defaults to Korean", () => {
    expect(detectLang("아무거나.html", "<html>")).toBe("ko");
  });
});

describe("parseFilename", () => {
  it("pulls date + occasion from the standard pattern", () => {
    expect(parseFilename("2026-05-17-스승의주일-스승의은혜.html")).toEqual({
      date: "2026-05-17",
      occasion: "스승의주일",
    });
  });
  it("ignores trailing language markers when reading the occasion", () => {
    expect(parseFilename("2026-05-17-Teachers-Sunday-Grace-EN.html")).toEqual({
      date: "2026-05-17",
      occasion: "Teachers",
    });
    expect(parseFilename("2026-05-17-스승의주일-師恩-中文版.html").date).toBe(
      "2026-05-17",
    );
  });
  it("returns empties when there's no date prefix", () => {
    expect(parseFilename("random-notes.html")).toEqual({
      date: undefined,
      occasion: undefined,
    });
  });
});

describe("importGroupKey", () => {
  it("groups by date when present (so a KO/EN/ZH triple merges)", () => {
    expect(importGroupKey("a-EN.html", "2026-05-17")).toBe("d:2026-05-17");
    expect(importGroupKey("b-中文版.html", "2026-05-17")).toBe("d:2026-05-17");
  });
  it("groups date-less files individually", () => {
    expect(importGroupKey("notes.html", undefined)).toBe("f:notes.html");
  });
});
