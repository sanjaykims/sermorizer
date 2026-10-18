import { describe, expect, it } from "vitest";
import {
  isSupportedMediaType,
  SUPPORTED_MEDIA_TYPES,
  type MediaType,
} from "../prompt";

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
