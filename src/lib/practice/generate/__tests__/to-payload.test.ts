import { describe, it, expect } from "vitest";
import { toSavePayload } from "../to-payload";
import type { GeneratedPlan, Skeleton } from "../types";

const skeleton: Skeleton = {
  totalMinutes: 60, mergedSkillCount: 0,
  blocks: [
    { key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], categorySlugs: ["warmup"], targetMinutes: 8 },
    { key: "skill-1", name: "Zone", kind: "skill", skillIds: ["zone"], categorySlugs: [], targetMinutes: 40 },
    { key: "team", name: "Team / Situational", kind: "team", skillIds: [], categorySlugs: ["offense", "defense", "scrimmage"], targetMinutes: 12 },
  ],
};
const generated: GeneratedPlan = {
  usedFallback: false,
  blocks: [{ blockKey: "skill-1", rationale: "Targets zone", gapProposals: [], drills: [
    { drillId: "d1", coachingCue: "Eyes to the QB" }, { drillId: "d2", coachingCue: "Sink at the stem" },
  ] }],
};

describe("toSavePayload", () => {
  it("stretches the only drill-bearing block to fill the whole practice", () => {
    const p = toSavePayload({ planId: "plan-1", title: "AI practice", practiceDate: "2026-06-14", skeleton, generated });
    expect(p.plan_id).toBe("plan-1");
    expect(p.status).toBe("draft");
    expect(p.blocks.map((b) => b.name)).toEqual(["Warm-Up", "Zone", "Team / Situational"]);
    // warmup + team have no drills → their minutes flow into Zone (8+40+12 = 60).
    expect(p.blocks[0].target_minutes).toBe(0);
    expect(p.blocks[2].target_minutes).toBe(0);
    const zone = p.blocks[1];
    expect(zone.target_minutes).toBe(60);
    expect(zone.drills.map((d) => d.drill_id)).toEqual(["d1", "d2"]);
    expect(zone.drills[0].duration_minutes).toBe(30);
    expect(zone.drills[1].duration_minutes).toBe(30);
    expect(zone.drills[0].notes).toBe("Eyes to the QB");
    expect(zone.drills[0].drill_order).toBe(0);
    expect(p.breaks).toEqual([]);
  });

  it("leaves targets untouched when every block has drills (no-op stretch)", () => {
    const allFilled: GeneratedPlan = {
      usedFallback: false,
      blocks: [
        { blockKey: "warmup", rationale: "", gapProposals: [], drills: [{ drillId: "w1", coachingCue: "" }] },
        { blockKey: "skill-1", rationale: "", gapProposals: [], drills: [{ drillId: "d1", coachingCue: "" }] },
        { blockKey: "team", rationale: "", gapProposals: [], drills: [{ drillId: "t1", coachingCue: "" }] },
      ],
    };
    const p = toSavePayload({ planId: "p", title: "t", practiceDate: "2026-06-14", skeleton, generated: allFilled });
    expect(p.blocks.map((b) => b.target_minutes)).toEqual([8, 40, 12]);
    expect(p.blocks.reduce((n, b) => n + (b.target_minutes ?? 0), 0)).toBe(60);
  });

  it("threads computed water breaks into the payload", () => {
    const p = toSavePayload({
      planId: "", title: "AI practice", practiceDate: "2026-06-14",
      skeleton, generated,
      waterBreaks: [{ afterBlockKey: "skill-1", minutes: 3 }],
    });
    expect(p.breaks).toEqual([{ after_block_order: 1, break_order: 0, duration_minutes: 3 }]);
  });
});
