import { describe, it, expect } from "vitest";
import { computeWaterBreaks } from "../water-breaks";

const blocks = [
  { key: "warmup", targetMinutes: 15 },
  { key: "skill-1", targetMinutes: 25 },
  { key: "team", targetMinutes: 30 },
  { key: "cond", targetMinutes: 20 },
]; // cumulative: 15, 40, 70, 90

describe("computeWaterBreaks", () => {
  it("inserts a break after the block crossing each 30-min mark, never trailing", () => {
    const breaks = computeWaterBreaks(blocks, { everyMin: 30, durationMin: 3, enabled: true });
    // crosses 30 during skill-1 (ends 40) and 60 during team (ends 70); 90-mark is the end → no trailing break
    expect(breaks).toEqual([
      { afterBlockKey: "skill-1", minutes: 3 },
      { afterBlockKey: "team", minutes: 3 },
    ]);
  });
  it("returns [] when disabled", () => {
    expect(computeWaterBreaks(blocks, { everyMin: 30, durationMin: 3, enabled: false })).toEqual([]);
  });
});
