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
  it("maps skeleton+generated into SavePlanPayload with split durations", () => {
    const p = toSavePayload({ planId: "plan-1", title: "AI practice", practiceDate: "2026-06-14", skeleton, generated });
    expect(p.plan_id).toBe("plan-1");
    expect(p.status).toBe("draft");
    expect(p.blocks.map((b) => b.name)).toEqual(["Warm-Up", "Zone", "Team / Situational"]);
    const zone = p.blocks[1];
    expect(zone.target_minutes).toBe(40);
    expect(zone.drills.map((d) => d.drill_id)).toEqual(["d1", "d2"]);
    expect(zone.drills[0].duration_minutes).toBe(20);
    expect(zone.drills[0].notes).toBe("Eyes to the QB");
    expect(zone.drills[0].drill_order).toBe(0);
    expect(p.breaks).toEqual([]);
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
