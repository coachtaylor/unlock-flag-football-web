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
  buildPlayerHistory,
  unitFor,
  formatValue,
  type BenchHistoryRow,
  type PlayerHistoryDrill,
  type PlayerHistoryLocked,
} from "@/lib/benchmarks/player-history";
import {
  buildSkillGroupTrend,
  type SkillGroupTrend,
} from "@/lib/benchmarks/skill-group-trend";
import { loadSkillGroupMaps } from "@/lib/benchmarks/skill-group-maps";
import type { ObservationRowData } from "@/components/dashboard/ObservationsFeed";
import type { PlayerSkill } from "@/components/dashboard/widgets/PlayerSkillProfileCard";
import { confidenceTier } from "@/lib/benchmarks/confidence";
import {
  gradePlayerGroups,
  relativeStandingFor,
  type RelativeStanding,
} from "@/lib/scouting/player-grade";
// Re-exported so existing importers (ScoutingSections) keep their import path.
export type { RelativeStanding };
import {
  POSITION_ROOMS,
  roomForPrimaryPosition,
  roomIdForSkillGroup,
  skillAreaLabel,
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
  // Weakest skill AREA in the room — scoped to the room's OWN skill groups
  // (athletic + iq + signature), so a two-way player's off-position score can't
  // mislabel the room (a Defense room can never read "weakest: offense").
  // Label is the disambiguated skill-area name.
  weakestSkillLabel: string | null;
  weakestGroup: SkillGroup | null;
  ctaFocusSkillId: string | null; // planner deep-link for the room's weakest area
  locked: boolean; // no assessed members → no grade
  // The grade ALWAYS shows from the first assessment; gradeReliable=false (1–2
  // assessed) only marks it *provisional* in the UI — it never hides the number.
  gradeReliable: boolean;
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
// groups (no QB row for a corner). The card face shows the summary; the side
// sheet (Build 8.7 Phase 3) shows the full per-player evidence carried below
// (history / skillProfile / observations / recentTags / editableResults) — all
// pre-loaded so opening the sheet never fetches.
export type GroupScore = {
  group: SkillGroup;
  label: string;
  score: number | null;
  grade: Grade | null;
};
// One correctable benchmark row, surfaced in the sheet's "Recent results" so a
// captain can fix a fat-fingered capture from the desk.
export type EditableResult = {
  id: string;
  drillName: string;
  benchmarkType: string | null;
  date: string;
  timeSeconds: number | null;
  rating: number | null;
  madeCount: number | null;
  attemptsCount: number | null;
  label: string; // formatted current value
  unit: string;
};
// The volume-aware "so what" for one player. `dataState` walks the claim ladder
// (§12.2a): measurement (1 entry) → direction (2) → verdict (3+ reliable). The
// header never goes blank — it just makes a weaker, honest claim at low volume.
export type PlayerVerdict = {
  dataState: "none" | "measurement" | "direction" | "verdict";
  roleRead: string; // "Development project" / "Reliable starter" / "Early read"
  headline: string; // one sentence, value-forward
  gapSkillId: string | null; // weakest RELIABLE skill (verdict tier only)
  gapSkillLabel: string | null;
  gapScore: number | null; // 0..1
  ctaLabel: string;
};
// A player's standing WITHIN their position room — the cohort = roommates by
// primary position. Answers "are they OUR problem at this position?" (relative)
// next to the absolute grade's "are they good?". Only computed when the room has
// ≥ STANDING_MIN assessed members, so a rank is a real read ("3rd of 5
// receivers"), not noise off one or two players. `null` ⇒ cohort too thin;
// the UI shows only the absolute grade.
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
  verdict: PlayerVerdict;
  relativeStanding: RelativeStanding | null; // §3 cohort rank (null = thin room)
  benchmarkCount: number;
  noteCount: number;
  // ── side-sheet evidence (pre-loaded) ──
  historyDrills: PlayerHistoryDrill[];
  historyLocked: PlayerHistoryLocked[];
  skillGroupTrend: SkillGroupTrend;
  skillProfile: PlayerSkill[];
  observations: ObservationRowData[];
  recentTags: { tag: string; count: number }[];
  editableResults: EditableResult[];
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

// §0 — a single team-level decision in Claim → Evidence → Action form. The page
// leads with 1–3 of these, volume-aware (§12.4): at low coverage the lead is a
// coverage nudge ("benchmarked 4/15 — here's where they stand"); once a room is
// reliably graded it becomes the room-weakness verdict, joined by depth-risk and
// shared-gap decisions when the data supports them. The player cards are the
// drill-down beneath these.
export type TeamDecisionKind = "coverage" | "room_weakness" | "depth_risk" | "shared_gap";
export type TeamDecision = {
  id: string;
  kind: TeamDecisionKind;
  tone: "attention" | "neutral";
  claim: string; // the conclusion (leads)
  evidence: string; // why — the backing data
  actionLabel: string; // CTA text
  focusSkillId: string | null; // planner deep-link target when present
};

// §2b — per-drill standings. The practice-1 payoff: even one session lets a
// coach rank everyone on a drill. Pure measurement, no verdict — so it's honest
// and useful from the very first benchmark.
export type DrillLeaderRow = {
  playerId: string;
  name: string;
  color: string;
  initials: string;
  primaryPosition: string | null;
  value: number;
  label: string;
  unit: string;
  date: string;
};
export type DrillLeaderboard = {
  drillId: string;
  drillName: string;
  benchmarkType: string | null;
  better: "higher" | "lower";
  playersAssessed: number;
  rows: DrillLeaderRow[]; // ranked best → worst
};

export type TeamScoutingData = {
  headline: ScoutingHeadline;
  decisions: TeamDecision[]; // §0 — the 1–3 team decisions, volume-aware
  rooms: RoomCell[];
  movers: MoverRow[]; // flat, sorted by |delta| desc; section groups by kind
  drillLeaderboards: DrillLeaderboard[]; // §2b — best-covered drills first
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
  skill_id: string;
  skill_name: string;
  skill_group: SkillGroup;
  composite_score: number | null;
  drill_sample_size: number | null;
};
type DrillJoin = {
  id?: string;
  drill_name: string;
  benchmark_type: string | null;
  benchmark_types: string[] | null;
};
// Row shape is a superset of BenchHistoryRow (so it feeds buildPlayerHistory
// directly) plus the team-wide fields the loader aggregates (player_id, tags).
type BenchRow = BenchHistoryRow & {
  player_id: string;
  tags: string[] | null;
  team_drills: DrillJoin | DrillJoin[] | null;
};

/* ─────────────────── helpers ─────────────────── */

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

export function roleReadFromGrade(grade: Grade | null): string {
  switch (grade) {
    case "A":
      return "Anchor";
    case "B":
      return "Reliable starter";
    case "C":
      return "Contributor · inconsistent";
    case "D":
      return "Development project";
    case "F":
      return "Major project";
    default:
      return "Early read";
  }
}

/* ── §3 role-relative standing helpers ── */
// Two related-but-distinct cohort thresholds:
// • STANDING_MIN — a relative rank ("bottom of the Receivers room", §3) needs a
//   real cohort to mean anything; you can't rank 1 player against themselves.
// • ROOM_RELIABLE_MIN — confidence on a room's ABSOLUTE grade (§1). Per product
//   decision the room grade ALWAYS shows from the first assessment (the §12.2a
//   "show the number" rule); this only flips the grade to a *provisional* marker
//   when it rests on 1–2 players. Grading ≠ ranking, so the two are separate.
// Confidence on a room's ABSOLUTE grade (§1) — flips the grade to a *provisional*
// marker when it rests on 1–2 players. (Relative ranking lives in the shared
// relativeStandingFor() in player-grade.ts.)
const ROOM_RELIABLE_MIN = 3;

// The volume-aware player verdict (§12.2a claim ladder). Reliable skills →
// a real gap verdict + planner CTA; below that, an honest measurement read that
// still names the strongest thing seen so far. Never blank.
function buildVerdict(args: {
  firstName: string;
  overallGrade: Grade | null;
  skillProfile: PlayerSkill[];
  recentTags: { tag: string; count: number }[];
  historyDrills: { samples: unknown[] }[];
  benchmarkCount: number;
}): PlayerVerdict {
  const { firstName, overallGrade, skillProfile, recentTags, historyDrills, benchmarkCount } = args;

  if (benchmarkCount === 0) {
    return {
      dataState: "none",
      roleRead: "Not benchmarked",
      headline: `No benchmarks yet — run a drill to start ${firstName}'s read.`,
      gapSkillId: null,
      gapSkillLabel: null,
      gapScore: null,
      ctaLabel: "Plan a practice",
    };
  }

  const reliable = skillProfile
    .filter((s) => confidenceTier(s.sampleSize) === "reliable")
    .sort((a, b) => a.composite - b.composite); // weakest first
  const topTag = recentTags[0] ?? null;

  if (reliable.length > 0) {
    const gap = reliable[0];
    const tagPart = topTag ? ` · ${topTag.count}× "${topTag.tag}"` : "";
    return {
      dataState: "verdict",
      roleRead: roleReadFromGrade(overallGrade),
      headline: `Biggest reliable gap: ${gap.skillName} (${(gap.composite * 5).toFixed(1)}/5)${tagPart}.`,
      gapSkillId: gap.skillId,
      gapSkillLabel: gap.skillName,
      gapScore: gap.composite,
      ctaLabel: `Plan ${gap.skillName} work`,
    };
  }

  // No reliable verdict yet — honest measurement/direction read with value.
  const measured = skillProfile.length;
  const hasMovement = historyDrills.some((d) => d.samples.length >= 2);
  const top = [...skillProfile].sort((a, b) => b.composite - a.composite)[0] ?? null;
  const topPart = top
    ? ` Strongest so far: ${top.skillName} ${(top.composite * 5).toFixed(1)}/5 (early).`
    : "";
  return {
    dataState: hasMovement ? "direction" : "measurement",
    roleRead: "Early read",
    headline: `Measured ${measured} skill${measured === 1 ? "" : "s"} across ${benchmarkCount} benchmark${benchmarkCount === 1 ? "" : "s"}.${topPart} Reads lock in at 3 drills each.`,
    gapSkillId: null,
    gapSkillLabel: null,
    gapScore: null,
    ctaLabel: "Plan a practice",
  };
}

// Canonical link from ANY scouting "Plan…" CTA into the practice editor. Always
// carries `fromScouting=1` so the editor opens the "Build from scouting" drawer
// (even for group-level gaps like "Plan a block on Athleticism" that have no
// single skill id); adds `focusSkill` when a specific skill is known so the
// drawer expands to it. One source so every CTA behaves the same.
export function planFromScoutingHref(teamId: string, focusSkillId: string | null): string {
  const qs = focusSkillId
    ? `fromScouting=1&focusSkill=${encodeURIComponent(focusSkillId)}`
    : `fromScouting=1`;
  return `/dashboard/team/${teamId}/practice/new?${qs}`;
}

// Pick the weakest room to headline. Prefers rooms with a RELIABLE grade (≥3
// assessed) so the lead claim doesn't rest on one player; falls back to the
// weakest of any graded room, flagged provisional so the evidence stays honest.
function pickWeakestRoom(rooms: RoomCell[]): { room: RoomCell | null; provisional: boolean } {
  const scored = rooms.filter((r) => r.score != null);
  const reliable = scored.filter((r) => r.gradeReliable);
  const pool = reliable.length > 0 ? reliable : scored;
  const room = pool.reduce<RoomCell | null>(
    (lo, r) => (lo == null || (r.score as number) < (lo.score as number) ? r : lo),
    null
  );
  return { room, provisional: room != null && !room.gradeReliable };
}

// The volume-aware team decisions (§0). Returns 1–3, priority-ordered: a lead
// (room-weakness verdict if any room is reliably graded, else a coverage nudge),
// then a QB depth-risk and a shared-gap block when the data supports them. Each
// is Claim → Evidence → Action so a captain reads a decision, not a stat.
function buildTeamDecisions(args: {
  rooms: RoomCell[];
  cards: PlayerReportCard[];
  focus: TeamFocus;
  corroboratingTag: string | null;
  corroboratingTagCount: number;
  rosterSize: number;
  assessedPlayers: number;
}): TeamDecision[] {
  const {
    rooms,
    cards,
    focus,
    corroboratingTag,
    corroboratingTagCount,
    rosterSize,
    assessedPlayers,
  } = args;
  const decisions: TeamDecision[] = [];
  const focusTop = focus.skills[0] ?? null;
  const ctaDrillName = focusTop?.drills[0]?.drillName ?? null;

  /* 1) Lead — weakest graded room → its gap. Grades show from the first
        assessment; a thin lead is flagged provisional in the evidence. If no
        room is graded at all, fall back to an honest coverage nudge. */
  const { room: weakestRoom, provisional } = pickWeakestRoom(rooms);
  if (weakestRoom) {
    const tagPart = corroboratingTag
      ? ` · most-tagged "${corroboratingTag}" (${corroboratingTagCount}×)`
      : "";
    const conf = provisional
      ? ` · provisional (${weakestRoom.assessed} assessed — keep benchmarking)`
      : "";
    // Bridge to the dashboard: how many of the team's top focus skills live in
    // this room (by skill group -> room). Both surfaces now share one base
    // (migration 101), so this count is the explicit, honest tie between them.
    const focusInRoom = focus.skills.filter(
      (s) => roomIdForSkillGroup(s.skillGroup as SkillGroup) === weakestRoom.id
    );
    const focusBridge =
      focusInRoom.length > 0
        ? ` · ${focusInRoom.length} of your ${focus.skills.length} dashboard focus ${
            focusInRoom.length === 1 ? "skill sits" : "skills sit"
          } here`
        : "";
    decisions.push({
      id: "room_weakness",
      kind: "room_weakness",
      tone: "attention",
      claim: `${weakestRoom.label} is your weakest room${
        weakestRoom.weakestSkillLabel ? ` — ${weakestRoom.weakestSkillLabel} is the gap` : ""
      }.`,
      evidence: `Avg ${weakestRoom.grade ?? "—"} across ${weakestRoom.assessed} assessed${focusBridge}${tagPart}${conf}.`,
      actionLabel: weakestRoom.weakestSkillLabel
        ? `Plan ${weakestRoom.weakestSkillLabel}`
        : ctaDrillName
          ? `Plan ${ctaDrillName}`
          : "Plan a practice",
      // Target the room's own weakest area; fall back to the team's top focus.
      focusSkillId: weakestRoom.ctaFocusSkillId ?? focusTop?.skillId ?? null,
    });
  } else if (assessedPlayers > 0) {
    // Players assessed but none map to a position room (no positions on record).
    decisions.push({
      id: "coverage",
      kind: "coverage",
      tone: "neutral",
      claim: `You've benchmarked ${assessedPlayers}/${rosterSize} players — here's where they stand.`,
      evidence:
        "Per-drill standings below rank everyone you've measured. Add positions to your roster so results roll up into room reads.",
      actionLabel: "Plan a practice",
      focusSkillId: focusTop?.skillId ?? null,
    });
  }

  /* 2) Depth risk — a thinly-covered QB room is a deployment risk, not a
        coverage gap. One reliable QB and no backup read is a decision. */
  const qbRoom = rooms.find((r) => r.id === "qb");
  if (qbRoom && qbRoom.players > 0 && qbRoom.assessed <= 1) {
    const onlyOne = qbRoom.players === 1;
    decisions.push({
      id: "depth_risk",
      kind: "depth_risk",
      tone: "attention",
      claim: onlyOne
        ? "You roster one QB — no backup read."
        : `Only ${qbRoom.assessed} of your ${qbRoom.players} QBs is benchmarked.`,
      evidence: onlyOne
        ? "If they're out, you have no benchmarked QB to deploy. Develop or recruit a second."
        : "Benchmark your other QB(s) so you have a deployment plan if your starter is out.",
      actionLabel: "Plan QB reps",
      focusSkillId: null,
    });
  }

  /* 3) Shared gap — N assessed players share the same weakest group, so one
        practice block lifts many at once. */
  const gapCount = new Map<string, number>();
  for (const c of cards) {
    if (c.overallScore == null || !c.weakestGroupLabel) continue;
    gapCount.set(c.weakestGroupLabel, (gapCount.get(c.weakestGroupLabel) ?? 0) + 1);
  }
  let sharedLabel: string | null = null;
  let sharedN = 0;
  for (const [label, n] of gapCount) {
    if (n > sharedN) {
      sharedN = n;
      sharedLabel = label;
    }
  }
  if (sharedLabel && sharedN >= 3) {
    decisions.push({
      id: "shared_gap",
      kind: "shared_gap",
      tone: "neutral",
      claim: `${sharedN} players share a weak point: ${sharedLabel}.`,
      evidence: `It's the lowest skill area for ${sharedN} of your assessed players — one block lifts the whole group.`,
      actionLabel: `Plan a block on ${sharedLabel}`,
      focusSkillId: null,
    });
  }

  return decisions.slice(0, 3);
}

/* ─────────────────── loader ─────────────────── */

export async function loadTeamScoutingData(
  supabase: SupabaseClient,
  teamId: string
): Promise<TeamScoutingData> {
  const [focus, playersRes, profileRes, benchRes, notesRes, skillGroupMaps] =
    await Promise.all([
    loadTeamFocus(supabase, teamId),
    supabase
      .from("team_players")
      .select("id, player_name, positions, color_index, status")
      .eq("team_id", teamId)
      .eq("status", "active"),
    supabase
      .from("v_player_skill_profile")
      .select(
        "player_id, skill_id, skill_name, skill_group, composite_score, drill_sample_size"
      )
      .eq("team_id", teamId),
    supabase
      .from("benchmark_results")
      .select(
        "id, player_id, drill_id, assessment_date, time_seconds, rating, made_count, attempts_count, benchmark_type, tags, team_drills(id, drill_name, benchmark_type, benchmark_types)"
      )
      .eq("team_id", teamId)
      .order("assessment_date", { ascending: true }),
    supabase
      .from("player_notes")
      .select(
        "id, player_id, note_text, created_at, practice_plan_id, practice_plans(id, title, practice_date)"
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
    // Skill-group progression maps (Build 8) — one fetch feeds every player's trend.
    loadSkillGroupMaps(supabase, teamId),
  ]);

  const players = (playersRes.data ?? []) as PlayerRow[];
  const profiles = (profileRes.data ?? []) as ProfileRow[];
  const benches = (benchRes.data ?? []) as unknown as BenchRow[];
  const notes = (notesRes.data ?? []) as unknown as (ObservationRowData & {
    player_id: string;
  })[];

  const playerById = new Map(players.map((p) => [p.id, p]));

  // Skill-group progression maps (Build 8) — shared loader, one source of truth.
  const { drillSkills: drillSkillsMap, skillGroupById } = skillGroupMaps;
  const trendNow = new Date();

  // player → group → composite (group-level score for §1/§3 grading).
  const profileByPlayer = new Map<string, Map<SkillGroup, number | null>>();
  // player → per-skill rows (the granular profile shown in the side sheet).
  const skillsByPlayer = new Map<string, PlayerSkill[]>();
  for (const r of profiles) {
    let g = profileByPlayer.get(r.player_id);
    if (!g) {
      g = new Map();
      profileByPlayer.set(r.player_id, g);
    }
    g.set(r.skill_group, r.composite_score);

    if (r.composite_score != null) {
      const arr = skillsByPlayer.get(r.player_id) ?? [];
      arr.push({
        skillId: r.skill_id,
        skillName: r.skill_name,
        skillGroup: r.skill_group,
        composite: Number(r.composite_score),
        sampleSize: r.drill_sample_size ?? 0,
      });
      skillsByPlayer.set(r.player_id, arr);
    }
  }

  // player → their benchmark rows (chronological; benches is date-asc already).
  const benchesByPlayer = new Map<string, BenchRow[]>();
  for (const b of benches) {
    const arr = benchesByPlayer.get(b.player_id) ?? [];
    arr.push(b);
    benchesByPlayer.set(b.player_id, arr);
  }
  // player → their observation rows (created_at desc already).
  const notesByPlayer = new Map<string, (ObservationRowData & { player_id: string })[]>();
  for (const n of notes) {
    const arr = notesByPlayer.get(n.player_id) ?? [];
    arr.push(n);
    notesByPlayer.set(n.player_id, arr);
  }
  const noteCountByPlayer = new Map<string, number>();
  for (const n of notes) {
    noteCountByPlayer.set(n.player_id, (noteCountByPlayer.get(n.player_id) ?? 0) + 1);
  }

  // Build the side-sheet evidence bundle for one player from their rows.
  function evidenceFor(playerId: string, positions: string[]) {
    const rows = benchesByPlayer.get(playerId) ?? [];
    const { drills, locked, benchmarkCount } = buildPlayerHistory(rows);
    const skillGroupTrend = buildSkillGroupTrend({
      rows,
      drillSkills: drillSkillsMap,
      skillGroupById,
      positions,
      now: trendNow,
    });

    // recentTags: most-frequent benchmark tags this player picked up.
    const tagCount = new Map<string, number>();
    for (const b of rows) {
      for (const t of b.tags ?? []) {
        if (t) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      }
    }
    const recentTags = [...tagCount.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // editableResults: latest rows first, for the sheet's correct affordance.
    const editableResults: EditableResult[] = [...rows]
      .sort((a, b) => (a.assessment_date < b.assessment_date ? 1 : -1))
      .slice(0, 8)
      .map((b) => {
        const join = Array.isArray(b.team_drills) ? b.team_drills[0] : b.team_drills;
        const type = b.benchmark_type ?? join?.benchmark_type ?? null;
        const value = valueFromBenchmark(
          b,
          (type ?? "rated") as PulseBenchmarkType
        );
        return {
          id: b.id,
          drillName: join?.drill_name ?? "Drill",
          benchmarkType: type,
          date: b.assessment_date,
          timeSeconds: b.time_seconds,
          rating: b.rating,
          madeCount: b.made_count,
          attemptsCount: b.attempts_count,
          label: value != null ? formatValue(value, type) : "—",
          unit: unitFor(type),
        };
      });

    return {
      historyDrills: drills,
      historyLocked: locked,
      skillGroupTrend,
      skillProfile: skillsByPlayer.get(playerId) ?? [],
      observations: notesByPlayer.get(playerId) ?? [],
      recentTags,
      editableResults,
      benchmarkCount,
    };
  }

  /* ── §3 player report cards — graded ONLY on position-relevant groups ── */
  const playerCards: PlayerReportCard[] = players.map((p) => {
    const positions = p.positions ?? [];
    const groups = profileByPlayer.get(p.id);
    // Shared grader — one source of truth with the player-card hero.
    const { groupScores, overallScore, overallGrade } = gradePlayerGroups(
      groups ?? new Map(),
      positions,
    );
    const measured = groupScores.filter((g) => g.score != null) as Required<GroupScore>[];
    const weakest = measured.length
      ? measured.reduce((lo, g) => ((g.score as number) < (lo.score as number) ? g : lo))
      : null;
    const room = roomForPrimaryPosition(positions);
    const evidence = evidenceFor(p.id, positions);
    const verdict = buildVerdict({
      firstName: p.player_name.trim().split(/\s+/)[0] || p.player_name,
      overallGrade,
      skillProfile: evidence.skillProfile,
      recentTags: evidence.recentTags,
      historyDrills: evidence.historyDrills,
      benchmarkCount: evidence.benchmarkCount,
    });
    return {
      playerId: p.id,
      name: p.player_name,
      color: playerColorForIndex(p.color_index ?? 0),
      initials: initialsFor(p.player_name),
      positions,
      primaryPosition: positions[0] ?? null,
      roomLabel: room?.label ?? null,
      overallScore,
      overallGrade,
      groupScores,
      weakestGroupLabel: weakest?.label ?? null,
      verdict,
      relativeStanding: null, // filled by the cohort post-pass below
      benchmarkCount: evidence.benchmarkCount,
      historyDrills: evidence.historyDrills,
      historyLocked: evidence.historyLocked,
      skillGroupTrend: evidence.skillGroupTrend,
      skillProfile: evidence.skillProfile,
      observations: evidence.observations,
      recentTags: evidence.recentTags,
      editableResults: evidence.editableResults,
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

  /* ── §3 role-relative standing — rank each player within their room cohort ──
     Mutates the same card objects held in cardsByRoom/playerCards. Only rooms
     with ≥ STANDING_MIN assessed members get ranked; thinner rooms keep a null
     standing so the UI shows the absolute grade alone. */
  const standingCohort = playerCards.map((c) => ({
    playerId: c.playerId,
    positions: c.positions,
    overallScore: c.overallScore,
  }));
  for (const card of playerCards) {
    card.relativeStanding = relativeStandingFor(
      { playerId: card.playerId, positions: card.positions },
      standingCohort,
    );
  }

  const rooms: RoomCell[] = POSITION_ROOMS.map((room) => {
    const members = cardsByRoom.get(room.id) ?? [];
    const assessedMembers = members.filter((m) => m.overallScore != null);
    const score = avg(assessedMembers.map((m) => m.overallScore as number));
    // Weakest dimension — only the room's OWN skill groups (athletic + iq +
    // signature). Scoping here is what stops a two-way player's off-position
    // score from mislabeling the room (e.g. Defense room reading "weakest:
    // offense"). Aggregate by group id, then pick the lowest room-avg.
    const roomGroups = new Set<SkillGroup>(["athletic", "iq", room.signature]);
    const perGroup = new Map<SkillGroup, number[]>();
    for (const m of assessedMembers) {
      for (const g of m.groupScores) {
        if (g.score == null || !roomGroups.has(g.group)) continue;
        const arr = perGroup.get(g.group) ?? [];
        arr.push(g.score);
        perGroup.set(g.group, arr);
      }
    }
    let weakestGroup: SkillGroup | null = null;
    let weakestAvg = Infinity;
    for (const [grp, vals] of perGroup) {
      const a = avg(vals);
      if (a != null && a < weakestAvg) {
        weakestAvg = a;
        weakestGroup = grp;
      }
    }
    // CTA target: a team focus skill in the weakest group, if one exists
    // (reuses loadTeamFocus' skill ranking); else the planner opens generic.
    const ctaFocusSkillId = weakestGroup
      ? (focus.skills.find((s) => s.skillGroup === weakestGroup)?.skillId ?? null)
      : null;
    const assessedCount = assessedMembers.length;
    return {
      id: room.id,
      label: room.label,
      players: members.length,
      assessed: assessedCount,
      score,
      grade: scoreToGrade(score),
      color: scoreToHeatColor(score),
      weakestSkillLabel: weakestGroup ? skillAreaLabel(weakestGroup) : null,
      weakestGroup,
      ctaFocusSkillId,
      locked: assessedCount === 0,
      gradeReliable: assessedCount >= ROOM_RELIABLE_MIN,
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

  /* ── §2b per-drill leaderboards — latest value per player, ranked ── */
  const benchByDrill = new Map<string, BenchRow[]>();
  for (const b of benches) {
    const arr = benchByDrill.get(b.drill_id) ?? [];
    arr.push(b);
    benchByDrill.set(b.drill_id, arr);
  }
  const drillLeaderboards: DrillLeaderboard[] = [];
  for (const [drillId, rows] of benchByDrill) {
    // benches are date-asc, so the last write per player is their latest.
    const latestByPlayer = new Map<string, BenchRow>();
    for (const b of rows) latestByPlayer.set(b.player_id, b);

    const ref = rows[rows.length - 1];
    const refJoin = Array.isArray(ref.team_drills) ? ref.team_drills[0] : ref.team_drills;
    const type = ref.benchmark_type ?? refJoin?.benchmark_type ?? null;
    const pType = (type ?? "rated") as PulseBenchmarkType;

    const leaderRows: DrillLeaderRow[] = [];
    for (const [pid, b] of latestByPlayer) {
      const p = playerById.get(pid);
      if (!p) continue;
      const value = valueFromBenchmark(b, pType);
      if (value == null) continue;
      leaderRows.push({
        playerId: pid,
        name: p.player_name,
        color: playerColorForIndex(p.color_index ?? 0),
        initials: initialsFor(p.player_name),
        primaryPosition: (p.positions ?? [])[0] ?? null,
        value,
        label: formatValue(value, type),
        unit: unitFor(type),
        date: b.assessment_date,
      });
    }
    if (leaderRows.length < 2) continue; // a leaderboard of one isn't a comparison

    const better: "higher" | "lower" = type && isInverse(pType) ? "lower" : "higher";
    leaderRows.sort((a, b) => (better === "lower" ? a.value - b.value : b.value - a.value));
    drillLeaderboards.push({
      drillId,
      drillName: refJoin?.drill_name ?? "Drill",
      benchmarkType: type,
      better,
      playersAssessed: leaderRows.length,
      rows: leaderRows,
    });
  }
  // Best-covered drills first (most players ranked = most useful comparison).
  drillLeaderboards.sort((a, b) => b.playersAssessed - a.playersAssessed);

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

  // Weakest room — prefers a reliably-graded room, falls back to the weakest of
  // any graded room (grades show from the first assessment). Shared with §0.
  const { room: weakestRoom } = pickWeakestRoom(rooms);
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

  /* ── §0 team decisions — the 1–3 Claim→Evidence→Action reads (volume-aware) ── */
  const decisions = buildTeamDecisions({
    rooms,
    cards: playerCards,
    focus,
    corroboratingTag,
    corroboratingTagCount,
    rosterSize: players.length,
    assessedPlayers,
  });

  return {
    headline,
    decisions,
    rooms,
    movers,
    drillLeaderboards,
    playerCards,
    focus,
    rosterSize: players.length,
    assessedPlayers,
    anyData,
  };
}
