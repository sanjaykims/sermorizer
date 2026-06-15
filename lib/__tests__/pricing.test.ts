import { describe, it, expect } from "vitest";
import { usageToCost, formatCost, totalTokens } from "../pricing";

describe("usageToCost", () => {
  it("prices input + output at Opus 4.8 rates", () => {
    // 1M input ($5) + 1M output ($25) = $30.
    expect(usageToCost({ input: 1_000_000, output: 1_000_000 })).toBeCloseTo(30, 5);
  });
  it("prices cache write/read", () => {
    // 1M cache write ($6.25) + 1M cache read ($0.50) = $6.75.
    expect(
      usageToCost({ cache_create: 1_000_000, cache_read: 1_000_000 }),
    ).toBeCloseTo(6.75, 5);
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
