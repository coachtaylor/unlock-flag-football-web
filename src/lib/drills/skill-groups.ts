// Shared skill-group metadata — the single source of truth for how the
// five skill groups render across the app (the DrillForm SkillPicker and
// the team dashboard Skill Radar both consume this).
//
// Colors are hex LITERALS, not CSS vars: Recharts renders inline SVG and
// can't read `var(--uff-*)`, so the radar needs real hex. The values
// mirror the UFF palette in globals.css — keep them in sync if the
// palette shifts (athletic = --uff-lime-400, offense = --uff-orange-500).

import type { SkillGroup } from "@/lib/types/skills";

export type SkillGroupMeta = {
  id: SkillGroup;
  // Short label for tight UI (radar spokes, legend rows).
  label: string;
  // Verbose label for roomier UI (the DrillForm picker group headers).
  longLabel: string;
  color: string; // hex
  blurb: string;
};

// Display order = radar spoke order, clockwise from the top.
export const SKILL_GROUP_META: SkillGroupMeta[] = [
  {
    id: "athletic",
    label: "Athletic",
    longLabel: "Athletic",
    color: "#C2FF3D",
    blurb: "Physical attributes — applies to every position.",
  },
  {
    id: "offense",
    label: "Offense",
    longLabel: "Offense — Skill Position",
    color: "#FF6A1A",
    blurb: "Catching, routes, separation, YAC.",
  },
  {
    id: "qb",
    label: "QB",
    longLabel: "QB",
    color: "#6EA8FF",
    blurb: "Throwing accuracy at distance + off-platform.",
  },
  {
    id: "defense",
    label: "Defense",
    longLabel: "Defense",
    color: "#B89BFF",
    blurb: "Flag pull, coverage, pursuit, rush.",
  },
  {
    id: "iq",
    label: "IQ",
    longLabel: "Football IQ",
    color: "#FFB347",
    blurb: "Coach-rated cognitive skills — no objective drill captures them.",
  },
];

const BY_ID: Record<SkillGroup, SkillGroupMeta> = SKILL_GROUP_META.reduce(
  (acc, g) => {
    acc[g.id] = g;
    return acc;
  },
  {} as Record<SkillGroup, SkillGroupMeta>
);

export function skillGroupMeta(id: SkillGroup): SkillGroupMeta {
  return BY_ID[id];
}
