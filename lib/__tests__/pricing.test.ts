import { describe, it, expect } from "vitest";
import { usageToCost, formatCost, totalTokens } from "../pricing";

describe("usageToCost", () => {
  it("prices input + output at Claude Opus 5.5 rates", () => {
    // 1M input ($4) + 1M output ($20) = $24.
    expect(usageToCost({ input: 1_000_000, output: 1_000_000 })).toBeCloseTo(24, 5);
  });
  it("prices cache write/read", () => {
    // 1M cache write ($5.00) + 1M cache read ($0.20) = $5.20.
    // Cache read is 0.05x input on Opus 5.5, not the usual 0.1x — pinning it
    // here so a future model swap can't silently re-derive it wrongly.
    expect(
      usageToCost({ cache_create: 1_000_000, cache_read: 1_000_000 }),
    ).toBeCloseTo(5.2, 5);
  });
  it("is zero for empty/undefined usage", () => {
    expect(usageToCost(undefined)).toBe(0);
    expect(usageToCost({})).toBe(0);
  });
});

describe("formatCost", () => {
  it("shows extra precision for sub-cent amounts", () => {
    expect(formatCost(0.0042)).toBe("$0.0042");
    expect(formatCost(0.42)).toBe("$0.420");
    expect(formatCost(1.5)).toBe("$1.50");
    expect(formatCost(0)).toBe("$0.00");
  });
});

describe("totalTokens", () => {
  it("sums all four buckets", () => {
    expect(
      totalTokens({ input: 1, output: 2, cache_create: 3, cache_read: 4 }),
    ).toBe(10);
  });
});
