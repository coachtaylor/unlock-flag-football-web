import { describe, it, expect } from "vitest";
import { buildSkeleton } from "../skeleton";
import type { TargetSkill } from "../types";

const sk = (id: string, name: string): TargetSkill => ({
  skillId: id, skillName: name, skillGroup: "athletic", avgScore: 0.4,
});

describe("buildSkeleton", () => {
  it("90 min / 3 skills => warmup, 3 skill blocks, team, cooldown; sums to 90", () => {
    const s = buildSkeleton({
      teamId: "t", totalMinutes: 90, format: "7v7",
      skills: [sk("a", "Change of Direction"), sk("b", "Zone Coverage"), sk("c", "Route Running")],
    });
    expect(s.totalMinutes).toBe(90);
    expect(s.blocks.reduce((n, b) => n + b.targetMinutes, 0)).toBe(90);
    expect(s.blocks.map((b) => b.kind)).toEqual(["warmup", "skill", "skill", "skill", "team", "cooldown"]);
    expect(s.mergedSkillCount).toBe(0);
    expect(s.blocks.filter((b) => b.kind === "skill").every((b) => b.skillIds.length === 1)).toBe(true);
  });

  it("merges skills when minutes are tight (45 min / 4 skills)", () => {
    const s = buildSkeleton({
      teamId: "t", totalMinutes: 45, format: "5v5",
      skills: [sk("a", "A"), sk("b", "B"), sk("c", "C"), sk("d", "D")],
    });
    expect(s.blocks.reduce((n, b) => n + b.targetMinutes, 0)).toBe(45);
    const skillBlocks = s.blocks.filter((b) => b.kind === "skill");
    expect(skillBlocks.length).toBeLessThan(4);
    expect(s.mergedSkillCount).toBe(4 - skillBlocks.length);
    const covered = skillBlocks.flatMap((b) => b.skillIds).sort();
    expect(covered).toEqual(["a", "b", "c", "d"]);
  });

  it("always emits at least one skill block even for a very short practice", () => {
    const s = buildSkeleton({
      teamId: "t", totalMinutes: 25, format: "5v5", skills: [sk("a", "A"), sk("b", "B")],
    });
    expect(s.blocks.some((b) => b.kind === "skill")).toBe(true);
    expect(s.blocks.reduce((n, b) => n + b.targetMinutes, 0)).toBe(25);
    expect(s.blocks.every((b) => b.targetMinutes > 0)).toBe(true);
  });

  it("labels a merged skill block with '+N more'", () => {
    const s = buildSkeleton({
      teamId: "t", totalMinutes: 40, format: "5v5",
      skills: [sk("a", "Alpha"), sk("b", "Bravo"), sk("c", "Charlie")],
    });
    const merged = s.blocks.find((b) => b.kind === "skill" && b.skillIds.length > 1);
    if (merged) expect(merged.name).toMatch(/\+\d+ more/);
  });
});
