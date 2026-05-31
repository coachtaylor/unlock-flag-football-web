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

// Guided-tagging map: which skill groups a drill can tag, given its practice
// phase. Keyed by the phase category slug (CatSlug, see drills/atoms). Athletic
// is offered in every phase (position-agnostic); IQ surfaces wherever
// reads/decisions happen. The DrillForm uses this so an Offense-phase drill
// can't carry Defense skills. Mirrors unlock-mobile/constants/skill-groups.ts.
export const PHASE_TO_SKILL_GROUPS: Record<string, SkillGroup[]> = {
  warmup: ["athletic"],
  agilities: ["athletic"],
  conditioning: ["athletic"],
  offense: ["athletic", "offense", "qb", "iq"],
  defense: ["athletic", "defense", "iq"],
  scrimmage: ["athletic", "offense", "qb", "defense", "iq"],
};

// Union of allowed skill groups across a set of phase slugs, in canonical
// SKILL_GROUP_META order.
export function allowedSkillGroupsForPhases(
  phaseSlugs: (string | null | undefined)[]
): SkillGroup[] {
  const set = new Set<SkillGroup>();
  for (const slug of phaseSlugs) {
    const groups = slug ? PHASE_TO_SKILL_GROUPS[slug] : undefined;
    if (groups) for (const g of groups) set.add(g);
  }
  return SKILL_GROUP_META.filter((m) => set.has(m.id)).map((m) => m.id);
}
