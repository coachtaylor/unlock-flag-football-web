import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlockCandidates, CandidateDrill, SkeletonBlock } from "./types";

const MAX_CANDIDATES = 6;
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

function ranRecently(lastRunISO: string | null, nowISO: string): boolean {
  if (!lastRunISO) return false;
  return new Date(nowISO).getTime() - new Date(lastRunISO).getTime() < FOURTEEN_DAYS;
}

/** PURE: assemble + rank candidate drills for one skeleton block. */
export function assembleBlockCandidates(
  block: SkeletonBlock,
  candidatesBySkill: Map<string, CandidateDrill[]>,
  nowISO: string,
): BlockCandidates {
  if (block.kind !== "skill" || block.skillIds.length === 0) {
    return { blockKey: block.key, candidates: [], gapSkillIds: [] };
  }
  const gapSkillIds = block.skillIds.filter((id) => (candidatesBySkill.get(id)?.length ?? 0) === 0);

  // union + dedup keeping the strongest skillWeight seen per drill
  const byId = new Map<string, CandidateDrill>();
  for (const id of block.skillIds) {
    for (const c of candidatesBySkill.get(id) ?? []) {
      const prev = byId.get(c.drillId);
      if (!prev || c.skillWeight > prev.skillWeight) byId.set(c.drillId, c);
    }
  }

  const ranked = [...byId.values()].sort((a, b) => {
    if (b.skillWeight !== a.skillWeight) return b.skillWeight - a.skillWeight;
    const aStale = ranRecently(a.lastRunISO, nowISO) ? 1 : 0;
    const bStale = ranRecently(b.lastRunISO, nowISO) ? 1 : 0;
    if (aStale !== bStale) return aStale - bStale;
    const as = a.drillScore ?? 0.5;
    const bs = b.drillScore ?? 0.5;
    if (as !== bs) return as - bs;
    return a.drillName.localeCompare(b.drillName);
  });

  return { blockKey: block.key, candidates: ranked.slice(0, MAX_CANDIDATES), gapSkillIds };
}

// ---------------------------------------------------------------------------
// IMPURE DB adapters (integration-verified, not unit-tested)
// ---------------------------------------------------------------------------

/** IMPURE: published team drills tagged to any of skillIds, keyed by skillId. */
export async function fetchCandidatesBySkill(
  supabase: SupabaseClient,
  teamId: string,
  skillIds: string[],
): Promise<Map<string, CandidateDrill[]>> {
  const out = new Map<string, CandidateDrill[]>();
  if (skillIds.length === 0) return out;

  const { data, error } = await supabase
    .from("drill_skills")
    .select(
      // Qualify the FK: team_drills has two paths to drill_categories (the
      // category_id FK + the team_drill_categories junction), so an unqualified
      // embed is ambiguous (PGRST201). Column is category_name, not name.
      "skill_id, weight, team_drills!inner(id, drill_name, status, team_id, benchmark_type, drill_categories!team_drills_category_id_fkey(category_name))",
    )
    .in("skill_id", skillIds)
    .eq("team_drills.team_id", teamId)
    .eq("team_drills.status", "published");
  if (error) throw error;

  const scores = await fetchDrillScores(supabase, teamId);
  const recent = await recentlyRunDrills(supabase, teamId);

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const d = row.team_drills as Record<string, unknown> | null;
    if (!d) continue;
    const cat = d.drill_categories as { category_name?: string } | null;
    const c: CandidateDrill = {
      drillId: d.id as string,
      drillName: d.drill_name as string,
      categoryName: cat?.category_name ?? null,
      benchmarkTypes: d.benchmark_type ? [d.benchmark_type as string] : [],
      defaultDurationMin: null,
      skillWeight: Number(row.weight ?? 1),
      drillScore: scores.get(d.id as string) ?? null,
      lastRunISO: recent.get(d.id as string) ?? null,
    };
    const skillId = row.skill_id as string;
    const list = out.get(skillId) ?? [];
    list.push(c);
    out.set(skillId, list);
  }
  return out;
}

/** IMPURE: per-drill team avg score (0..1) from the unified score view. Fails soft. */
export async function fetchDrillScores(
  supabase: SupabaseClient,
  teamId: string,
): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  const { data, error } = await supabase
    .from("v_player_drill_score")
    .select("drill_id, score")
    .eq("team_id", teamId);
  if (error) return m; // view name/shape may differ — ranking falls back to nulls
  const agg = new Map<string, { sum: number; n: number }>();
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    if (r.score == null) continue;
    const id = r.drill_id as string;
    const a = agg.get(id) ?? { sum: 0, n: 0 };
    a.sum += Number(r.score);
    a.n += 1;
    agg.set(id, a);
  }
  for (const [id, a] of agg) m.set(id, a.sum / a.n);
  return m;
}

/** IMPURE: drillId -> most recent completed-practice ISO date. Fails soft. */
export async function recentlyRunDrills(
  supabase: SupabaseClient,
  teamId: string,
): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const { data, error } = await supabase
    .from("practice_plan_drills")
    .select("drill_id, practice_plans!inner(practice_date, team_id, status)")
    .eq("practice_plans.team_id", teamId)
    .eq("practice_plans.status", "completed");
  if (error) return m;
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    if (!r.drill_id) continue;
    const pp = r.practice_plans as { practice_date?: string } | null;
    const date = pp?.practice_date;
    if (!date) continue;
    const iso = new Date(date).toISOString();
    const id = r.drill_id as string;
    const prev = m.get(id);
    if (!prev || iso > prev) m.set(id, iso);
  }
  return m;
}
