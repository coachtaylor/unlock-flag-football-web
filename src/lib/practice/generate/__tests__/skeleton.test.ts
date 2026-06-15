import { describe, it, expect } from "vitest";
import { buildSkeleton } from "../skeleton";
import type { WizardInput } from "../types";

const base: WizardInput = {
  teamId: "t", title: "P", practiceDate: "2026-06-14", totalMinutes: 90, format: "7v7",
  includeWarmup: true, includeSkills: true, includeTeamSituational: true,
  customBlocks: [], skills: [{ skillId: "cod", skillName: "Change of Direction", skillGroup: "athletic", avgScore: 0.4 }],
  drillsPerBlock: 2, autoWaterBreaks: true,
};

describe("buildSkeleton", () => {
  it("orders blocks warmup -> skills -> team -> custom and sums to total", () => {
    const s = buildSkeleton({ ...base, customBlocks: [{ name: "Conditioning", source: "conditioning", share: 1 }] });
    expect(s.blocks.map((b) => b.kind)).toEqual(["warmup", "skill", "team", "custom"]);
    expect(s.blocks[s.blocks.length - 1].name).toBe("Conditioning");
    expect(s.blocks.reduce((n, b) => n + b.targetMinutes, 0)).toBe(90);
  });
  it("team block carries the offense/defense/scrimmage category slugs", () => {
    const s = buildSkeleton(base);
    const team = s.blocks.find((b) => b.kind === "team")!;
    expect(team.categorySlugs).toEqual(["offense", "defense", "scrimmage"]);
  });
  it("omits unincluded core blocks", () => {
    const s = buildSkeleton({ ...base, includeTeamSituational: false });
    expect(s.blocks.some((b) => b.kind === "team")).toBe(false);
  });
});
