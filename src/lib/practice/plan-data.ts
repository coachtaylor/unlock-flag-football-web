// Data layer for Build 5.5: read paths for practice_plan_blocks,
// practice_plan_drills (with plan_block_id + parallel_group),
// practice_plan_breaks, practice_plan_attendees, team_practice_blocks.
//
// Pure data shape — no UI here. The detail / list / editor pages all
// hydrate from these helpers.

import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanStatus = "draft" | "scheduled" | "live" | "completed";

// The title a freshly-created practice plan gets before the coach renames it.
// Single source of truth — use this constant for plan creation, never a
// bare string literal.
export const DEFAULT_PLAN_TITLE = "Untitled practice plan";

// Titles that are effectively "no real name": blank, or one of the app's
// default placeholders (the stored default plus the display fallbacks). These
// skip the type-the-name delete confirmation — there's nothing meaningful to
// type. One canonical predicate so the modal + any call site agree.
const PLACEHOLDER_PLAN_TITLES = new Set([
  DEFAULT_PLAN_TITLE.toLowerCase(),
  "untitled practice",
  "untitled plan",
]);

export function isUntitledPlanTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim();
  return t.length === 0 || PLACEHOLDER_PLAN_TITLES.has(t.toLowerCase());
}

export type PlanDrill = {
  id: string;
  drill_id: string | null;
  drill_name: string | null;
  drill_order: number;
  duration_minutes: number;
  reps_count: number | null;
  notes: string | null;
  parallel_group: number | null;
  is_water_break: boolean;
  benchmark_types: string[];
  category_name: string | null;
  description: string | null;
  // Captured during the post-practice log (Build 6.5a). Persisted on the
  // plan_drill row itself so it travels with the drill row and shows up
  // in DrillNoteHistorySheet without a separate table.
  log_note: string | null;
};

export type PlanBlock = {
  id: string;
  name: string;
  block_order: number;
  target_minutes: number | null;
  template_id: string | null;
  drills: PlanDrill[];
};

export type PlanBreak = {
  id: string;
  after_block_order: number;
  break_order: number;
  duration_minutes: number;
};

export type PlanAttendee = {
  player_id: string;
  rsvp: boolean | null;
  attended: boolean | null;
};

export type PracticePlan = {
  id: string;
  team_id: string;
  title: string;
  practice_date: string; // ISO date
  start_time: string | null;
  end_time: string | null;
  status: PlanStatus;
  notes: string | null;
  archived: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  blocks: PlanBlock[];
  breaks: PlanBreak[];
  attendees: PlanAttendee[];
};

export type PlanSummary = {
  id: string;
  team_id: string;
  title: string;
  practice_date: string;
  start_time: string | null;
  status: PlanStatus;
  block_count: number;
  drill_count: number;
  total_minutes: number;
  target_minutes: number;
  rsvp_in: number;
  blocks: { id: string; name: string; minutes: number }[];
  break_minutes: number;
  archived: boolean;
};

// ── Plan derived helpers ─────────────────────────────────────────────────

// Sum minutes for a single block. Parallel groups count ONCE — the slot
// length is the MAX duration in the group. Matches mobile RPC validation.
export function blockMinutes(block: PlanBlock): number {
  const seen = new Set<number>();
  let mn = 0;
  for (const d of block.drills) {
    if (d.parallel_group != null) {
      if (seen.has(d.parallel_group)) continue;
      seen.add(d.parallel_group);
      const siblings = block.drills.filter((x) => x.parallel_group === d.parallel_group);
      mn += Math.max(...siblings.map((x) => x.duration_minutes));
    } else {
      mn += d.duration_minutes;
    }
  }
  return mn;
}

export type PlanTotals = {
  drillsMin: number;
  breakMin: number;
  breakCount: number;
  total: number;
  drillCount: number;
  blockCount: number;
  parallelSlots: number;
  benchCount: number;
  rsvpIn: number;
  rsvpOut: number;
  rsvpMaybe: number;
  target: number;
};

// Breaks "render" only when their after_block_order matches an existing
// block_order (or is -1, meaning "before the first block"). Anything else
// is an orphan — usually left over from a block removal or reorder that
// didn't fix up its anchored breaks. Totals should match what's rendered,
// so we filter through this here.
export function visibleBreaks(plan: PracticePlan): PlanBreak[] {
  const valid = new Set<number>(plan.blocks.map((b) => b.block_order));
  valid.add(-1);
  return plan.breaks.filter((br) => valid.has(br.after_block_order));
}

