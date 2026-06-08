import { describe, it, expect } from "vitest";
import { resolveTargetSkills } from "../resolve-skills";
import type { TargetSkill } from "../types";

const focus: TargetSkill[] = [
  { skillId: "a", skillName: "A", skillGroup: "athletic", avgScore: 0.2 },
  { skillId: "b", skillName: "B", skillGroup: "defense", avgScore: 0.3 },
  { skillId: "c", skillName: "C", skillGroup: "qb", avgScore: 0.4 },
];

describe("resolveTargetSkills", () => {
  it("uses explicit selection when present, preserving order", () => {
    expect(resolveTargetSkills(["c", "a"], focus).map((s) => s.skillId)).toEqual(["c", "a"]);
  });
  it("falls back to team weaknesses when selection empty (capped at 3)", () => {
    expect(resolveTargetSkills([], focus).map((s) => s.skillId)).toEqual(["a", "b", "c"]);
  });
  it("ignores selected ids not in the focus set", () => {
    expect(resolveTargetSkills(["zzz", "b"], focus).map((s) => s.skillId)).toEqual(["b"]);
  });
});
