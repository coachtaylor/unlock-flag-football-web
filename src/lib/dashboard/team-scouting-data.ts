// Team Scouting Report — data loader (Build 8.7).
//
// The read-first analytical surface that replaces the orphaned (app)/benchmarks
// write flow. One Promise.all; all aggregation in JS at MVP roster size. REUSES
// the dashboard's loadTeamFocus and the canonical benchmark value-semantics
// (lib/benchmarks/metrics) so figures can't drift from the team dashboard. No
// new SQL views. (Room composites are derived per-player from
// v_player_skill_profile, not from the radar.)
//
// POSITION-AWARE (the core framing): a player is only graded on the skill groups
// their position(s) actually use — a corner is never graded on "qb", a receiver
// never on "defense" (see skillGroupsForPositions). The team view is organized
// into position ROOMS (QB / Receivers / Defense) so captains read "which room
// needs work", not a flat everyone-on-everything grid.
//
// Narrative spine this feeds (top → bottom on the page):
//   §0 headline  — weakest position room + its gap, corroborated by top tag + biggest gain
//   §1 rooms     — strength per position room (player count, room grade, weakest dimension)
//   §2 movement  — risers / stalled / regressed since last assessment, tagged with position
//   §3 cards     — per-player report cards graded only on position-relevant groups
//   §4 do-next   — CTA into the planner on the weakest skill's recommended drill

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTeamFocus, type TeamFocus } from "@/lib/dashboard/team-home-data";
import {
  valueFromBenchmark,
  isInverse,
  pulseUnit,
  type PulseBenchmarkType,
} from "@/lib/benchmarks/metrics";
import { scoreToGrade, scoreToHeatColor, type Grade } from "@/lib/dashboard/heat-scale";
import { playerColorForIndex } from "@/components/uff/team-colors";
import { initialsFor } from "@/lib/format/initials";
import {
  SKILL_GROUP_META,
  POSITION_ROOMS,
  roomForPrimaryPosition,
  skillGroupsForPositions,
} from "@/lib/drills/skill-groups";
import type { SkillGroup } from "@/lib/types/skills";

/* ─────────────────── output types ─────────────────── */

// §1 — one card per position room (members graded on their relevant groups).
export type RoomCell = {
  id: "qb" | "offense" | "defense";
  label: string;
  players: number; // roster members by primary position
  assessed: number; // members with any composite signal
  score: number | null; // 0..1 avg overall of assessed members
  grade: Grade | null;
  color: string; // heat color (NOT a position/identity color)
  weakestSkillLabel: string | null; // weakest relevant skill group in the room
  locked: boolean; // no assessed members
};

// §2 — a player's movement on one drill since their first assessment.
export type MoverKind = "riser" | "stalled" | "regressed";
export type MoverRow = {
  playerId: string;
  name: string;
  color: string;
  initials: string;
  primaryPosition: string | null;
  drillName: string;
  kind: MoverKind;
  delta: number; // signed, inverse-adjusted (positive = improved)
  unit: string;
  lastDate: string;
};

// §3 — compact per-player report card. groupScores are ONLY the position-relevant
// groups (no QB row for a corner). Per-skill detail + tags/observations for the
// side sheet land in a later increment.
export type GroupScore = {
  group: SkillGroup;
  label: string;
  score: number | null;
  grade: Grade | null;
};
export type PlayerReportCard = {
  playerId: string;
  name: string;
  color: string;
  initials: string;
  positions: string[];
  primaryPosition: string | null;
  roomLabel: string | null;
  overallScore: number | null; // 0..1 avg across measured RELEVANT groups
  overallGrade: Grade | null;
  groupScores: GroupScore[]; // position-relevant groups only
  weakestGroupLabel: string | null; // weakest relevant group (for "weak point")
  benchmarkCount: number;
  noteCount: number;
};

// §0 — the computed "so what" headline, framed around the weakest room.
export type ScoutingHeadline = {
  weakestRoomLabel: string | null;
  weakestRoomScore: number | null; // 0..1
  weakestRoomSkillLabel: string | null; // the gap within that room
  corroboratingTag: string | null;
  corroboratingTagCount: number;
  biggestGain: {
    name: string;
    primaryPosition: string | null;
    drillName: string;
    delta: number;
    unit: string;
  } | null;
  ctaDrillId: string | null;
  ctaDrillName: string | null;
  focusSkillId: string | null;
  hasSignal: boolean;
};

export type TeamScoutingData = {
  headline: ScoutingHeadline;
  rooms: RoomCell[];
  movers: MoverRow[]; // flat, sorted by |delta| desc; section groups by kind
  playerCards: PlayerReportCard[]; // weakest-assessed first, unassessed last
  focus: TeamFocus; // passthrough for §4
  rosterSize: number;
  assessedPlayers: number;
  anyData: boolean;
};

/* ─────────────────── raw row shapes ─────────────────── */

