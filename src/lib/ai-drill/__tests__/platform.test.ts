import { describe, it, expect } from "vitest";
import { resolvePlatform } from "../platform";

describe("resolvePlatform", () => {
  it("detects youtube watch + short + youtu.be", () => {
    expect(resolvePlatform("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(resolvePlatform("https://youtu.be/abc")).toBe("youtube");
    expect(resolvePlatform("https://youtube.com/shorts/abc")).toBe("youtube");
  });
  it("detects tiktok", () => {
    expect(resolvePlatform("https://www.tiktok.com/@coach/video/123")).toBe("tiktok");
    expect(resolvePlatform("https://vm.tiktok.com/ZABC/")).toBe("tiktok");
  });
  it("detects instagram reels", () => {
    expect(resolvePlatform("https://www.instagram.com/reel/abc/")).toBe("instagram");
  });
  it("falls back to other for unknown hosts", () => {
    expect(resolvePlatform("https://example.com/x")).toBe("other");
  });
  it("returns null for non-urls", () => {
    expect(resolvePlatform("not a url")).toBeNull();
  });
});
