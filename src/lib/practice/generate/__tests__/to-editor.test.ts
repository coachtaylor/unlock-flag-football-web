import { describe, it, expect } from "vitest";
import { toEditorBlocks } from "../to-editor";
import type { GeneratedPlan, Skeleton } from "../types";

type Entry = { id: string; name: string };

const skeleton: Skeleton = {
  totalMinutes: 60,
  mergedSkillCount: 0,
  blocks: [
    { key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], targetMinutes: 8 },
    { key: "skill-1", name: "Zone", kind: "skill", skillIds: ["zone"], targetMinutes: 40 },
    { key: "cooldown", name: "Cool-Down", kind: "cooldown", skillIds: [], targetMinutes: 12 },
  ],
};

const generated: GeneratedPlan = {
  usedFallback: false,
  blocks: [
    {
      blockKey: "skill-1",
      rationale: "Targets zone",
      gapProposals: [],
      drills: [
        { drillId: "d1", coachingCue: "Eyes to the QB" },
        { drillId: "ghost", coachingCue: "Adopted gap drill not in catalog" },
        { drillId: "d2", coachingCue: "Sink at the stem" },
      ],
    },
  ],
};

const catalog = new Map<string, Entry>([
  ["d1", { id: "d1", name: "Mirror Drill" }],
  ["d2", { id: "d2", name: "Zone Read" }],
]);

describe("toEditorBlocks", () => {
  it("returns one spec per skeleton block in order, resolving drills against the catalog", () => {
    const specs = toEditorBlocks(skeleton, generated, catalog);
    expect(specs.map((s) => s.name)).toEqual(["Warm-Up", "Zone", "Cool-Down"]);
    // Skill block resolves d1 + d2 in order; "ghost" (not in catalog) is dropped.
    expect(specs[1].drills.map((d) => d.id)).toEqual(["d1", "d2"]);
    // Blocks with no generated match come back named but empty.
    expect(specs[0].drills).toEqual([]);
    expect(specs[2].drills).toEqual([]);
  });
});
