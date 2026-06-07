// Per-player skill-GROUP progression: weekly weighted-composite trend per
// position-relevant skill group (athletic/offense/qb/defense/iq). Complements
// the snapshot skill profile card and the per-drill progress charts with a
// "is this room trending up?" line. Build 8.
//
// Pure, no I/O. Both the roster player-detail page and the Team Scouting Report
// side sheet feed it the same raw benchmark rows they already fetch.
//
// Scoring mirrors public.v_bench_abs (migration 100_skill_trend.sql): the
// ABSOLUTE per-result score is rating/5 OR made/attempts. Timed benchmarks have
// no absolute scale (cohort-relative → can't form a trend) and are excluded by
// design — their progression lives in the per-drill charts. Weekly weighting +
// Monday bucketing mirror v_team_skill_week, scoped to one player and grouped by
// skill_group instead of skill.

import type { SkillGroup } from "@/lib/types/skills";
import {
  SKILL_GROUP_META,
  skillAreaLabel,
  skillGroupsForPositions,
} from "@/lib/drills/skill-groups";

// Canonical absolute score — keep in sync with public.v_bench_abs.
export function absScore(r: {
  rating: number | null;
  made_count: number | null;
  attempts_count: number | null;
}): number | null {
  if (r.rating != null) return Number(r.rating) / 5;
  if (r.attempts_count != null && r.attempts_count > 0) {
    return Number(r.made_count ?? 0) / Number(r.attempts_count);
  }
  return null;
}

// Monday-anchored week start. Mirrors startOfWeek() in team-home-data.ts and the
// date_trunc('week', …) bucketing in v_team_skill_week (migration 100).
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type SkillGroupTrendRow = {
  drill_id: string;
  assessment_date: string;
  rating: number | null;
  made_count: number | null;
  attempts_count: number | null;
};

export type SkillGroupTrendSeries = {
  group: SkillGroup;
  label: string;
  color: string;
  points: { week: string; score: number; n: number }[]; // score 0..1, week asc
};

export type SkillGroupTrend = {
  weeks: string[]; // distinct week starts present, asc
  series: SkillGroupTrendSeries[]; // position-relevant groups with data
  hasSignal: boolean; // ≥1 group has ≥2 weekly points (enough to draw a line)
};

const WEEKS_WINDOW = 12;

export function buildSkillGroupTrend(args: {
  rows: SkillGroupTrendRow[];
  // drill_id → its tagged skills + weights (from drill_skills)
  drillSkills: Map<string, { skillId: string; weight: number }[]>;
  // skill_id → its skill_group (from skills)
  skillGroupById: Map<string, SkillGroup>;
  positions: string[] | null | undefined;
  now: Date;
}): SkillGroupTrend {
  const relevant = new Set<SkillGroup>(skillGroupsForPositions(args.positions));
  const baseMonday = startOfWeek(args.now);
  const windowStart = new Date(baseMonday);
  windowStart.setDate(windowStart.getDate() - 7 * (WEEKS_WINDOW - 1));

  // (group, week) → weighted sum + weight + distinct sample count.
  type Acc = { wsum: number; w: number; n: number };
  const byGroupWeek = new Map<SkillGroup, Map<string, Acc>>();

  for (const r of args.rows) {
    const s = absScore(r);
    if (s == null) continue;
    const wk = startOfWeek(new Date(r.assessment_date));
    if (wk < windowStart) continue;
    const week = wk.toISOString().slice(0, 10);
    const skills = args.drillSkills.get(r.drill_id);
    if (!skills) continue;
    for (const { skillId, weight } of skills) {
      const g = args.skillGroupById.get(skillId);
      if (!g || !relevant.has(g)) continue;
      let wm = byGroupWeek.get(g);
      if (!wm) {
        wm = new Map();
        byGroupWeek.set(g, wm);
      }
      const acc = wm.get(week) ?? { wsum: 0, w: 0, n: 0 };
      acc.wsum += s * weight;
      acc.w += weight;
      acc.n += 1;
      wm.set(week, acc);
    }
  }

  const weekSet = new Set<string>();
  for (const wm of byGroupWeek.values()) for (const wk of wm.keys()) weekSet.add(wk);
  const weeks = Array.from(weekSet).sort();

  // Series in canonical group order, relevant groups with data only.
  const series: SkillGroupTrendSeries[] = [];
  for (const m of SKILL_GROUP_META) {
    if (!relevant.has(m.id)) continue;
    const wm = byGroupWeek.get(m.id);
    if (!wm || wm.size === 0) continue;
    const points = Array.from(wm.entries())
      .map(([week, acc]) => ({ week, score: acc.w > 0 ? acc.wsum / acc.w : 0, n: acc.n }))
      .sort((a, b) => a.week.localeCompare(b.week));
    series.push({ group: m.id, label: skillAreaLabel(m.id), color: m.color, points });
  }

  const hasSignal = series.some((s) => s.points.length >= 2);
  return { weeks, series, hasSignal };
}