type PlayerRow = {
  id: string;
  player_name: string;
  positions: string[] | null;
  color_index: number | null;
  status: string;
};
type ProfileRow = {
  player_id: string;
  skill_group: SkillGroup;
  composite_score: number | null;
};
type BenchRow = {
  player_id: string;
  drill_id: string;
  assessment_date: string;
  time_seconds: number | null;
  rating: number | null;
  made_count: number | null;
  attempts_count: number | null;
  benchmark_type: string | null;
  tags: string[] | null;
  team_drills: { drill_name: string } | { drill_name: string }[] | null;
};

/* ─────────────────── helpers ─────────────────── */

const GROUP_LABEL = new Map(SKILL_GROUP_META.map((m) => [m.id, m.label]));

function drillNameOf(row: BenchRow): string {
  const j = Array.isArray(row.team_drills) ? row.team_drills[0] : row.team_drills;
  return j?.drill_name ?? "drill";
}

// Movement deadband: a change under 3% of the starting value reads as "stalled".
// Scale-free so it works across timed seconds and 1–5 ratings.
const STALLED_BAND = 0.03;
function classify(improvement: number, first: number): MoverKind {
  const denom = Math.max(Math.abs(first), 0.01);
  const pct = improvement / denom;
  if (pct > STALLED_BAND) return "riser";
  if (pct < -STALLED_BAND) return "regressed";
  return "stalled";
}

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/* ─────────────────── loader ─────────────────── */

