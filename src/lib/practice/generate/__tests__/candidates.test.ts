import { describe, it, expect } from "vitest";
import { assembleBlockCandidates } from "../candidates";
import type { CandidateDrill, SkeletonBlock } from "../types";

const NOW = "2026-06-07T00:00:00.000Z";
const cand = (p: Partial<CandidateDrill> & { drillId: string; drillName: string }): CandidateDrill => ({
  categoryName: "defense", benchmarkTypes: [], defaultDurationMin: 10,
  skillWeight: 1, drillScore: 0.5, lastRunISO: null, ...p,
});
const skillBlock: SkeletonBlock = {
  key: "skill-1", name: "Zone Coverage", kind: "skill", skillIds: ["zone"], targetMinutes: 20,
};

describe("assembleBlockCandidates", () => {
  it("ranks primary weight, then stale, then weaker score", () => {
    const bySkill = new Map<string, CandidateDrill[]>([
      ["zone", [
        cand({ drillId: "secondary", drillName: "Sec", skillWeight: 0.5, drillScore: 0.1 }),
        cand({ drillId: "recent", drillName: "Recent", skillWeight: 1, drillScore: 0.2, lastRunISO: NOW }),
        cand({ drillId: "weak-stale", drillName: "WeakStale", skillWeight: 1, drillScore: 0.2, lastRunISO: null }),
        cand({ drillId: "strong-stale", drillName: "StrongStale", skillWeight: 1, drillScore: 0.8, lastRunISO: null }),
      ]],
    ]);
    const out = assembleBlockCandidates(skillBlock, bySkill, NOW);
    expect(out.candidates.map((c) => c.drillId)).toEqual(["weak-stale", "strong-stale", "recent", "secondary"]);
    expect(out.gapSkillIds).toEqual([]);
  });

  it("flags a gap when a targeted skill has no drills", () => {
    const block: SkeletonBlock = { ...skillBlock, skillIds: ["zone", "press"] };
    const bySkill = new Map<string, CandidateDrill[]>([["zone", [cand({ drillId: "z", drillName: "Z" })]]]);
    const out = assembleBlockCandidates(block, bySkill, NOW);
    expect(out.gapSkillIds).toEqual(["press"]);
    expect(out.candidates.map((c) => c.drillId)).toEqual(["z"]);
  });

  it("dedups a drill tagged to two skills and caps at 6", () => {
    const block: SkeletonBlock = { ...skillBlock, skillIds: ["a", "b"] };
    const shared = cand({ drillId: "dup", drillName: "Dup", drillScore: 0 });
    const bySkill = new Map<string, CandidateDrill[]>([
      ["a", [shared, ...Array.from({ length: 5 }, (_, i) => cand({ drillId: `a${i}`, drillName: `A${i}` }))]],
      ["b", [shared, ...Array.from({ length: 5 }, (_, i) => cand({ drillId: `b${i}`, drillName: `B${i}` }))]],
    ]);
    const out = assembleBlockCandidates(block, bySkill, NOW);
    expect(out.candidates.filter((c) => c.drillId === "dup").length).toBe(1);
    expect(out.candidates.length).toBe(6);
  });

  it("returns empty for non-skill blocks", () => {
    const warm: SkeletonBlock = { key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], targetMinutes: 10 };
    const out = assembleBlockCandidates(warm, new Map(), NOW);
    expect(out.candidates).toEqual([]);
    expect(out.gapSkillIds).toEqual([]);
  });
});
