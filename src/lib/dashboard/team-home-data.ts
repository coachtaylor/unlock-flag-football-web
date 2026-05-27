// Team dashboard (Build 7) — single data loader.
//
// Each widget is computed off the rows fetched in one Promise.all. The
// existing strength/weakness + recent-assessments + recent-practices
// loaders from Build 3 still live in page.tsx; this module owns the new
// widget data (pinned pulses, drill mix, attendance, cadence, movers,
// needs-attention, recent activity, most-run drills, next practice).
//
// Captain View Toggle: when `playerScope` is set to a player id the
// caller (the page) filters Pinned Pulses + Attendance to that player.
// Other widgets stay team-wide on purpose — see WEB_BUILD_PLAN.md §Build
// 7 risks ("scope leak. Only Pinned pulses + Attendance respond to the
// toggle for MVP").
//
// All aggregates are hand-rolled in JS rather than added as SQL views.
// At MVP roster size (15) the volumes are tiny, and we already have to
// stitch together several sources per widget.

import type { SupabaseClient } from "@supabase/supabase-js";

/* ─────────────────── types ─────────────────── */

export type PulseBenchmarkType = "timed" | "rated" | "reps" | "pct" | "flags" | "drops";

export type PinnedPulse = {
  kind: "single";
  pinId: string;
  drillId: string;
  drillName: string;
  benchmarkType: PulseBenchmarkType;
  // null = team-wide; otherwise a position code from src/lib/positions.ts
  position: string | null;
  current: number | null;
  previous: number | null;
  delta: number | null;
  // Lower-is-better (timed) → positive delta is bad; we flip in the UI
  inverse: boolean;
  unit: string;
  series: number[]; // 8 points (weekly), oldest → newest
  color: string;
  pinnedAt: string | null;
};

export type BreakdownPulseRow = {
  position: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  series: number[]; // 8 weekly points, oldest → newest. Empty positions
                    // still get a zero-filled series for layout stability.
};

export type BreakdownPulse = {
  kind: "breakdown";
  pinId: string;
  drillId: string;
  drillName: string;
  benchmarkType: PulseBenchmarkType;
  unit: string;
  inverse: boolean;
  color: string;
  pinnedAt: string | null;
  rows: BreakdownPulseRow[];
};

export type PulseSlot = PinnedPulse | BreakdownPulse;

export type DrillMixEntry = {
  key: string;
  label: string;
  count: number;
  color: string;
};

export type AttendanceData = {
  rate: number | null; // 0..1
  deltaPct: number | null; // delta vs prior 4 weeks
  series: number[]; // 7 last completed practices, attendance % 0..100
  offensePct: number | null;
  defensePct: number | null;
  streaks: { playerId: string; name: string; color: string; streak: number }[];
};

export type CadenceCell = { week: number; day: number; intensity: 0 | 1 | 2 | 3 };
export type CadenceData = {
  cells: CadenceCell[];
  weeks: number;
  avgPerWeek: number;
  avgDurationMin: number | null;
  streakWeeks: number;
};

export type Mover = {
  playerId: string;
  name: string;
  color: string;
  initials: string;
  improvement: number;
  unit: string;
  drillName: string;
  isPr: boolean;
};

export type AttentionItem = {
  playerId: string;
  name: string;
  color: string;
  initials: string;
  note: string;
  flag: "stale" | "down" | "absent";
};

export type ActivityRow = {
  who: string;
  verb: string;
  what: string;
  when: string;
  category: string;
  isPr: boolean;
};

export type MostRunDrill = {
  drillId: string;
  drillName: string;
  count: number;
  categoryColor: string;
};

export type NextPractice = {
  id: string;
  title: string | null;
  practiceDate: string;
  startTime: string | null;
  status: string;
  durationMin: number;
  blockCount: number;
  attendees: { initials: string; color: string }[];
  rsvpYes: number;
  rsvpUnknown: number;
  blockStripe: { dur: number; color: string }[];
};

export type HeroStats = {
  squadDelta: number | null; // % improvement vs week 1
  drillsLogged: number;
  streakWeeks: number;
  rosterLocked: { benchmarked: number; total: number };
};

export type TeamDashboardData = {
  hero: HeroStats;
  nextPractice: NextPractice | null;
  pulses: PulseSlot[];
  trendSeries: { drillId: string; label: string; color: string; data: { week: string; value: number }[] }[];
  movers: Mover[];
  drillMix: { entries: DrillMixEntry[]; total: number; underweight: string | null };
  attendance: AttendanceData;
  cadence: CadenceData;
  attention: AttentionItem[];
  activity: ActivityRow[];
  mostRunDrills: MostRunDrill[];
  isCurrentUserCaptain: boolean;
  currentUserPlayerId: string | null;
};

