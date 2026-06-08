import { describe, it, expect } from "vitest";
import { canonicalSourceKey, FAIR_USE_MONTHLY_CAP, isOverCap } from "../dedupe";

describe("canonicalSourceKey", () => {
  it("strips tracking params + trailing slash + lowercases host", () => {
    expect(canonicalSourceKey("https://YouTube.com/watch?v=abc&utm_source=x"))
      .toBe(canonicalSourceKey("https://youtube.com/watch?v=abc"));
  });
  it("returns null for junk", () => {
    expect(canonicalSourceKey("nope")).toBeNull();
  });
});

describe("isOverCap", () => {
  it("true at/over the cap, false under", () => {
    expect(isOverCap(FAIR_USE_MONTHLY_CAP)).toBe(true);
    expect(isOverCap(FAIR_USE_MONTHLY_CAP - 1)).toBe(false);
  });
});
