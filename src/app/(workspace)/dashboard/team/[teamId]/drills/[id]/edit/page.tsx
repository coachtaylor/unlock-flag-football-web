// /drills/[id]/edit — Drill form, edit mode (Web Build 4).

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTeamIds } from "@/lib/access/teams";
import { teamColorHex } from "@/components/uff/team-colors";
import {
  categoryToSlug,
  type BenchKind,
} from "@/components/uff-web/drills/atoms";
import DrillForm, { type DrillFormInitial } from "../../DrillForm";
import type { DiagramData } from "@/types/diagram";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import {
  loadAllSkills,
  loadDrillSkills,
  toPickerInitial,
} from "@/lib/drills/skills-data";
import {
  parseBenchmarkConfig,
  webEntriesFromConfig,
} from "@/lib/benchmarks/config";

export const dynamic = "force-dynamic";

const ALLOWED_BENCH: BenchKind[] = [
  "timed",
  "rated",
  "reps",
  "pct",
  "flags",
  "drops",
];

type Props = { params: Promise<{ teamId: string; id: string }> };

export default async function EditDrillPage({ params }: Props) {
  const { teamId: routeTeamId, id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const accessibleTeamIds = await getAccessibleTeamIds(supabase, user.id);
  if (accessibleTeamIds.length === 0) redirect("/onboarding/scope");

  const { data: drill } = await supabase
    .from("team_drills")
    .select(
      "id, drill_name, category_id, additional_category_ids, description, source_url, benchmark_type, benchmark_types, benchmark_config, is_dashboard_pinned, default_duration_min, default_reps, status, setup_diagram, setup_instructions, equipment, notes, team_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!drill || !accessibleTeamIds.includes(drill.team_id as string)) {
    notFound();
  }
  const teamId = drill.team_id as string;
  // The URL's team must match the drill's owning team.
  if (teamId !== routeTeamId) notFound();

  const [
    { data: team },
    { data: categories },
    { data: junction },
    skillsCatalog,
    drillSkillsMap,
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, team_name, team_color, league_id")
      .eq("id", teamId)
      .maybeSingle(),
    supabase
      .from("drill_categories")
      .select("id, category_name, category_type, display_order")
      .or(`team_id.is.null,team_id.eq.${teamId}`)
      .order("display_order", { ascending: true })
      .order("category_name", { ascending: true }),
    supabase
      .from("team_drill_categories")
      .select("category_id")
      .eq("drill_id", id),
    loadAllSkills(supabase),
    loadDrillSkills(supabase, [id]),
  ]);

  if (!team) redirect("/dashboard");

  const cats = (categories ?? []).map((c) => {
    const name = c.category_name as string;
    return {
      id: c.id as string,
      name,
      slug: categoryToSlug(name),
      type: ((c.category_type as string) === "phase"
        ? "phase"
        : "skill") as "phase" | "skill",
    };
  });

  // Resolve selected category ids: prefer the junction table (source of
  // truth for the new list); fall back to category_id + additional_category_ids
  // if the junction is empty for a legacy drill.
  const junctionIds = (junction ?? [])
    .map((j) => j.category_id as string | null)
    .filter((id): id is string => !!id);
  let selectedCategoryIds: string[] = junctionIds;
  if (selectedCategoryIds.length === 0) {
    const set = new Set<string>();
    if (drill.category_id) set.add(drill.category_id as string);
    for (const x of (drill.additional_category_ids as string[] | null) ?? []) {
      set.add(x);
    }
    selectedCategoryIds = Array.from(set);
  }

  // Coalesce legacy single benchmark_type into the new shape.
  const rawTypes = (drill.benchmark_types as string[] | null) ?? [];
  const legacy = drill.benchmark_type as string | null;
  const mergedTypes = new Set<string>(rawTypes);
  if (legacy) mergedTypes.add(legacy);
  const benchmarkTypes: BenchKind[] = Array.from(mergedTypes).filter(
    (t): t is BenchKind => (ALLOWED_BENCH as string[]).includes(t),
  );

  const rawDiagram = drill.setup_diagram as DiagramData | null;
  const setupDiagram =
    rawDiagram &&
    Array.isArray(rawDiagram.cones) &&
    rawDiagram.cones.length > 0
      ? rawDiagram
      : null;

  const equipment = drill.equipment as { other?: unknown } | null;
  const otherEquipment = Array.isArray(equipment?.other)
    ? (equipment!.other as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];

  // Parse the canonical (scope-grouped) config and flatten it into web's
  // scope-less per-type {target, better} for the form. The raw canonical
  // config rides along so a web save preserves scope + mobile-only knobs.
  const benchmarkConfigRaw = parseBenchmarkConfig(drill.benchmark_config);
  const benchmarkConfig = benchmarkConfigRaw
    ? webEntriesFromConfig(benchmarkConfigRaw).perType
    : {};

  const initial: DrillFormInitial = {
    id: drill.id as string,
    drillName: (drill.drill_name as string) ?? "",
    description: (drill.description as string | null) ?? "",
    sourceUrl: (drill.source_url as string | null) ?? "",
    categoryIds: selectedCategoryIds,
    skills: toPickerInitial(drillSkillsMap[id] ?? []),
    benchmarkTypes,
    benchmarkConfig,
    benchmarkConfigRaw,
    defaultDurationMin: (drill.default_duration_min as number | null) ?? 10,
    defaultReps: (drill.default_reps as number | null) ?? 5,
    otherEquipment,
    notes: Array.isArray(drill.notes)
      ? (drill.notes as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [],
    status:
      (drill.status as "draft" | "published" | null) ?? "draft",
    isDashboardPinned: !!drill.is_dashboard_pinned,
    setupDiagram,
    setupInstructions: (drill.setup_instructions as string | null) ?? null,
  };

  const firstName = (profile?.first_name as string | null) ?? "";
  const lastName = (profile?.last_name as string | null) ?? "";
  const initials =
    `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  const sidebarWorkspaces = await loadSidebarWorkspaces(
    team.id as string,
    (team.league_id as string | null) ?? null,
  );

  return (
    <DrillForm
      team={{
        id: team.id as string,
        name: team.team_name as string,
        color: teamColorHex(team.team_color as string | null),
        leagueId: (team.league_id as string | null) ?? null,
      }}
      user={{ firstName, lastName, initials }}
      categories={cats}
      skills={skillsCatalog.skills}
      initial={initial}
      sidebarWorkspaces={sidebarWorkspaces}
    />
  );
}