/* ─────────────── category palette ─────────────── */

const CATEGORY_PALETTE: Record<string, { color: string; label: string }> = {
  offense: { color: "#FF6A1A", label: "Offense" },
  defense: { color: "#FF4D4D", label: "Defense" },
  footwork: { color: "#C2FF3D", label: "Footwork" },
  routes: { color: "#6EA8FF", label: "Routes" },
  conditioning: { color: "#B89BFF", label: "Conditioning" },
  fundamentals: { color: "#FFB347", label: "Fundamentals" },
  qb: { color: "#7DDFD2", label: "QB" },
  flag: { color: "#FF6A8B", label: "Flag pulling" },
};

function categoryColor(name: string | null | undefined) {
  if (!name) return "#7A7A82";
  const k = name.toLowerCase();
  for (const key of Object.keys(CATEGORY_PALETTE)) {
    if (k.includes(key)) return CATEGORY_PALETTE[key].color;
  }
  return "#7A7A82";
}

function categoryKey(name: string | null | undefined) {
  if (!name) return "other";
  const k = name.toLowerCase();
  for (const key of Object.keys(CATEGORY_PALETTE)) {
    if (k.includes(key)) return key;
  }
  return "other";
}

/* ─────────────── helpers ─────────────── */

import { playerColorForIndex } from "@/components/uff/team-colors";
import { blockColor } from "@/lib/practice/block-colors";
import { isPrimaryOffense, isPrimaryDefense } from "@/lib/positions";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function startOfWeek(d: Date): Date {
  // Monday-anchored
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(date: string | Date) {
  const t = new Date(date).getTime();
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function avg(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pulseUnit(t: PulseBenchmarkType) {
  switch (t) {
    case "timed":
      return "s";
    case "rated":
      return "/5";
    case "pct":
      return "%";
    default:
      return "";
  }
}

function isInverse(t: PulseBenchmarkType) {
  // timed + drops: lower is better
  return t === "timed" || t === "drops";
}

function valueFromBenchmark(
  row: { time_seconds: number | null; rating: number | null; made_count: number | null; attempts_count: number | null },
  t: PulseBenchmarkType
): number | null {
  switch (t) {
    case "timed":
      return row.time_seconds;
    case "rated":
      return row.rating;
    case "reps":
    case "flags":
    case "drops":
      return row.made_count ?? row.rating; // reps lives in made_count for our newer types
    case "pct":
      if (row.made_count == null || !row.attempts_count) return null;
      return (row.made_count / row.attempts_count) * 100;
  }
}

/* ─────────────── main loader ─────────────── */

export async function loadTeamDashboard(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
  opts: { playerScope?: string | null } = {}
): Promise<TeamDashboardData> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const eightWeeksAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7 * 8)
    .toISOString()
    .slice(0, 10);
  const fourWeeksAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 28)
    .toISOString()
    .slice(0, 10);
  const fourteenDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 14)
    .toISOString()
    .slice(0, 10);

  const [
    pinsRes,
    benchmarksRes,
    playersRes,
    practicesUpcomingRes,
    practicesRecentRes,
    practicePlanDrillsRes,
    practiceLogsRes,
    drillCategoriesRes,
    attendeesRes,
    practiceBlocksRes,
    drillCatLinksRes,
    currentPlayerRes,
  ] = await Promise.all([
    // team_dashboard_pins: one row per (drill, benchmark_type, position)
    // slice OR breakdown pin (one row, fans out into N positions on the
    // dashboard card). Backed by migrations 63 + 65.
    supabase
      .from("team_dashboard_pins")
      .select(
        "id, drill_id, benchmark_type, position, breakdown_positions, sort_order, pinned_at, team_drills(id, drill_name, category_id)"
      )
      .eq("team_id", teamId)
      .order("sort_order", { ascending: true })
      .order("pinned_at", { ascending: true })
      .limit(4),

    supabase
      .from("benchmark_results")
      .select(
        "id, drill_id, player_id, assessment_date, time_seconds, rating, made_count, attempts_count, benchmark_type, created_at"
      )
      .eq("team_id", teamId)
      .gte("assessment_date", eightWeeksAgo)
      .order("assessment_date", { ascending: true }),

    supabase
      .from("team_players")
      .select("id, player_name, positions, status, color_index, is_captain, user_id, is_injured")
      .eq("team_id", teamId),

    supabase
      .from("practice_plans")
      .select("id, title, practice_date, start_time, end_time, status")
      .eq("team_id", teamId)
      .gte("practice_date", today)
      .order("practice_date", { ascending: true })
      .limit(1),

    supabase
      .from("practice_plans")
      .select("id, title, practice_date, start_time, end_time, status, created_at")
      .eq("team_id", teamId)
      .gte("practice_date", eightWeeksAgo)
      .order("practice_date", { ascending: false }),

    supabase
      .from("practice_plan_drills")
      .select(
        "id, practice_plan_id, drill_id, drill_order, duration_minutes, is_water_break, plan_block_id"
      )
      .order("drill_order", { ascending: true }),

    supabase
      .from("practice_logs")
      .select("id, practice_plan_id, drills_completed, attendance_count, created_at")
      .eq("team_id", teamId)
      .gte("created_at", eightWeeksAgo),

    supabase
      .from("drill_categories")
      .select("id, category_name, category_type"),

    supabase
      .from("practice_plan_attendees")
      .select("id, practice_plan_id, player_id, rsvp, attended, check_in_late"),

    supabase
      .from("practice_plan_blocks")
      .select("id, practice_plan_id, name, block_order")
      .order("block_order", { ascending: true }),

    supabase
      .from("team_drill_categories")
      .select("drill_id, category_id"),

    supabase
      .from("team_players")
      .select("id, is_captain")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  type Player = {
    id: string;
    player_name: string;
    positions: string[] | null;
    status: string | null;
    color_index: number | null;
    is_captain: boolean | null;
    user_id: string | null;
    is_injured: boolean | null;
  };
  type DrillCatRow = { id: string; category_name: string; category_type: string | null };
  type PracticeRow = {
    id: string;
    title: string | null;
    practice_date: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
    created_at?: string;
  };

  const pinsRaw = pinsRes.data ?? [];
  const benchmarks = benchmarksRes.data ?? [];
  const players = (playersRes.data ?? []) as Player[];
  const upcomingPractice = (practicesUpcomingRes.data ?? [])[0] as PracticeRow | undefined;
  const recentPractices = (practicesRecentRes.data ?? []) as PracticeRow[];
  const planDrills = practicePlanDrillsRes.data ?? [];
  const practiceLogs = practiceLogsRes.data ?? [];
  const drillCats = (drillCategoriesRes.data ?? []) as DrillCatRow[];
  const attendees = attendeesRes.data ?? [];
  const practiceBlocks = practiceBlocksRes.data ?? [];
  const drillCatLinks = drillCatLinksRes.data ?? [];
  const currentPlayer = currentPlayerRes.data as { id: string; is_captain: boolean | null } | null;

  const drillCatById = new Map(drillCats.map((c) => [c.id, c]));
  const drillCatLinkByDrill = new Map<string, string[]>();
  for (const l of drillCatLinks) {
    const arr = drillCatLinkByDrill.get(l.drill_id) ?? [];
    arr.push(l.category_id);
    drillCatLinkByDrill.set(l.drill_id, arr);
  }
  const playerById = new Map(players.map((p) => [p.id, p]));

  const activePlayers = players.filter((p) => p.status === "active");
  const playerScope = opts.playerScope ?? null;

  /* ── Pinned Pulses ── */

  // Normalize the embedded team_drills join (Supabase types it as object | array).
  type PinRow = {
    id: string;
    drill_id: string;
    benchmark_type: string;
    position: string | null;
    breakdown_positions: string[] | null;
    sort_order: number;
    pinned_at: string | null;
    team_drills:
      | { id: string; drill_name: string; category_id: string | null }
      | { id: string; drill_name: string; category_id: string | null }[]
      | null;
  };
  const pins = (pinsRaw as PinRow[]).map((p) => {
    const join = Array.isArray(p.team_drills) ? p.team_drills[0] : p.team_drills;
    return { ...p, drill: join ?? null };
  });

  // Deduped list of pinned drills (one entry per drill_id, even when the
  // drill appears in multiple pin slices). Used by Movers + Needs
  // Attention + Activity widgets that care about "is this drill pinned"
  // at the drill level, not the (drill, type, position) level.
  const pinnedDrillByDrillId = new Map<
    string,
    { id: string; drill_name: string; benchmark_types: string[] }
  >();
  for (const pin of pins) {
    if (!pin.drill) continue;
    const existing = pinnedDrillByDrillId.get(pin.drill.id);
    if (existing) {
      if (!existing.benchmark_types.includes(pin.benchmark_type)) {
        existing.benchmark_types.push(pin.benchmark_type);
      }
    } else {
      pinnedDrillByDrillId.set(pin.drill.id, {
        id: pin.drill.id,
        drill_name: pin.drill.drill_name,
        benchmark_types: [pin.benchmark_type],
      });
    }
  }
  const pinnedDrills = Array.from(pinnedDrillByDrillId.values());

  // Build a player-id set for the pin's position scope:
  //   - position = null → all active players (team-wide)
  //   - position = 'QB' → active players whose positions[] includes 'QB'
  //     (uses `any` semantics, not primary — captains exploring a drill's
  //     QB pulse should see every player who can step in at QB, not only
  //     QB-primary)
  function playerIdsForPosition(position: string | null): Set<string> {
    if (!position) {
      return new Set(activePlayers.map((p) => p.id));
    }
    return new Set(
      activePlayers
        .filter((pl) => (pl.positions ?? []).includes(position))
        .map((pl) => pl.id)
    );
  }

  // Aggregate one slice (drill, type, eligible-player-set) into current /
  // previous / 8-week series. Shared by single-scope pulses AND breakdown
  // sub-rows so the windowing stays consistent.
  function aggregateSlice(
    drillId: string,
    type: PulseBenchmarkType,
    eligible: Set<string>
  ): { current: number | null; previous: number | null; delta: number | null; series: number[] } {
    const rows = benchmarks.filter((b) => {
      if (b.drill_id !== drillId) return false;
      if (b.benchmark_type !== type) return false;
      if (playerScope) {
        return b.player_id === playerScope;
      }
      return eligible.has(b.player_id);
    });

    const weeks: number[][] = Array.from({ length: 8 }, () => []);
    const baseMonday = startOfWeek(now);
    for (const b of rows) {
      const v = valueFromBenchmark(b, type);
      if (v == null) continue;
      const wIdx =
        7 -
        Math.floor(
          (baseMonday.getTime() - startOfWeek(new Date(b.assessment_date)).getTime()) /
            (1000 * 60 * 60 * 24 * 7)
        );
      if (wIdx >= 0 && wIdx < 8) weeks[wIdx].push(v);
    }
    const series = weeks.map((w) => avg(w) ?? 0);
    for (let i = 1; i < series.length; i++) {
      if (!weeks[i].length && weeks[i - 1].length) series[i] = series[i - 1];
    }
    for (let i = series.length - 2; i >= 0; i--) {
      if (!weeks[i].length && weeks[i + 1].length) series[i] = series[i + 1];
    }
    const current = avg(weeks.slice(-2).flat());
    const previous = avg(weeks.slice(-6, -2).flat());
    const delta = current != null && previous != null ? current - previous : null;
    return { current, previous, delta, series };
  }

  function pulseColor(t: PulseBenchmarkType): string {
    if (t === "timed") return "#FF6A1A";
    if (t === "rated") return "#C2FF3D";
    if (t === "pct") return "#6EA8FF";
    return "#B89BFF";
  }

  const pulses: PulseSlot[] = pins.map((pin): PulseSlot => {
    const benchType = pin.benchmark_type as PulseBenchmarkType;
    const drillName = pin.drill?.drill_name ?? "Drill";
    const color = pulseColor(benchType);
    const inverse = isInverse(benchType);
    const unit = pulseUnit(benchType);

    // Branch: breakdown vs single-scope.
    if (pin.breakdown_positions && pin.breakdown_positions.length > 0) {
      const rows: BreakdownPulseRow[] = pin.breakdown_positions.map((pos) => {
        const eligible = playerIdsForPosition(pos);
        const agg = aggregateSlice(pin.drill_id, benchType, eligible);
        return {
          position: pos,
          current: agg.current,
          previous: agg.previous,
          delta: agg.delta,
          series: agg.series,
        };
      });
      return {
        kind: "breakdown",
        pinId: pin.id,
        drillId: pin.drill_id,
        drillName,
        benchmarkType: benchType,
        unit,
        inverse,
        color,
        pinnedAt: pin.pinned_at,
        rows,
      };
    }

    const eligible = playerIdsForPosition(pin.position);
    const agg = aggregateSlice(pin.drill_id, benchType, eligible);
    return {
      kind: "single",
      pinId: pin.id,
      drillId: pin.drill_id,
      drillName,
      benchmarkType: benchType,
      position: pin.position,
      current: agg.current,
      previous: agg.previous,
      delta: agg.delta,
      inverse,
      unit,
      series: agg.series,
      color,
      pinnedAt: pin.pinned_at,
    };
  });

  /* ── Benchmark Trends (top 2 pinned drills, 5-week weekly averages) ── */

  // BenchmarkTrendsCard only renders single-scope pulses (a breakdown
  // doesn't have a single time series; it's an N-row snapshot). Skip
  // breakdown pulses here — they're still shown on the strip.
  const trendSeries = pulses
    .filter((p): p is PinnedPulse => p.kind === "single")
    .slice(0, 2)
    .map((p) => {
      const weekLabels = ["W1", "W2", "W3", "W4", "W5"];
      return {
        drillId: p.drillId,
        label: p.drillName,
        color: p.color,
        data: p.series.slice(-5).map((v, i) => ({ week: weekLabels[i] ?? `W${i + 1}`, value: v })),
      };
    });

  /* ── Movers (players with biggest improvement on any drill) ── */

  const moversAgg = new Map<
    string,
    { improvement: number; drill: string; isPr: boolean; unit: string }
  >();
  const benchByPlayerDrill = new Map<string, typeof benchmarks>();
  for (const b of benchmarks) {
    const k = `${b.player_id}::${b.drill_id}`;
    const arr = benchByPlayerDrill.get(k) ?? [];
    arr.push(b);
    benchByPlayerDrill.set(k, arr);
  }
  for (const [k, arr] of benchByPlayerDrill.entries()) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort((a, b) =>
      a.assessment_date < b.assessment_date ? -1 : 1
    );
    const drillId = k.split("::")[1];
    const drill = pinnedDrills.find((d) => d.id === drillId);
    const benchType =
      ((drill?.benchmark_types as string[] | null)?.[0] as PinnedPulse["benchmarkType"] | undefined) ??
      (sorted[0].benchmark_type as PinnedPulse["benchmarkType"] | undefined) ??
      "rated";
    const first = valueFromBenchmark(sorted[0], benchType);
    const last = valueFromBenchmark(sorted[sorted.length - 1], benchType);
    if (first == null || last == null) continue;
    const raw = last - first;
    const improvement = isInverse(benchType) ? -raw : raw;
    if (improvement <= 0) continue;
    const playerId = sorted[0].player_id;
    const existing = moversAgg.get(playerId);
    if (!existing || improvement > existing.improvement) {
      moversAgg.set(playerId, {
        improvement,
        drill: drill?.drill_name ?? "drill",
        isPr: last === Math.min(...sorted.map((s) => valueFromBenchmark(s, benchType) ?? Infinity)) && isInverse(benchType),
        unit: pulseUnit(benchType),
      });
    }
  }
  const movers: Mover[] = Array.from(moversAgg.entries())
    .map(([playerId, m]) => {
      const p = playerById.get(playerId);
      if (!p) return null;
      return {
        playerId,
        name: p.player_name,
        color: playerColorForIndex(p.color_index),
        initials: initialsOf(p.player_name),
        improvement: m.improvement,
        unit: m.unit,
        drillName: m.drill,
        isPr: m.isPr,
      };
    })
    .filter((x): x is Mover => x !== null)
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, 5);

  /* ── Drill mix (last 4 weeks of completed practices) ── */

  const completedRecent = recentPractices.filter(
    (p) => p.status === "completed" && p.practice_date >= fourWeeksAgo
  );
  const completedRecentIds = new Set(completedRecent.map((p) => p.id));
  const drillIdsRun: string[] = [];
  // Prefer practice_logs.drills_completed[] when present, else fall back
  // to plan drills for that practice.
  const planDrillsByPractice = new Map<string, string[]>();
  for (const pd of planDrills) {
    if (pd.is_water_break) continue;
    if (!pd.drill_id) continue;
    if (!completedRecentIds.has(pd.practice_plan_id)) continue;
    const arr = planDrillsByPractice.get(pd.practice_plan_id) ?? [];
    arr.push(pd.drill_id);
    planDrillsByPractice.set(pd.practice_plan_id, arr);
  }
  for (const p of completedRecent) {
    const log = practiceLogs.find((l) => l.practice_plan_id === p.id);
    const completed = (log?.drills_completed as string[] | null) ?? null;
    if (completed && completed.length) {
      drillIdsRun.push(...completed);
    } else {
      drillIdsRun.push(...(planDrillsByPractice.get(p.id) ?? []));
    }
  }
  const mixCounts = new Map<string, number>();
  for (const drillId of drillIdsRun) {
    const cats = drillCatLinkByDrill.get(drillId) ?? [];
    if (!cats.length) {
      mixCounts.set("other", (mixCounts.get("other") ?? 0) + 1);
      continue;
    }
    for (const cId of cats) {
      const c = drillCatById.get(cId);
      const k = categoryKey(c?.category_name);
      mixCounts.set(k, (mixCounts.get(k) ?? 0) + 1);
    }
  }
  const mixEntries: DrillMixEntry[] = Array.from(mixCounts.entries())
    .map(([key, count]) => ({
      key,
      label: CATEGORY_PALETTE[key]?.label ?? key.charAt(0).toUpperCase() + key.slice(1),
      count,
      color: CATEGORY_PALETTE[key]?.color ?? "#7A7A82",
    }))
    .sort((a, b) => b.count - a.count);
  const mixTotal = mixEntries.reduce((s, e) => s + e.count, 0);
  // Underweight: any of {defense, offense, footwork, routes} below 15% of total
  const underweight =
    mixTotal >= 5
      ? ["defense", "offense", "footwork", "routes"].find((k) => {
          const e = mixEntries.find((x) => x.key === k);
          const share = (e?.count ?? 0) / mixTotal;
          return share < 0.15;
        }) ?? null
      : null;

  /* ── Attendance ── */

  const completedAll = recentPractices.filter((p) => p.status === "completed");
  const completed8w = completedAll.slice(0, 7).reverse(); // chronological
  const attBySession = completed8w.map((p) => {
    const rows = attendees.filter((a) => a.practice_plan_id === p.id);
    const total = rows.length || activePlayers.length;
    const present = rows.filter((a) => a.attended === true).length;
    return total ? (present / total) * 100 : 0;
  });
  const recentRate = attBySession.length
    ? attBySession.reduce((a, b) => a + b, 0) / attBySession.length
    : null;
  const priorWindow = completedAll.slice(7, 14);
  const priorRate = priorWindow.length
    ? priorWindow.reduce((s, p) => {
        const rows = attendees.filter((a) => a.practice_plan_id === p.id);
        const total = rows.length || activePlayers.length;
        const present = rows.filter((a) => a.attended === true).length;
        return s + (total ? (present / total) * 100 : 0);
      }, 0) / priorWindow.length
    : null;
  const deltaPct = recentRate != null && priorRate != null ? recentRate - priorRate : null;

  // Offense / defense split uses PRIMARY position (positions[0]) — see the
  // convention in src/lib/positions.ts. A two-way player counts toward the
  // side their primary is on, not both. Substring matching was previously
  // used here and mis-classified single-letter codes like 'S' and 'C'; the
  // exact-token check via positions.ts fixes that.
  const offensePlayerIds = new Set(
    activePlayers.filter((p) => isPrimaryOffense(p.positions)).map((p) => p.id)
  );
  const defensePlayerIds = new Set(
    activePlayers.filter((p) => isPrimaryDefense(p.positions)).map((p) => p.id)
  );
  function sideRate(idSet: Set<string>) {
    if (!completed8w.length || !idSet.size) return null;
    const opps = completed8w.length * idSet.size;
    const present = attendees.filter(
      (a) =>
        completed8w.some((p) => p.id === a.practice_plan_id) &&
        idSet.has(a.player_id) &&
        a.attended === true
    ).length;
    return opps ? (present / opps) * 100 : null;
  }
  const offensePct = sideRate(offensePlayerIds);
  const defensePct = sideRate(defensePlayerIds);

  // Streaks: consecutive attended of completed practices, walking from the most-recent backwards.
  const streaks = activePlayers
    .map((p) => {
      let s = 0;
      for (const pr of completedAll) {
        const a = attendees.find(
          (a) => a.practice_plan_id === pr.id && a.player_id === p.id
        );
        if (a?.attended === true) s++;
        else break;
      }
      return {
        playerId: p.id,
        name: p.player_name,
        color: playerColorForIndex(p.color_index),
        streak: s,
      };
    })
    .filter((x) => x.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 3);

  const attendance: AttendanceData = {
    rate: recentRate != null ? recentRate / 100 : null,
    deltaPct,
    series: attBySession,
    offensePct,
    defensePct,
    streaks,
  };

  /* ── Cadence heatmap ── */

  const weeks = 8;
  const baseMonday = startOfWeek(now);
  const cells: CadenceCell[] = [];
  const perWeekCount = new Array<number>(weeks).fill(0);
  for (const p of recentPractices) {
    if (p.status === "draft") continue;
    const d = new Date(p.practice_date);
    const w = Math.floor(
      (baseMonday.getTime() - startOfWeek(d).getTime()) / (1000 * 60 * 60 * 24 * 7)
    );
    if (w < 0 || w >= weeks) continue;
    const day = (d.getDay() + 6) % 7; // Mon=0
    const existing = cells.find((c) => c.week === w && c.day === day);
    if (existing) {
      existing.intensity = (Math.min(3, existing.intensity + 1) as 0 | 1 | 2 | 3);
    } else {
      const intensity = p.status === "completed" ? 2 : 1;
      cells.push({ week: w, day, intensity: intensity as 0 | 1 | 2 | 3 });
    }
    perWeekCount[w]++;
  }
  const avgPerWeek = perWeekCount.reduce((a, b) => a + b, 0) / weeks;
  // Streak: consecutive weeks (from this week back) with at least 1 practice.
  let streakWeeks = 0;
  for (let i = 0; i < weeks; i++) {
    if (perWeekCount[i] >= 1) streakWeeks++;
    else break;
  }
  // Avg duration: derive from completed practices' plan_drills total minutes.
  const completedIds = recentPractices.filter((p) => p.status === "completed").map((p) => p.id);
  const durs = completedIds.map((id) =>
    planDrills
      .filter((d) => d.practice_plan_id === id && !d.is_water_break)
      .reduce((s, d) => s + (d.duration_minutes ?? 0), 0)
  );
  const avgDurationMin = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null;

  const cadence: CadenceData = {
    cells,
    weeks,
    avgPerWeek: Math.round(avgPerWeek * 10) / 10,
    avgDurationMin,
    streakWeeks,
  };

  /* ── Needs attention ── */

  const lastBenchByPlayer = new Map<string, string>();
  for (const b of benchmarks) {
    const cur = lastBenchByPlayer.get(b.player_id);
    if (!cur || cur < b.assessment_date) lastBenchByPlayer.set(b.player_id, b.assessment_date);
  }
  const attention: AttentionItem[] = [];
  // 1) stale
  for (const p of activePlayers) {
    const last = lastBenchByPlayer.get(p.id);
    if (!last || last < fourteenDaysAgo) {
      attention.push({
        playerId: p.id,
        name: p.player_name,
        color: playerColorForIndex(p.color_index),
        initials: initialsOf(p.player_name),
        note: last ? `No benchmark in ${daysAgo(last)}d` : "No benchmark yet",
        flag: "stale",
      });
    }
    if (attention.length >= 1) break;
  }
  // 2) missed last 2 practices
  for (const p of activePlayers) {
    if (attention.some((x) => x.playerId === p.id)) continue;
    const last2 = completedAll.slice(0, 2);
    if (last2.length < 2) continue;
    const missed = last2.every((pr) => {
      const a = attendees.find((a) => a.practice_plan_id === pr.id && a.player_id === p.id);
      return a?.attended === false || !a;
    });
    if (missed) {
      attention.push({
        playerId: p.id,
        name: p.player_name,
        color: playerColorForIndex(p.color_index),
        initials: initialsOf(p.player_name),
        note: "Missed last 2 practices",
        flag: "absent",
      });
      if (attention.length >= 2) break;
    }
  }
  // 3) falling rating
  outer: for (const p of activePlayers) {
    if (attention.some((x) => x.playerId === p.id)) continue;
    for (const drill of pinnedDrills) {
      const arr = benchmarks
        .filter((b) => b.player_id === p.id && b.drill_id === drill.id && b.rating != null)
        .sort((a, b) => (a.assessment_date < b.assessment_date ? -1 : 1));
      if (arr.length < 2) continue;
      if ((arr[arr.length - 1].rating ?? 0) < (arr[0].rating ?? 0)) {
        attention.push({
          playerId: p.id,
          name: p.player_name,
          color: playerColorForIndex(p.color_index),
          initials: initialsOf(p.player_name),
          note: `Behind on ${drill.drill_name.toLowerCase()}`,
          flag: "down",
        });
        if (attention.length >= 3) break outer;
        break;
      }
    }
  }

  /* ── Recent activity (benchmarks + practices + drill changes, 7d) ── */

  const sevenDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7).toISOString();
  const activity: ActivityRow[] = [];
  // recent benchmarks
  for (const b of [...benchmarks].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))) {
    if (b.created_at < sevenDaysAgo) continue;
    const p = playerById.get(b.player_id);
    const drill = pinnedDrills.find((d) => d.id === b.drill_id);
    const benchType =
      (b.benchmark_type as PinnedPulse["benchmarkType"] | null) ?? "rated";
    const v = valueFromBenchmark(b, benchType);
    activity.push({
      who: p?.player_name ?? "Coach",
      verb: "logged",
      what: `${drill?.drill_name ?? "benchmark"} · ${v != null ? v.toFixed(benchType === "timed" ? 2 : 1) + pulseUnit(benchType) : "—"}`,
      when: relativeTime(b.created_at),
      category: categoryKey(drillCats.find((c) => drillCatLinkByDrill.get(b.drill_id)?.includes(c.id))?.category_name),
      isPr: false,
    });
    if (activity.length >= 4) break;
  }
  // recent practices
  for (const p of recentPractices) {
    if (!p.created_at) continue;
    if (p.created_at < sevenDaysAgo) continue;
    if (activity.length >= 6) break;
    activity.push({
      who: "Coach",
      verb: p.status === "completed" ? "logged" : "planned",
      what: `${p.title ?? "Practice"}${p.status === "completed" ? " · completed" : ""}`,
      when: relativeTime(p.created_at),
      category: "offense",
      isPr: false,
    });
  }

  /* ── Most-run drills ── */

  const drillRunCount = new Map<string, number>();
  for (const drillId of drillIdsRun) {
    drillRunCount.set(drillId, (drillRunCount.get(drillId) ?? 0) + 1);
  }
  // Drill names — fetch in-batch by reusing pinned set + a lightweight lookup
  // through team_drills (we don't have it pre-fetched in full so do a small extra query).
  const topDrillIds = Array.from(drillRunCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id);
  let mostRunDrills: MostRunDrill[] = [];
  if (topDrillIds.length) {
    const { data: namesData } = await supabase
      .from("team_drills")
      .select("id, drill_name, category_id")
      .in("id", topDrillIds);
    const nameById = new Map((namesData ?? []).map((d) => [d.id, d]));
    mostRunDrills = topDrillIds.map((id) => {
      const row = nameById.get(id);
      const catName = row?.category_id ? drillCatById.get(row.category_id)?.category_name : null;
      return {
        drillId: id,
        drillName: row?.drill_name ?? "Drill",
        count: drillRunCount.get(id) ?? 0,
        categoryColor: categoryColor(catName),
      };
    });
  }

  /* ── Next practice card ── */

  let nextPractice: NextPractice | null = null;
  if (upcomingPractice) {
    const blocks = practiceBlocks.filter((b) => b.practice_plan_id === upcomingPractice.id);
    const blockMap = new Map(blocks.map((b) => [b.id, b]));
    const drillsForUpcoming = planDrills.filter(
      (d) => d.practice_plan_id === upcomingPractice.id
    );
    const stripe = drillsForUpcoming.map((d) => ({
      dur: d.duration_minutes ?? 5,
      color: d.is_water_break
        ? "#6EA8FF"
        : blockColor(blockMap.get(d.plan_block_id ?? "")?.name).accent,
    }));
    const att = attendees.filter((a) => a.practice_plan_id === upcomingPractice.id);
    const yes = att.filter((a) => a.rsvp === true).length;
    const unknown = att.filter((a) => a.rsvp == null).length || Math.max(0, activePlayers.length - att.length);
    const attendeeAvatars = att
      .filter((a) => a.rsvp === true)
      .map((a) => playerById.get(a.player_id))
      .filter((p): p is Player => !!p)
      .slice(0, 9)
      .map((p) => ({ initials: initialsOf(p.player_name), color: playerColorForIndex(p.color_index) }));
    const durationMin = drillsForUpcoming.reduce(
      (s, d) => s + (d.duration_minutes ?? 0),
      0
    );
    nextPractice = {
      id: upcomingPractice.id,
      title: upcomingPractice.title,
      practiceDate: upcomingPractice.practice_date,
      startTime: upcomingPractice.start_time,
      status: upcomingPractice.status,
      durationMin,
      blockCount: blocks.length,
      attendees: attendeeAvatars,
      rsvpYes: yes,
      rsvpUnknown: unknown,
      blockStripe: stripe.length ? stripe : [{ dur: 60, color: "#FFB347" }],
    };
  }

  /* ── Hero ── */

  const benchmarkedPlayerIds = new Set(benchmarks.map((b) => b.player_id));
  const rosterLocked = {
    benchmarked: activePlayers.filter((p) => benchmarkedPlayerIds.has(p.id)).length,
    total: activePlayers.length,
  };
  // Squad delta: improvement on the top single-scope pinned pulse
  // (breakdown pulses don't have a single current/previous — they're
  // N rows). Skip them for the hero stat.
  let squadDelta: number | null = null;
  const topSingle = pulses.find((p): p is PinnedPulse => p.kind === "single");
  if (
    topSingle &&
    topSingle.current != null &&
    topSingle.previous != null &&
    topSingle.previous !== 0
  ) {
    const raw = (topSingle.current - topSingle.previous) / topSingle.previous;
    squadDelta = (topSingle.inverse ? -raw : raw) * 100;
  }
  const hero: HeroStats = {
    squadDelta,
    drillsLogged: completedRecent.reduce(
      (s, p) => s + (planDrillsByPractice.get(p.id)?.length ?? 0),
      0
    ),
    streakWeeks: cadence.streakWeeks,
    rosterLocked,
  };

  return {
    hero,
    nextPractice,
    pulses,
    trendSeries,
    movers,
    drillMix: { entries: mixEntries, total: mixTotal, underweight },
    attendance,
    cadence,
    attention,
    activity,
    mostRunDrills,
    isCurrentUserCaptain: currentPlayer?.is_captain === true,
    currentUserPlayerId: currentPlayer?.id ?? null,
  };
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}
