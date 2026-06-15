import { describe, it, expect } from "vitest";
import { buildFallbackPlan } from "../fallback";
import type { BlockCandidates, Skeleton } from "../types";

const skeleton: Skeleton = {
  totalMinutes: 60, mergedSkillCount: 0,
  blocks: [
    { key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], categorySlugs: ["warmup"], targetMinutes: 10 },
    { key: "team", name: "Team", kind: "team", skillIds: [], categorySlugs: ["scrimmage"], targetMinutes: 50 },
  ],
};
const bc: BlockCandidates[] = [
  { blockKey: "warmup", gapSkillIds: [], candidates: [
    { drillId: "w1", drillName: "W", categoryName: "Warm-up", benchmarkTypes: [], defaultDurationMin: null, skillWeight: 1, drillScore: null, lastRunISO: null },
  ] },
  { blockKey: "team", gapSkillIds: [], candidates: [
    { drillId: "t1", drillName: "T1", categoryName: "Scrimmage", benchmarkTypes: [], defaultDurationMin: null, skillWeight: 1, drillScore: 0.2, lastRunISO: null },
    { drillId: "t2", drillName: "T2", categoryName: "Scrimmage", benchmarkTypes: [], defaultDurationMin: null, skillWeight: 1, drillScore: 0.3, lastRunISO: null },
  ] },
];

describe("buildFallbackPlan", () => {
  it("fills every block up to drillsPerBlock", () => {
    const p = buildFallbackPlan(skeleton, bc, 2);
    expect(p.blocks.find((b) => b.blockKey === "warmup")!.drills.map((d) => d.drillId)).toEqual(["w1"]);
    expect(p.blocks.find((b) => b.blockKey === "team")!.drills.map((d) => d.drillId)).toEqual(["t1", "t2"]);
    expect(p.usedFallback).toBe(true);
  });
});