export function planTotals(plan: PracticePlan): PlanTotals {
  let drillsMin = 0;
  let drillCount = 0;
  let parallelSlots = 0;
  let benchCount = 0;
  for (const b of plan.blocks) {
    drillsMin += blockMinutes(b);
    drillCount += b.drills.length;
    const seen = new Set<number>();
    for (const d of b.drills) {
      if (d.parallel_group != null && !seen.has(d.parallel_group)) {
        seen.add(d.parallel_group);
        parallelSlots += 1;
      }
      if (d.benchmark_types && d.benchmark_types.length > 0) benchCount += 1;
    }
  }
  const renderBreaks = visibleBreaks(plan);
  const breakMin = renderBreaks.reduce((a, br) => a + br.duration_minutes, 0);
  const total = drillsMin + breakMin;
  // RSVP currently stored as a single boolean; "maybe" doesn't exist on
  // the schema yet. We surface in/out only; reserve maybe for future.
  const rsvpIn = plan.attendees.filter((a) => a.rsvp === true).length;
  const rsvpOut = plan.attendees.filter((a) => a.rsvp === false).length;
  const rsvpMaybe = 0;
  // Target falls back to sum of block targets if not set on plan
  const target = plan.blocks.reduce((a, b) => a + (b.target_minutes ?? 0), 0);
  return {
    drillsMin,
    breakMin,
    breakCount: renderBreaks.length,
    total,
    drillCount,
    blockCount: plan.blocks.length,
    parallelSlots,
    benchCount,
    rsvpIn,
    rsvpOut,
    rsvpMaybe,
    target: target || total,
  };
}

// Render-order interleave of blocks and breaks. Breaks are anchored by
// after_block_order (-1 = before everything, N = after block with that
// order). Multiple breaks at the same anchor preserve their break_order.
export type InterleaveRow =
  | { kind: "break"; payload: PlanBreak }
  | { kind: "block"; payload: PlanBlock };

export function interleavePlan(plan: PracticePlan): InterleaveRow[] {
  const byOrder = new Map<number, PlanBreak[]>();
  for (const br of plan.breaks) {
    const arr = byOrder.get(br.after_block_order) ?? [];
    arr.push(br);
    byOrder.set(br.after_block_order, arr);
  }
  for (const arr of byOrder.values()) arr.sort((a, b) => a.break_order - b.break_order);

  const out: InterleaveRow[] = [];
  // Breaks before the first block
  for (const br of byOrder.get(-1) ?? []) out.push({ kind: "break", payload: br });
  const blocks = [...plan.blocks].sort((a, b) => a.block_order - b.block_order);
  for (const b of blocks) {
    out.push({ kind: "block", payload: b });
    for (const br of byOrder.get(b.block_order) ?? []) out.push({ kind: "break", payload: br });
  }
  return out;
}

// ── Fetchers ────────────────────────────────────────────────────────────

