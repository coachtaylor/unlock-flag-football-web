import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlockCandidates, CandidateDrill, SkeletonBlock } from "./types";

const MAX_CANDIDATES = 6;
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

function ranRecently(lastRunISO: string | null, nowISO: string): boolean {
  if (!lastRunISO) return false;
  return new Date(nowISO).getTime() - new Date(lastRunISO).getTime() < FOURTEEN_DAYS;
}

/** PURE: dedupe (strongest skillWeight per drill), rank weak-first, cap at MAX. */
function rankCandidates(list: CandidateDrill[], nowISO: string): CandidateDrill[] {
  const byId = new Map<string, CandidateDrill>();
  for (const c of list) {
    const prev = byId.get(c.drillId);
    if (!prev || c.skillWeight > prev.skillWeight) byId.set(c.drillId, c);
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
  return ranked.slice(0, MAX_CANDIDATES);
}

/** PURE: assemble + rank candidate drills for one skeleton block.
 *
 *  `candidates` key convention depends on block kind:
 *   - skill blocks → keyed by **skillId** (union over block.skillIds; gap detection)
 *   - category-driven blocks (warmup/team/custom) → keyed by **block.key**
 *  A single Task-8 map carries both; per call we read only the keys this block
 *  needs. (Safe because skill ids never collide with block keys like
 *  "team"/"warmup"/"skill-N"/"custom-N" in this taxonomy.) */
export function assembleBlockCandidates(
  block: SkeletonBlock,
  candidates: Map<string, CandidateDrill[]>,
  nowISO: string,
): BlockCandidates {
  if (block.kind === "skill") {
    if (block.skillIds.length === 0) return { blockKey: block.key, candidates: [], gapSkillIds: [] };
    const gapSkillIds = block.skillIds.filter((id) => (candidates.get(id)?.length ?? 0) === 0);
    const union = block.skillIds.flatMap((id) => candidates.get(id) ?? []);
    return { blockKey: block.key, candidates: rankCandidates(union, nowISO), gapSkillIds };
  }
  // category-driven block: candidates keyed by block.key
  const list = candidates.get(block.key) ?? [];
  return { blockKey: block.key, candidates: rankCandidates(list, nowISO), gapSkillIds: [] };
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

/** IMPURE: published team drills in any of the given category slugs, mapped to CandidateDrill. */
export async function fetchCandidatesByCategory(
  supabase: SupabaseClient,
  teamId: string,
  slugs: string[],
): Promise<CandidateDrill[]> {
  if (slugs.length === 0) return [];
  const { data, error } = await supabase
    .from("team_drills")
    .select(
      "id, drill_name, benchmark_type, status, team_id, drill_categories!team_drills_category_id_fkey(category_name)",
    )
    .eq("team_id", teamId)
    .eq("status", "published");
  if (error) throw error;
  const want = new Set(slugs.map((s) => s.toLowerCase()));
  const scores = await fetchDrillScores(supabase, teamId);
  const recent = await recentlyRunDrills(supabase, teamId);
  const out: CandidateDrill[] = [];
  for (const d of (data ?? []) as Record<string, unknown>[]) {
    const cat = (d.drill_categories as { category_name?: string } | null)?.category_name ?? null;
    const slug = cat ? cat.toLowerCase().replace(/\s+/g, "") : null;
    if (!slug || !want.has(slug)) continue;
    out.push({
      drillId: d.id as string,
      drillName: d.drill_name as string,
      categoryName: cat,
      benchmarkTypes: d.benchmark_type ? [d.benchmark_type as string] : [],
      defaultDurationMin: null,
      skillWeight: 1,
      drillScore: scores.get(d.id as string) ?? null,
      lastRunISO: recent.get(d.id as string) ?? null,
    });
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
