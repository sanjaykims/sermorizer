import { describe, expect, it } from "vitest";
import {
  formatServiceDate,
  parseServiceDate,
  serviceDateOnly,
} from "../service-date";

describe("parseServiceDate", () => {
  it("reads a plain service date", () => {
    expect(parseServiceDate("2026-11-08")).toEqual({ date: "2026-11-08" });
  });

  /* The shape found in the stored corpus: a second service on a Sunday that
     already had one appends its time, so the two rows stay distinct. */
  it("reads a date that carries a time", () => {
    expect(parseServiceDate("2026-07-19-19-30")).toEqual({
      date: "2026-07-19",
      time: "19:30",
    });
    expect(parseServiceDate("2026-08-16-12-00")).toEqual({
      date: "2026-08-16",
      time: "12:00",
    });
  });

  it("accepts the ISO-ish separators too", () => {
    expect(parseServiceDate("2026-07-19T19:30")?.time).toBe("19:30");
    expect(parseServiceDate("2026-07-19 19:30")?.time).toBe("19:30");
  });

  it("returns null for anything else, so callers can fall back", () => {
    for (const bad of ["", "   ", "2026", "19 July 2026", "2026-7-9", undefined, null]) {
      expect(parseServiceDate(bad as string | undefined)).toBeNull();
    }
  });

  it("trims surrounding whitespace", () => {
    expect(parseServiceDate("  2026-11-08  ")).toEqual({ date: "2026-11-08" });
  });
});

describe("serviceDateOnly", () => {
  it("drops an appended time", () => {
    expect(serviceDateOnly("2026-07-19-19-30")).toBe("2026-07-19");
    expect(serviceDateOnly("2026-11-08")).toBe("2026-11-08");
  });

  it("is undefined for an unreadable value", () => {
    expect(serviceDateOnly("nonsense")).toBeUndefined();
  });
});

describe("formatServiceDate", () => {
  /* The actual bug: formatters tested for ^\d{4}-\d{2}-\d{2}$ and fell
     through, so the book's chapter subtitle and the history list printed
     "2026-07-19-19-30" at the reader. */
  it("renders a date with a time instead of printing it raw", () => {
    expect(formatServiceDate("2026-07-19-19-30", ".")).toBe("2026.07.19 19:30");
    expect(formatServiceDate("2026-07-19-19-30")).toBe("2026-07-19 19:30");
  });

  it("renders a plain date in the requested separator", () => {
    expect(formatServiceDate("2026-11-08", ".")).toBe("2026.11.08");
    expect(formatServiceDate("2026-11-08")).toBe("2026-11-08");
  });

  it("hands back an unrecognised value rather than dropping the date", () => {
    expect(formatServiceDate("Advent 2026", ".")).toBe("Advent 2026");
    expect(formatServiceDate("")).toBe("");
    expect(formatServiceDate(undefined)).toBe("");
  });

  /* The book sorts chapters by comparing these strings, and the appended time
     is what puts an evening service after that morning's. Guard the ordering
     the display fix must not disturb. */
  it("keeps the raw strings sorting chronologically", () => {
    const sorted = ["2026-07-26", "2026-07-19-19-30", "2026-07-19"].sort((a, b) =>
      a.localeCompare(b),
    );
    expect(sorted).toEqual(["2026-07-19", "2026-07-19-19-30", "2026-07-26"]);
  });
});
