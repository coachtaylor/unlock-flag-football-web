import { describe, it, expect } from "vitest";
import { validatePlanOutput } from "../ai-contract";
import type { BlockCandidates, Skeleton } from "../types";

const skeleton: Skeleton = {
  totalMinutes: 60, mergedSkillCount: 0,
  blocks: [
    { key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], categorySlugs: ["warmup"], targetMinutes: 8 },
    { key: "skill-1", name: "Zone", kind: "skill", skillIds: ["zone", "press"], categorySlugs: [], targetMinutes: 40 },
    { key: "team", name: "Team / Situational", kind: "team", skillIds: [], categorySlugs: ["offense", "defense", "scrimmage"], targetMinutes: 12 },
  ],
};
const blockCandidates: BlockCandidates[] = [
  { blockKey: "warmup", candidates: [], gapSkillIds: [] },
  { blockKey: "skill-1", candidates: [
      { drillId: "d1", drillName: "D1", categoryName: null, benchmarkTypes: [], defaultDurationMin: 10, skillWeight: 1, drillScore: 0.3, lastRunISO: null },
    ], gapSkillIds: ["press"] },
  { blockKey: "team", candidates: [], gapSkillIds: [] },
];

describe("validatePlanOutput", () => {
  it("drops unknown blocks and non-candidate drills", () => {
    const out = validatePlanOutput({
      blocks: [
        { blockKey: "ghost", rationale: "x", drills: [{ drillId: "d1", coachingCue: "c" }], gapProposals: [] },
        { blockKey: "skill-1", rationale: "Targets zone", drills: [
            { drillId: "d1", coachingCue: "Stay over the top" },
            { drillId: "hallucinated", coachingCue: "nope" },
          ], gapProposals: [] },
      ],
    }, skeleton, blockCandidates);
    const skill = out.blocks.find((b) => b.blockKey === "skill-1")!;
    expect(out.blocks.some((b) => b.blockKey === "ghost")).toBe(false);
    expect(skill.drills.map((d) => d.drillId)).toEqual(["d1"]);
    expect(out.usedFallback).toBe(false);
  });

  it("keeps gap proposals only for real gap skills and clamps text", () => {
    const out = validatePlanOutput({
      blocks: [{ blockKey: "skill-1", rationale: "r".repeat(200), drills: [], gapProposals: [
        { skillId: "press", name: "Press Bail", description: "d".repeat(900), category: "defense" },
        { skillId: "zone", name: "bogus", description: "zone has drills", category: "defense" },
      ] }],
    }, skeleton, blockCandidates);
    const skill = out.blocks.find((b) => b.blockKey === "skill-1")!;
    expect(skill.gapProposals.map((g) => g.skillId)).toEqual(["press"]);
    expect(skill.gapProposals[0].description.length).toBe(400);
    expect(skill.rationale.length).toBe(140);
  });
});
