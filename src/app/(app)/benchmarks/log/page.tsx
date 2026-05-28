import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BenchKind } from "@/components/uff-web/drills/atoms";
import type { DrillSkillWeight, SkillGroup } from "@/lib/types/skills";
import BenchmarkLogClient, {
  type BenchConfigEntry,
  type SkillTagGroup,
} from "./BenchmarkLogClient";

type SearchParams = Promise<{ drill?: string; players?: string }>;

const VALID_KINDS: ReadonlySet<string> = new Set([
  "timed",
  "rated",
  "reps",
  "pct",
  "flags",
  "drops",
]);

function coalesceTypes(
  benchmarkTypes: string[] | null,
  benchmarkType: string | null,
): BenchKind[] {
  const out: BenchKind[] = [];
  const seen = new Set<string>();
  for (const t of benchmarkTypes ?? []) {
    if (t && VALID_KINDS.has(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t as BenchKind);
    }
  }
  if (out.length === 0 && benchmarkType && VALID_KINDS.has(benchmarkType)) {
    out.push(benchmarkType as BenchKind);
  }
  return out;
}

export default async function BenchmarkLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { drill: drillId, players: playerIdsParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/team-setup");
  const teamId = membership.team_id;

  if (!drillId || !playerIdsParam) redirect("/benchmarks");

  const playerIds = playerIdsParam.split(",").filter(Boolean);
  if (playerIds.length === 0) redirect("/benchmarks");

  const { data: drill } = await supabase
    .from("team_drills")
    .select("id, team_id, drill_name, benchmark_type, benchmark_types, benchmark_config")
    .eq("id", drillId)
    .maybeSingle();

  if (!drill || drill.team_id !== teamId) redirect("/benchmarks");

  const types = coalesceTypes(
    drill.benchmark_types as string[] | null,
    drill.benchmark_type as string | null,
  );
  if (types.length === 0) redirect("/benchmarks");

  const config =
    (drill.benchmark_config as Partial<Record<BenchKind, BenchConfigEntry>> | null) ?? {};

  // Skill tags grouped by skill — surfaces the chip library tied to the
  // drill's drill_skills rows. Build 11 replaces the hardcoded QUICK_TAGS
  // list. We sort skills primary-first so primary-tagged skills lead.
  const { data: drillSkillRows } = await supabase
    .from("drill_skills")
    .select("skill_id, weight, skills(id, slug, skill_name, skill_group, display_order)")
    .eq("drill_id", drill.id);

  type DrillSkillRow = {
    skill_id: string;
    weight: number;
    skills:
      | {
          id: string;
          slug: string;
          skill_name: string;
          skill_group: string;
          display_order: number;
        }
      | null;
  };

  const skillRows = ((drillSkillRows as DrillSkillRow[] | null) ?? []).filter(
    (r) => r.skills != null,
  );
  const skillIds = skillRows.map((r) => r.skill_id);

  const skillTagsBySkill = new Map<string, { id: string; label: string }[]>();
  if (skillIds.length > 0) {
    const { data: tagRows } = await supabase
      .from("skill_tags")
      .select("id, skill_id, label, display_order, is_active")
      .in("skill_id", skillIds)
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    for (const row of (tagRows ?? []) as Array<{
      id: string;
      skill_id: string;
      label: string;
    }>) {
      const list = skillTagsBySkill.get(row.skill_id) ?? [];
      list.push({ id: row.id, label: row.label });
      skillTagsBySkill.set(row.skill_id, list);
    }
  }

  const skillTagGroups: SkillTagGroup[] = skillRows
    .map((r) => ({
      skillId: r.skill_id,
      skillName: r.skills!.skill_name,
      skillGroup: r.skills!.skill_group as SkillGroup,
      weight: (r.weight === 1 ? 1.0 : 0.5) as DrillSkillWeight,
      displayOrder: r.skills!.display_order,
      tags: skillTagsBySkill.get(r.skill_id) ?? [],
    }))
    .filter((g) => g.tags.length > 0)
    .sort((a, b) => {
      // primary (weight 1.0) first, then by skill display_order
      if (a.weight !== b.weight) return b.weight - a.weight;
      return a.displayOrder - b.displayOrder;
    });

  const { data: players } = await supabase
    .from("team_players")
    .select("id, player_name, positions")
    .eq("team_id", teamId)
    .in("id", playerIds);

  const playerMap = new Map(
    (players ?? []).map((p) => [
      p.id as string,
      {
        id: p.id as string,
        name: p.player_name as string,
        positions: (p.positions as string[] | null) ?? [],
      },
    ])
  );

  const orderedPlayers = playerIds
    .map((id) => playerMap.get(id))
    .filter((p): p is { id: string; name: string; positions: string[] } => !!p);

  if (orderedPlayers.length === 0) redirect("/benchmarks");

  return (
    <BenchmarkLogClient
      teamId={teamId}
      userId={user.id}
      drill={{
        id: drill.id as string,
        name: drill.drill_name as string,
        types,
        config,
      }}
      players={orderedPlayers}
      skillTagGroups={skillTagGroups}
    />
  );
}