export async function fetchPlanFull(
  supabase: SupabaseClient,
  planId: string,
): Promise<PracticePlan | null> {
  const planRes = await supabase
    .from("practice_plans")
    .select(
      "id, team_id, title, practice_date, start_time, end_time, status, notes, archived_at, created_by, updated_by, created_at, updated_at",
    )
    .eq("id", planId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let plan = planRes.data as Record<string, any> | null;
  if (planRes.error) {
    // archived_at / attribution columns (mig 70 / 75) may not exist yet — retry without them.
    const retry = await supabase
      .from("practice_plans")
      .select(
        "id, team_id, title, practice_date, start_time, end_time, status, notes",
      )
      .eq("id", planId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plan = retry.data as Record<string, any> | null;
  }
  if (!plan) return null;

  const [blocksRes, drillsRes, breaksRes, attendeesRes] = await Promise.all([
    supabase
      .from("practice_plan_blocks")
      .select("id, name, block_order, target_minutes, template_id")
      .eq("practice_plan_id", planId)
      .order("block_order", { ascending: true }),
    supabase
      .from("practice_plan_drills")
      .select(
        "id, plan_block_id, drill_id, drill_order, duration_minutes, reps_count, notes, parallel_group, is_water_break, log_note",
      )
      .eq("practice_plan_id", planId)
      .order("drill_order", { ascending: true }),
    supabase
      .from("practice_plan_breaks")
      .select("id, after_block_order, break_order, duration_minutes")
      .eq("practice_plan_id", planId)
      .order("break_order", { ascending: true }),
    supabase
      .from("practice_plan_attendees")
      .select("player_id, rsvp, attended")
      .eq("practice_plan_id", planId),
  ]);

  const drillIds = (drillsRes.data ?? [])
    .map((d) => d.drill_id as string | null)
    .filter((x): x is string => !!x);
  const drillsLookup = new Map<
    string,
    {
      name: string;
      benchmark_types: string[];
      category_name: string | null;
      description: string | null;
    }
  >();
  if (drillIds.length > 0) {
    const [{ data: tDrills }, { data: cats }] = await Promise.all([
      supabase
        .from("team_drills")
        .select("id, drill_name, benchmark_types, benchmark_type, description, category_id")
        .in("id", drillIds),
      supabase
        .from("drill_categories")
        .select("id, category_name"),
    ]);
    const catName = new Map<string, string>();
    for (const c of cats ?? []) catName.set(c.id as string, c.category_name as string);
    for (const d of tDrills ?? []) {
      const types = new Set<string>((d.benchmark_types as string[] | null) ?? []);
      if (d.benchmark_type) types.add(d.benchmark_type as string);
      drillsLookup.set(d.id as string, {
        name: d.drill_name as string,
        benchmark_types: Array.from(types),
        category_name: catName.get(d.category_id as string) ?? null,
        description: (d.description as string | null) ?? null,
      });
    }
  }

  const drillRows = (drillsRes.data ?? []).map((d): PlanDrill & { plan_block_id: string | null } => {
    const meta = d.drill_id ? drillsLookup.get(d.drill_id as string) : null;
    return {
      id: d.id as string,
      plan_block_id: (d.plan_block_id as string | null) ?? null,
      drill_id: (d.drill_id as string | null) ?? null,
      drill_name: meta?.name ?? null,
      drill_order: (d.drill_order as number) ?? 0,
      duration_minutes: (d.duration_minutes as number) ?? 0,
      reps_count: (d.reps_count as number | null) ?? null,
      notes: (d.notes as string | null) ?? null,
      parallel_group: (d.parallel_group as number | null) ?? null,
      is_water_break: (d.is_water_break as boolean) ?? false,
      benchmark_types: meta?.benchmark_types ?? [],
      category_name: meta?.category_name ?? null,
      description: meta?.description ?? null,
      log_note: (d.log_note as string | null) ?? null,
    };
  });

  const blocks: PlanBlock[] = (blocksRes.data ?? []).map((b) => ({
    id: b.id as string,
    name: (b.name as string) ?? "Block",
    block_order: (b.block_order as number) ?? 0,
    target_minutes: (b.target_minutes as number | null) ?? null,
    template_id: (b.template_id as string | null) ?? null,
    drills: drillRows
      .filter((d) => d.plan_block_id === b.id && !d.is_water_break)
      .sort((a, c) => a.drill_order - c.drill_order),
  }));

  return {
    id: plan.id as string,
    team_id: plan.team_id as string,
    title: (plan.title as string) ?? "",
    practice_date: plan.practice_date as string,
    start_time: (plan.start_time as string | null) ?? null,
    end_time: (plan.end_time as string | null) ?? null,
    status: ((plan.status as string) ?? "draft") as PlanStatus,
    notes: (plan.notes as string | null) ?? null,
    archived: !!((plan as { archived_at?: string | null }).archived_at),
    created_by: (plan.created_by as string | null) ?? null,
    updated_by: (plan.updated_by as string | null) ?? null,
    created_at: (plan.created_at as string | null) ?? null,
    updated_at: (plan.updated_at as string | null) ?? null,
    blocks,
    breaks: (breaksRes.data ?? []).map((br) => ({
      id: br.id as string,
      after_block_order: (br.after_block_order as number) ?? -1,
      break_order: (br.break_order as number) ?? 0,
      duration_minutes: (br.duration_minutes as number) ?? 2,
    })),
    attendees: (attendeesRes.data ?? []).map((a) => ({
      player_id: a.player_id as string,
      rsvp: (a.rsvp as boolean | null) ?? null,
      attended: (a.attended as boolean | null) ?? null,
    })),
  };
}

export async function fetchPlanSummaries(
  supabase: SupabaseClient,
  teamId: string,
): Promise<PlanSummary[]> {
  const plansRes = await supabase
    .from("practice_plans")
    .select("id, team_id, title, practice_date, start_time, status, archived_at")
    .eq("team_id", teamId)
    .order("practice_date", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let plans = plansRes.data as Record<string, any>[] | null;
  if (plansRes.error) {
    // archived_at may not exist yet (pre-migration 70) — retry without it.
    const retry = await supabase
      .from("practice_plans")
      .select("id, team_id, title, practice_date, start_time, status")
      .eq("team_id", teamId)
      .order("practice_date", { ascending: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plans = retry.data as Record<string, any>[] | null;
  }
  if (!plans || plans.length === 0) return [];

  const planIds = plans.map((p) => p.id as string);
  const [blocksRes, drillsRes, breaksRes, attendeesRes] = await Promise.all([
    supabase
      .from("practice_plan_blocks")
      .select("id, practice_plan_id, name, block_order, target_minutes")
      .in("practice_plan_id", planIds)
      .order("block_order", { ascending: true }),
    supabase
      .from("practice_plan_drills")
      .select("practice_plan_id, plan_block_id, duration_minutes, parallel_group, is_water_break")
      .in("practice_plan_id", planIds),
    supabase
      .from("practice_plan_breaks")
      .select("practice_plan_id, duration_minutes")
      .in("practice_plan_id", planIds),
    supabase
      .from("practice_plan_attendees")
      .select("practice_plan_id, rsvp")
      .in("practice_plan_id", planIds),
  ]);

  const drillsByBlock = new Map<string, { duration_minutes: number; parallel_group: number | null }[]>();
  let totalDrillsByPlan = new Map<string, number>();
  for (const d of drillsRes.data ?? []) {
    if (d.is_water_break) continue;
    if (!d.plan_block_id) continue;
    const arr = drillsByBlock.get(d.plan_block_id as string) ?? [];
    arr.push({
      duration_minutes: (d.duration_minutes as number) ?? 0,
      parallel_group: (d.parallel_group as number | null) ?? null,
    });
    drillsByBlock.set(d.plan_block_id as string, arr);
    totalDrillsByPlan.set(
      d.practice_plan_id as string,
      (totalDrillsByPlan.get(d.practice_plan_id as string) ?? 0) + 1,
    );
  }

  const breakMinByPlan = new Map<string, number>();
  for (const br of breaksRes.data ?? []) {
    const k = br.practice_plan_id as string;
    breakMinByPlan.set(k, (breakMinByPlan.get(k) ?? 0) + ((br.duration_minutes as number) ?? 0));
  }

  const rsvpInByPlan = new Map<string, number>();
  for (const a of attendeesRes.data ?? []) {
    if (a.rsvp === true) {
      const k = a.practice_plan_id as string;
      rsvpInByPlan.set(k, (rsvpInByPlan.get(k) ?? 0) + 1);
    }
  }

  const blocksByPlan = new Map<string, { id: string; name: string; minutes: number }[]>();
  const targetByPlan = new Map<string, number>();
  for (const b of blocksRes.data ?? []) {
    const drills = drillsByBlock.get(b.id as string) ?? [];
    // Parallel counts once with MAX
    const seen = new Set<number>();
    let mn = 0;
    for (const d of drills) {
      if (d.parallel_group != null) {
        if (seen.has(d.parallel_group)) continue;
        seen.add(d.parallel_group);
        const siblings = drills.filter((x) => x.parallel_group === d.parallel_group);
        mn += Math.max(...siblings.map((s) => s.duration_minutes));
      } else {
        mn += d.duration_minutes;
      }
    }
    const arr = blocksByPlan.get(b.practice_plan_id as string) ?? [];
    arr.push({ id: b.id as string, name: (b.name as string) ?? "Block", minutes: mn });
    blocksByPlan.set(b.practice_plan_id as string, arr);
    const k = b.practice_plan_id as string;
    targetByPlan.set(k, (targetByPlan.get(k) ?? 0) + ((b.target_minutes as number) ?? 0));
  }

  return plans.map((p) => {
    const id = p.id as string;
    const blocks = blocksByPlan.get(id) ?? [];
    const drillMin = blocks.reduce((a, b) => a + b.minutes, 0);
    const breakMin = breakMinByPlan.get(id) ?? 0;
    return {
      id,
      team_id: p.team_id as string,
      title: (p.title as string) ?? "Untitled plan",
      practice_date: p.practice_date as string,
      start_time: (p.start_time as string | null) ?? null,
      status: ((p.status as string) ?? "draft") as PlanStatus,
      block_count: blocks.length,
      drill_count: totalDrillsByPlan.get(id) ?? 0,
      total_minutes: drillMin + breakMin,
      target_minutes: targetByPlan.get(id) ?? drillMin + breakMin,
      rsvp_in: rsvpInByPlan.get(id) ?? 0,
      blocks,
      break_minutes: breakMin,
      archived: !!((p as { archived_at?: string | null }).archived_at),
    };
  });
}

export type BlockTemplate = {
  id: string;
  name: string;
  display_order: number;
};

export async function fetchBlockTemplates(
  supabase: SupabaseClient,
  teamId: string,
): Promise<BlockTemplate[]> {
  const { data } = await supabase
    .from("team_practice_blocks")
    .select("id, name, display_order")
    .eq("team_id", teamId)
    .order("display_order", { ascending: true });
  return (data ?? []).map((b) => ({
    id: b.id as string,
    name: b.name as string,
    display_order: (b.display_order as number) ?? 0,
  }));
}