export async function loadTeamScoutingData(
  supabase: SupabaseClient,
  teamId: string
): Promise<TeamScoutingData> {
  const [focus, playersRes, profileRes, benchRes, notesRes] = await Promise.all([
    loadTeamFocus(supabase, teamId),
    supabase
      .from("team_players")
      .select("id, player_name, positions, color_index, status")
      .eq("team_id", teamId)
      .eq("status", "active"),
    supabase
      .from("v_player_skill_profile")
      .select("player_id, skill_group, composite_score")
      .eq("team_id", teamId),
    supabase
      .from("benchmark_results")
      .select(
        "player_id, drill_id, assessment_date, time_seconds, rating, made_count, attempts_count, benchmark_type, tags, team_drills(drill_name)"
      )
      .eq("team_id", teamId)
      .order("assessment_date", { ascending: true }),
    supabase.from("player_notes").select("player_id").eq("team_id", teamId),
  ]);

  const players = (playersRes.data ?? []) as PlayerRow[];
  const profiles = (profileRes.data ?? []) as ProfileRow[];
  const benches = (benchRes.data ?? []) as unknown as BenchRow[];
  const notes = (notesRes.data ?? []) as { player_id: string }[];

  const playerById = new Map(players.map((p) => [p.id, p]));

  // player → group → composite
  const profileByPlayer = new Map<string, Map<SkillGroup, number | null>>();
  for (const r of profiles) {
    let g = profileByPlayer.get(r.player_id);
    if (!g) {
      g = new Map();
      profileByPlayer.set(r.player_id, g);
    }
    g.set(r.skill_group, r.composite_score);
  }

  const benchCountByPlayer = new Map<string, number>();
  for (const b of benches) {
    benchCountByPlayer.set(b.player_id, (benchCountByPlayer.get(b.player_id) ?? 0) + 1);
  }
  const noteCountByPlayer = new Map<string, number>();
  for (const n of notes) {
    noteCountByPlayer.set(n.player_id, (noteCountByPlayer.get(n.player_id) ?? 0) + 1);
  }

  /* ── §3 player report cards — graded ONLY on position-relevant groups ── */
  const playerCards: PlayerReportCard[] = players.map((p) => {
    const positions = p.positions ?? [];
    const relevant = skillGroupsForPositions(positions); // athletic + iq + side group(s)
    const groups = profileByPlayer.get(p.id);
    const groupScores: GroupScore[] = relevant.map((id) => {
      const score = groups?.get(id) ?? null;
      return { group: id, label: GROUP_LABEL.get(id) ?? id, score, grade: scoreToGrade(score) };
    });
    const measured = groupScores.filter((g) => g.score != null) as Required<GroupScore>[];
    const overallScore = avg(measured.map((g) => g.score as number));
    const weakest = measured.length
      ? measured.reduce((lo, g) => ((g.score as number) < (lo.score as number) ? g : lo))
      : null;
    const room = roomForPrimaryPosition(positions);
    return {
      playerId: p.id,
      name: p.player_name,
      color: playerColorForIndex(p.color_index ?? 0),
      initials: initialsFor(p.player_name),
      positions,
      primaryPosition: positions[0] ?? null,
      roomLabel: room?.label ?? null,
      overallScore,
      overallGrade: scoreToGrade(overallScore),
      groupScores,
      weakestGroupLabel: weakest?.label ?? null,
      benchmarkCount: benchCountByPlayer.get(p.id) ?? 0,
      noteCount: noteCountByPlayer.get(p.id) ?? 0,
    };
  });

  // weakest assessed first (surfaces who needs work), unassessed last.
  playerCards.sort((a, b) => {
    if (a.overallScore == null && b.overallScore == null) return 0;
    if (a.overallScore == null) return 1;
    if (b.overallScore == null) return -1;
    return a.overallScore - b.overallScore;
  });

  /* ── §1 position rooms — aggregate members by primary position ── */
  const cardsByRoom = new Map<string, PlayerReportCard[]>();
  for (const room of POSITION_ROOMS) cardsByRoom.set(room.id, []);
  for (const c of playerCards) {
    const room = roomForPrimaryPosition(c.positions);
    if (room) cardsByRoom.get(room.id)!.push(c);
  }

  const rooms: RoomCell[] = POSITION_ROOMS.map((room) => {
    const members = cardsByRoom.get(room.id) ?? [];
    const assessedMembers = members.filter((m) => m.overallScore != null);
    const score = avg(assessedMembers.map((m) => m.overallScore as number));
    // weakest dimension in the room: lowest room-avg across relevant groups.
    const perGroup = new Map<string, number[]>();
    for (const m of assessedMembers) {
      for (const g of m.groupScores) {
        if (g.score == null) continue;
        const arr = perGroup.get(g.label) ?? [];
        arr.push(g.score);
        perGroup.set(g.label, arr);
      }
    }
    let weakestSkillLabel: string | null = null;
    let weakestAvg = Infinity;
    for (const [label, vals] of perGroup) {
      const a = avg(vals);
      if (a != null && a < weakestAvg) {
        weakestAvg = a;
        weakestSkillLabel = label;
      }
    }
    return {
      id: room.id,
      label: room.label,
      players: members.length,
      assessed: assessedMembers.length,
      score,
      grade: scoreToGrade(score),
      color: scoreToHeatColor(score),
      weakestSkillLabel,
      locked: assessedMembers.length === 0,
    };
  });

  /* ── §2 movers — first→last per (player, drill), inverse-adjusted ── */
  const byPair = new Map<string, BenchRow[]>();
  for (const b of benches) {
    const k = `${b.player_id}::${b.drill_id}`;
    const arr = byPair.get(k) ?? [];
    arr.push(b);
    byPair.set(k, arr);
  }
  const movers: MoverRow[] = [];
  for (const [, arr] of byPair) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort((a, b) => (a.assessment_date < b.assessment_date ? -1 : 1));
    const type = (sorted[sorted.length - 1].benchmark_type ?? "rated") as PulseBenchmarkType;
    const first = valueFromBenchmark(sorted[0], type);
    const last = valueFromBenchmark(sorted[sorted.length - 1], type);
    if (first == null || last == null) continue;
    const improvement = isInverse(type) ? first - last : last - first;
    const p = playerById.get(sorted[0].player_id);
    if (!p) continue;
    movers.push({
      playerId: p.id,
      name: p.player_name,
      color: playerColorForIndex(p.color_index ?? 0),
      initials: initialsFor(p.player_name),
      primaryPosition: (p.positions ?? [])[0] ?? null,
      drillName: drillNameOf(sorted[sorted.length - 1]),
      kind: classify(improvement, first),
      delta: improvement,
      unit: pulseUnit(type),
      lastDate: sorted[sorted.length - 1].assessment_date,
    });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  /* ── §0 headline — weakest room + its gap ── */
  const tagCounts = new Map<string, number>();
  for (const b of benches) {
    for (const t of b.tags ?? []) {
      if (!t) continue;
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  let corroboratingTag: string | null = null;
  let corroboratingTagCount = 0;
  for (const [tag, n] of tagCounts) {
    if (n > corroboratingTagCount) {
      corroboratingTag = tag;
      corroboratingTagCount = n;
    }
  }

  const weakestRoom = rooms
    .filter((r) => r.score != null)
    .reduce<RoomCell | null>((lo, r) => (lo == null || (r.score as number) < (lo.score as number) ? r : lo), null);
  const topRiser = movers.find((m) => m.kind === "riser") ?? null;
  const focusTop = focus.skills[0] ?? null;
  const ctaDrill = focusTop?.drills[0] ?? null;

  const headline: ScoutingHeadline = {
    weakestRoomLabel: weakestRoom?.label ?? null,
    weakestRoomScore: weakestRoom?.score ?? null,
    weakestRoomSkillLabel: weakestRoom?.weakestSkillLabel ?? null,
    corroboratingTag,
    corroboratingTagCount,
    biggestGain: topRiser
      ? {
          name: topRiser.name,
          primaryPosition: topRiser.primaryPosition,
          drillName: topRiser.drillName,
          delta: topRiser.delta,
          unit: topRiser.unit,
        }
      : null,
    ctaDrillId: ctaDrill?.drillId ?? null,
    ctaDrillName: ctaDrill?.drillName ?? null,
    focusSkillId: focusTop?.skillId ?? null,
    hasSignal: focus.hasSignal,
  };

  const assessedPlayers = playerCards.filter((c) => c.overallScore != null).length;
  const anyData = focus.hasSignal || movers.length > 0 || assessedPlayers > 0;

  return {
    headline,
    rooms,
    movers,
    playerCards,
    focus,
    rosterSize: players.length,
    assessedPlayers,
    anyData,
  };
}
