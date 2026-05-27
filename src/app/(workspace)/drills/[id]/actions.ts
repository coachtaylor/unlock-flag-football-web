"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTeamIds } from "@/lib/access/teams";

export async function archiveDrill(formData: FormData) {
  const drillId = String(formData.get("drillId") ?? "");
  if (!drillId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: drill } = await supabase
    .from("team_drills")
    .select("team_id")
    .eq("id", drillId)
    .maybeSingle();
  if (!drill) return;

  const accessibleTeamIds = await getAccessibleTeamIds(supabase, user.id);
  if (!accessibleTeamIds.includes(drill.team_id as string)) return;

  await supabase
    .from("team_drills")
    .update({ status: "archived" })
    .eq("id", drillId);

  revalidatePath(`/drills`);
  redirect(`/drills`);
}

export async function duplicateDrill(formData: FormData) {
  const drillId = String(formData.get("drillId") ?? "");
  if (!drillId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: original } = await supabase
    .from("team_drills")
    .select(
      "team_id, drill_name, category_id, additional_category_ids, description, source_url, benchmark_type, benchmark_types, benchmark_config, default_duration_min, default_reps, setup_diagram, setup_instructions, equipment, notes"
    )
    .eq("id", drillId)
    .maybeSingle();
  if (!original) return;

  const accessibleTeamIds = await getAccessibleTeamIds(supabase, user.id);
  if (!accessibleTeamIds.includes(original.team_id as string)) return;

  const { data: inserted, error } = await supabase
    .from("team_drills")
    .insert({
      team_id: original.team_id,
      created_by: user.id,
      drill_name: `${original.drill_name} (copy)`,
      category_id: original.category_id,
      additional_category_ids: original.additional_category_ids ?? [],
      description: original.description,
      source_url: original.source_url,
      benchmark_type: original.benchmark_type,
      benchmark_types: original.benchmark_types ?? [],
      benchmark_config: original.benchmark_config,
      default_duration_min: original.default_duration_min,
      default_reps: original.default_reps,
      setup_diagram: original.setup_diagram,
      setup_instructions: original.setup_instructions,
      equipment: original.equipment,
      notes: original.notes ?? [],
      status: "draft",
      is_dashboard_pinned: false,
    })
    .select("id")
    .single();

  if (error || !inserted) return;

  const cats = ((original.additional_category_ids as string[] | null) ?? [])
    .filter((id): id is string => !!id)
    .map((category_id) => ({ drill_id: inserted.id as string, category_id }));
  if (cats.length > 0) {
    await supabase.from("team_drill_categories").insert(cats);
  }

  // Carry skill tags too — a duplicate that loses its skills would force
  // the coach to re-pick them, which defeats the point of the duplicate.
  const { data: originalSkills } = await supabase
    .from("drill_skills")
    .select("skill_id, weight")
    .eq("drill_id", drillId);
  if (originalSkills && originalSkills.length > 0) {
    await supabase.from("drill_skills").insert(
      originalSkills.map((s) => ({
        drill_id: inserted.id as string,
        skill_id: s.skill_id,
        weight: s.weight,
      })),
    );
  }

  revalidatePath(`/drills`);
  redirect(`/drills/${inserted.id}/edit`);
}
