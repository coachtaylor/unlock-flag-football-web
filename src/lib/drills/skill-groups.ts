// Shared skill-group metadata — the single source of truth for how the
// five skill groups render across the app (the DrillForm SkillPicker and
// the team dashboard Skill Radar both consume this).
//
// Colors are hex LITERALS, not CSS vars: Recharts renders inline SVG and
// can't read `var(--uff-*)`, so the radar needs real hex. The values
// mirror the UFF palette in globals.css — keep them in sync if the
// palette shifts (athletic = --uff-lime-400, offense = --uff-orange-500).

import type { SkillGroup } from "@/lib/types/skills";
import { sideForPosition } from "@/lib/positions";

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

// Unambiguous skill-AREA labels for the scouting surface. The short `label`s
// ("Offense"/"Defense"/"QB") collide with the position-room names ("Receivers"/
// "Defense"/"QB room") — so a captain reading "Receivers · Weakest: Defense"
// can't tell a skill area from a position group. These spell the skill area out
// so the two never read the same. Single source; used wherever a skill group is
// shown next to room/position context.
const SKILL_AREA_LABEL: Record<SkillGroup, string> = {
  athletic: "Athleticism",
  offense: "Offensive skills",
  qb: "QB skills",
  defense: "Defensive skills",
  iq: "Football IQ",
};
export function skillAreaLabel(id: SkillGroup): string {
  return SKILL_AREA_LABEL[id];
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

// ── Position ↔ skill-group relevance (Build 8.7 scouting report) ──────────
//
// Which skill groups actually matter for a player's position(s). A corner is
// never graded on "qb"; a receiver is never graded on "defense". athletic + iq
// cut across every position (physical + cognitive); the side-specific group is
// added per listed position. A two-way player gets the union of their
// positions' groups. Mirror to unlock-mobile if/when the scouting report ports.
export function skillGroupsForPositions(
  positions: string[] | null | undefined
): SkillGroup[] {
  const set = new Set<SkillGroup>(["athletic", "iq"]);
  for (const p of positions ?? []) {
    if (p === "QB") set.add("qb");
    else if (sideForPosition(p) === "offense") set.add("offense");
    else if (sideForPosition(p) === "defense") set.add("defense");
  }
  return SKILL_GROUP_META.filter((m) => set.has(m.id)).map((m) => m.id);
}

// Position "rooms" — how captains think about the roster ("QB room", "receiving
// corps", "defense"). A player belongs to a room by PRIMARY position
// (positions[0]). `signature` is the room's defining skill group (the one that
// distinguishes it beyond the universal athletic/iq).
export type PositionRoom = {
  id: "qb" | "offense" | "defense";
  label: string;
  positions: string[];
  signature: SkillGroup;
};

export const POSITION_ROOMS: PositionRoom[] = [
  { id: "qb", label: "QB room", positions: ["QB"], signature: "qb" },
  { id: "offense", label: "Receivers", positions: ["WR", "RB", "C"], signature: "offense" },
  { id: "defense", label: "Defense", positions: ["CB", "S", "LB", "DE", "Rusher"], signature: "defense" },
];

// The room a player belongs to, by primary position. Returns null if the player
// has no positions on record.
export function roomForPrimaryPosition(
  positions: string[] | null | undefined
): PositionRoom | null {
  const primary = positions?.[0];
  if (!primary) return null;
  return POSITION_ROOMS.find((r) => r.positions.includes(primary)) ?? null;
}

// The position room a skill group "belongs" to, for bridging the dashboard's
// skill view to the scouting report's room view. athletic + iq are universal
// (cut across every room) -> null. Used by the focus card tag and the scouting
// headline's focus-skill bridge. Single source so both stay in sync.
export function roomIdForSkillGroup(
  group: SkillGroup
): PositionRoom["id"] | null {
  const room = POSITION_ROOMS.find((r) => r.signature === group);
  return room ? room.id : null;
}
