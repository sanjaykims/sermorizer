import { describe, expect, it } from "vitest";
import {
  isSupportedMediaType,
  SUPPORTED_MEDIA_TYPES,
  PART_SYSTEM_PROMPT,
  GENERATION_SYSTEM_PROMPT,
  type MediaType,
} from "../prompt";
import { ENHANCE_LAYOUT_CSS } from "../enhance";

/**
 * `ImagePayload.media_type` is a narrow union so the compiler can check the
 * whole Messages API request body (before this it was `string`, which forced a
 * cast at the call site and hid the request shape entirely). A union proves
 * nothing at runtime though — request bodies arrive as JSON — so the route
 * guards every attachment with `isSupportedMediaType`. These pin both halves.
 */
describe("isSupportedMediaType", () => {
  it("accepts every media type the Messages API takes", () => {
    for (const t of SUPPORTED_MEDIA_TYPES) {
      expect(isSupportedMediaType(t)).toBe(true);
    }
  });

  it("accepts the four base64 image types and the one document type", () => {
    expect([...SUPPORTED_MEDIA_TYPES].sort()).toEqual(
      [
        "application/pdf",
        "image/gif",
        "image/jpeg",
        "image/png",
        "image/webp",
      ].sort(),
    );
  });

  it("rejects formats a phone picker can realistically produce", () => {
    // iPhones hand back HEIC; some Android pickers report an empty type. Both
    // would otherwise reach the API and return a 400 naming no attachment.
    expect(isSupportedMediaType("image/heic")).toBe(false);
    expect(isSupportedMediaType("image/heif")).toBe(false);
    expect(isSupportedMediaType("image/avif")).toBe(false);
    expect(isSupportedMediaType("")).toBe(false);
  });

  it("rejects non-string and missing values without throwing", () => {
    // The guard runs on `p?.media_type` straight off parsed JSON, so it has to
    // survive anything — a malformed body must 415, never crash the route.
    expect(isSupportedMediaType(undefined)).toBe(false);
    expect(isSupportedMediaType(null)).toBe(false);
    expect(isSupportedMediaType(42)).toBe(false);
    expect(isSupportedMediaType({ media_type: "image/jpeg" })).toBe(false);
    expect(isSupportedMediaType(["image/jpeg"])).toBe(false);
  });

  it("is case-sensitive, matching the API's own matching", () => {
    expect(isSupportedMediaType("IMAGE/JPEG")).toBe(false);
    expect(isSupportedMediaType("Image/Png")).toBe(false);
  });

  it("narrows the type for the caller", () => {
    const v: unknown = "image/jpeg";
    if (isSupportedMediaType(v)) {
      const narrowed: MediaType = v; // compiles only if the predicate narrows
      expect(narrowed).toBe("image/jpeg");
    } else {
      throw new Error("expected image/jpeg to be supported");
    }
  });
});

/**
 * These pin couplings that are invisible at the type level: the stitcher reads
 * an attribute only the prompt can cause to exist, and the stylesheet carries
 * defenses for markup the model can emit despite the prompt. Each was a real
 * defect in the 2026-11-08 summary.
 */
describe("prompt / stylesheet guards from the 2026-11-08 review", () => {
  it("asks split parts for the data-takeaway the stitcher consumes", () => {
    // lib/stitch.ts reads sec.getAttribute("data-takeaway"); if the prompt
    // stops asking for it, every split sermon silently reverts to a summary
    // that just echoes the section headings.
    expect(PART_SYSTEM_PROMPT).toContain("data-takeaway");
  });

  it("tells parts not to guess their own section offset", () => {
    expect(PART_SYSTEM_PROMPT).toMatch(/renumbers every badge and id/i);
  });

  it("forbids nesting a blockquote inside .key-verse in both prompts", () => {
    expect(GENERATION_SYSTEM_PROMPT).toMatch(/box inside a box/i);
    expect(PART_SYSTEM_PROMPT).toMatch(/box inside a box/i);
  });

  it("fixes one scripture-reference form and an en dash in both prompts", () => {
    for (const p of [GENERATION_SYSTEM_PROMPT, PART_SYSTEM_PROMPT]) {
      expect(p).toContain('<p class="bref">');
      expect(p).toContain("4:6–7");
    }
  });

  it("keeps the stylesheet defense that flattens a quote nested in .key-verse", () => {
    // Belt and braces for the prompt rule above: the document is
    // model-generated, so the CSS must survive a wrapper we did not ask for.
    expect(ENHANCE_LAYOUT_CSS).toContain(".key-verse>blockquote");
  });
});
