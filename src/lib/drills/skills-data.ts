// Server fetches for the skills taxonomy.
//
//   loadAllSkills(supabase)           — global reference data (25 skills,
//                                       ~120 chips). Same across teams.
//                                       Cheap to refetch per page; cache
//                                       later if it shows up in profiling.
//
//   loadDrillSkills(supabase, ids[])  — per-drill drill_skills mappings.
//                                       Used to hydrate DrillForm edit mode
//                                       and to render skill chips on the
//                                       drill detail page.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DrillSkillLink,
  DrillSkillWeight,
  Skill,
  SkillGroup,
  SkillTag,
  TaggedSkill,
} from "@/lib/types/skills";

export type SkillsCatalog = {
  skills: Skill[];
  // tagsBySkillId[skill.id] = chips for that skill, ordered.
  tagsBySkillId: Record<string, SkillTag[]>;
};

export async function loadAllSkills(
  supabase: SupabaseClient,
): Promise<SkillsCatalog> {
  const [{ data: skillRows }, { data: tagRows }] = await Promise.all([
    supabase
      .from("skills")
      .select(
        "id, slug, skill_name, skill_group, description, display_order, is_benchmarkable, is_ratable",
      )
      .order("display_order", { ascending: true }),
    supabase
      .from("skill_tags")
      .select("id, skill_id, label, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
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

  const tagsBySkillId: Record<string, SkillTag[]> = {};
  (tagRows ?? []).forEach((r) => {
    const skillId = r.skill_id as string;
    const tag: SkillTag = {
      id: r.id as string,
      skill_id: skillId,
      label: r.label as string,
      display_order: r.display_order as number,
      is_active: !!r.is_active,
    };
    (tagsBySkillId[skillId] ??= []).push(tag);
  });

  return { skills, tagsBySkillId };
}

// Returns the picked skills for one or more drills, denormalized so the
// caller can render chips without a second skill lookup. Used by both:
//   - DrillForm edit mode (single drill, hydrate the picker)
//   - Drill detail page (single drill, render the read-only chips)
//   - Future: bulk on the team drills list (multiple ids)
export async function loadDrillSkills(
  supabase: SupabaseClient,
  drillIds: string[],
): Promise<Record<string, TaggedSkill[]>> {
  if (drillIds.length === 0) return {};

  const { data: linkRows } = await supabase
    .from("drill_skills")
    .select("drill_id, skill_id, weight")
    .in("drill_id", drillIds);
  if (!linkRows || linkRows.length === 0) return {};

  const skillIds = Array.from(
    new Set(linkRows.map((r) => r.skill_id as string)),
  );
  const { data: skillRows } = await supabase
    .from("skills")
    .select(
      "id, slug, skill_name, skill_group, description, display_order, is_benchmarkable, is_ratable",
    )
    .in("id", skillIds);
  const skillById = new Map<string, Skill>();
  (skillRows ?? []).forEach((r) => {
    skillById.set(r.id as string, {
      id: r.id as string,
      slug: r.slug as string,
      skill_name: r.skill_name as string,
      skill_group: r.skill_group as SkillGroup,
      description: r.description as string,
      display_order: r.display_order as number,
      is_benchmarkable: !!r.is_benchmarkable,
      is_ratable: !!r.is_ratable,
    });
  });

  const out: Record<string, TaggedSkill[]> = {};
  for (const row of linkRows) {
    const drillId = row.drill_id as string;
    const skill = skillById.get(row.skill_id as string);
    if (!skill) continue;
    (out[drillId] ??= []).push({
      ...skill,
      weight: Number(row.weight) as DrillSkillWeight,
    });
  }
  // Primaries first within each drill, then by display_order.
  for (const arr of Object.values(out)) {
    arr.sort((a, b) => {
      if (a.weight !== b.weight) return b.weight - a.weight;
      return a.display_order - b.display_order;
    });
  }
  return out;
}

// Convenience for the edit-mode hydrator: returns the picker's
// initial-state shape (skill_id → weight) instead of full TaggedSkill rows.
export function toPickerInitial(tagged: TaggedSkill[]): DrillSkillLink[] {
  return tagged.map((s) => ({ skill_id: s.id, weight: s.weight }));
}
