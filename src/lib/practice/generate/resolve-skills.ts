import type { TargetSkill } from "./types";

const MAX_AUTO = 3;

/** PURE: explicit ids win (in order); else top team weaknesses (capped). */
export function resolveTargetSkills(selectedIds: string[], teamFocus: TargetSkill[]): TargetSkill[] {
  const byId = new Map(teamFocus.map((s) => [s.skillId, s]));
  if (selectedIds.length) {
    return selectedIds.map((id) => byId.get(id)).filter(Boolean) as TargetSkill[];
  }
  return teamFocus.slice(0, MAX_AUTO);
}
