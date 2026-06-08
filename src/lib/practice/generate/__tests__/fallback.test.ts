import { describe, it, expect } from "vitest";
import { buildFallbackPlan } from "../fallback";
import type { BlockCandidates, Skeleton } from "../types";

const skeleton: Skeleton = {
  totalMinutes: 60, mergedSkillCount: 0,
  blocks: [
    { key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], targetMinutes: 8 },
    { key: "skill-1", name: "Zone", kind: "skill", skillIds: ["zone"], targetMinutes: 40 },
    { key: "cooldown", name: "Cool-Down", kind: "cooldown", skillIds: [], targetMinutes: 12 },
  ],
};
const bc: BlockCandidates[] = [
  { blockKey: "skill-1", gapSkillIds: [], candidates: [
    { drillId: "top", drillName: "Top", categoryName: null, benchmarkTypes: [], defaultDurationMin: 10, skillWeight: 1, drillScore: 0.2, lastRunISO: null },
    { drillId: "other", drillName: "Other", categoryName: null, benchmarkTypes: [], defaultDurationMin: 10, skillWeight: 1, drillScore: 0.5, lastRunISO: null },
  ] },
];

describe("buildFallbackPlan", () => {
  it("picks the top candidate per skill block and sets usedFallback", () => {
    const out = buildFallbackPlan(skeleton, bc);
    expect(out.usedFallback).toBe(true);
    const skill = out.blocks.find((b) => b.blockKey === "skill-1")!;
    expect(skill.drills.map((d) => d.drillId)).toEqual(["top"]);
    expect(skill.rationale).toContain("Zone");
  });
});
