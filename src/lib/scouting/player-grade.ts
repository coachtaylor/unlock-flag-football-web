// Single source of truth for a player's per-group + overall grade. The scouting
// report and the player-card hero MUST agree, so the math lives here and both
// import it (a previous inline copy on the player page drifted C→D — exactly the
// duplication this consolidates away).
//
// A player is graded ONLY on the skill groups relevant to their position(s).
// The group composite is the v_player_skill_profile composite per group (last
// row per group wins — matches how the team loader built `profileByPlayer`).
// Overall = mean of the measured relevant groups, then letter-graded.

import type { SkillGroup } from "@/lib/types/skills";
import { scoreToGrade, type Grade } from "@/lib/dashboard/heat-scale";
import { skillGroupsForPositions, skillAreaLabel } from "@/lib/drills/skill-groups";

export type GroupScore = {
  group: SkillGroup;
  label: string;
  score: number | null; // 0..1
  grade: Grade | null;
};

export type PlayerGroupGrades = {
  groupScores: GroupScore[]; // position-relevant groups, canonical order
  overallScore: number | null; // 0..1 mean of measured relevant groups
  overallGrade: Grade | null;
};

// group → composite (0..1). Last row per group wins, matching the team loader.
export function groupCompositesFromProfile(
  rows: { skill_group: SkillGroup; composite_score: number | null }[],
): Map<SkillGroup, number | null> {
  const m = new Map<SkillGroup, number | null>();
  for (const r of rows) m.set(r.skill_group, r.composite_score);
  return m;
}

export function gradePlayerGroups(
  groupComposites: Map<SkillGroup, number | null>,
  positions: string[] | null | undefined,
): PlayerGroupGrades {
  const relevant = skillGroupsForPositions(positions ?? []);
  const groupScores: GroupScore[] = relevant.map((id) => {
    const score = groupComposites.get(id) ?? null;
    return { group: id, label: skillAreaLabel(id), score, grade: scoreToGrade(score) };
  });
  const measured = groupScores.filter((g) => g.score != null);
  const overallScore = measured.length
    ? measured.reduce((a, g) => a + (g.score as number), 0) / measured.length
    : null;
  return { groupScores, overallScore, overallGrade: scoreToGrade(overallScore) };
}
