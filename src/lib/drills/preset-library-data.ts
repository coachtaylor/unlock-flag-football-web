// Fetches the global preset drill library for the browse-and-clone page.
//
// Three queries in parallel:
//   1. preset_drills — the library itself, ordered by display_order
//   2. preset_drill_skills join skills — skill tags per preset
//   3. team_drills.preset_drill_id — which presets this team has already
//      cloned, so we can show "Already added" instead of another Clone
//
// Joins are hand-rolled in JS rather than via Supabase's nested-select
// because we want full type control + the shape we hand to the client is
// a denormalized `skills: TaggedSkill[]` array per preset, which doesn't
// map cleanly to a Supabase pgrst nested response.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BenchKind } from "@/components/uff-web/drills/atoms";
import type {
  PresetDrill,
  PresetDrillWithSkills,
  Skill,
  SkillGroup,
  TaggedSkill,
} from "@/lib/types/skills";

export type LoadedPresetLibrary = {
  presets: PresetDrillWithSkills[];
  skills: Skill[]; // full skill list, for the filter rail
};

export async function loadPresetLibrary(
  supabase: SupabaseClient,
  teamId: string,
): Promise<LoadedPresetLibrary> {
  const [
    { data: presetRows },
    { data: skillRows },
    { data: presetSkillLinks },
    { data: clonedRows },
  ] = await Promise.all([
    supabase
      .from("preset_drills")
      .select(
        "id, slug, drill_name, description, category_type, default_reps, default_duration_min, benchmark_types, benchmark_config, setup_diagram, setup_instructions, equipment, source_url, formats, primary_for_positions, display_order, is_active",
      )
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("skills")
      .select(
        "id, slug, skill_name, skill_group, description, display_order, is_benchmarkable, is_ratable",
      )
      .order("display_order", { ascending: true }),
    supabase
      .from("preset_drill_skills")
      .select("preset_drill_id, skill_id, weight"),
    // Only this team's clones — a preset cloned by another team shouldn't
    // hide the Clone button on this team's browse page.
    supabase
      .from("team_drills")
      .select("id, preset_drill_id")
      .eq("team_id", teamId)
      .not("preset_drill_id", "is", null),
  ]);

  const skills: Skill[] = (skillRows ?? []).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    skill_name: r.skill_name as string,
    skill_group: r.skill_group as SkillGroup,
    description: r.description as string,
    display_order: r.display_order as number,
    is_benchmarkable: !!r.is_benchmarkable,
    is_ratable: !!r.is_ratable,
  }));
  const skillById = new Map(skills.map((s) => [s.id, s]));

  // Group skill tags by preset_drill_id, weight 1.0 first then 0.5 so the
  // card UI can show primaries with emphasis without re-sorting.
  const skillsByPreset = new Map<string, TaggedSkill[]>();
  (presetSkillLinks ?? []).forEach((link) => {
    const skill = skillById.get(link.skill_id as string);
    if (!skill) return;
    const presetId = link.preset_drill_id as string;
    const arr = skillsByPreset.get(presetId) ?? [];
    arr.push({ ...skill, weight: Number(link.weight) as 1.0 | 0.5 });
    skillsByPreset.set(presetId, arr);
  });
  for (const arr of skillsByPreset.values()) {
    arr.sort((a, b) => {
      if (a.weight !== b.weight) return b.weight - a.weight; // 1.0 before 0.5
      return a.display_order - b.display_order;
    });
  }

  // First (and only) clone per preset for this team. If a coach clones
  // the same preset twice we surface whichever came back first; the
  // Clone button stays available in that edge case so they can clone
  // again if they really want to.
  const clonedPresetIdToDrillId = new Map<string, string>();
  (clonedRows ?? []).forEach((r) => {
    const presetId = r.preset_drill_id as string | null;
    if (!presetId) return;
    if (!clonedPresetIdToDrillId.has(presetId)) {
      clonedPresetIdToDrillId.set(presetId, r.id as string);
    }
  });

  const presets: PresetDrillWithSkills[] = (presetRows ?? []).map((r) => {
    const preset: PresetDrill = {
      id: r.id as string,
      slug: r.slug as string,
      drill_name: r.drill_name as string,
      description: r.description as string,
      category_type: r.category_type as string,
      default_reps: (r.default_reps as number | null) ?? null,
      default_duration_min: (r.default_duration_min as number | null) ?? null,
      benchmark_types: ((r.benchmark_types as string[] | null) ?? []).filter(
        (t): t is BenchKind =>
          (
            ["timed", "rated", "reps", "pct", "flags", "drops"] as const
          ).includes(t as BenchKind),
      ),
      benchmark_config: r.benchmark_config,
      setup_diagram: r.setup_diagram,
      setup_instructions: (r.setup_instructions as string | null) ?? null,
      equipment: r.equipment,
      source_url: (r.source_url as string | null) ?? null,
      formats: (r.formats as string[] | null) ?? [],
      primary_for_positions:
        (r.primary_for_positions as string[] | null) ?? [],
      display_order: r.display_order as number,
      is_active: !!r.is_active,
    };
    const clonedDrillId = clonedPresetIdToDrillId.get(preset.id) ?? null;
    return {
      ...preset,
      skills: skillsByPreset.get(preset.id) ?? [],
      alreadyCloned: clonedDrillId !== null,
      clonedDrillId,
    };
  });

  return { presets, skills };
}
