"use server";

// Server actions for the preset drill library.
//
// clonePresetDrill: calls the public.clone_preset_drill_to_team RPC, which
// copies a preset_drills row into team_drills + copies the preset_drill_skills
// mappings into drill_skills (atomic). Returns the new team_drills.id so the
// client can route to /drills/[id] for review/edit.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClonePresetResult =
  | { ok: true; drillId: string }
  | { ok: false; error: string };

export async function clonePresetDrill(
  presetDrillId: string,
  teamId: string,
): Promise<ClonePresetResult> {
  if (!presetDrillId || !teamId) {
    return { ok: false, error: "Missing presetDrillId or teamId." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // RPC enforces team membership server-side and raises on missing team.
  const { data, error } = await supabase.rpc("clone_preset_drill_to_team", {
    p_preset_drill_id: presetDrillId,
    p_team_id: teamId,
  });

  if (error) return { ok: false, error: error.message };
  const drillId = data as string | null;
  if (!drillId) return { ok: false, error: "Clone returned no drill id." };

  // Library page shows "Already added" pills; both pages need to re-render
  // to reflect the new team drill + its skill tags.
  revalidatePath("/drills");
  revalidatePath("/drills/library");

  return { ok: true, drillId };
}

export type RemoveCloneResult = { ok: true } | { ok: false; error: string };

// Turn a Postgres FK-violation (23503) on team_drills delete into a friendly,
// actionable message. The data tables (benchmark_results, practice_plan_drills)
// keep their no-cascade FKs on purpose, so removing a drill that has real data
// is blocked — tell the coach why instead of leaking the raw constraint text.
// Kept in sync verbatim with the mobile copy (unlock-mobile preset-library.ts).
function friendlyRemoveCloneError(error: {
  code?: string;
  message?: string;
  details?: string;
}): string {
  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (error.code === "23503" || haystack.includes("foreign key")) {
    if (haystack.includes("benchmark_results")) {
      return "This drill has benchmark results logged. Archive it instead of removing it from the library.";
    }
    if (haystack.includes("practice_plan_drills")) {
      return "This drill is used in a practice plan. Remove it from the plan first, then remove it from the library.";
    }
    return "This drill has linked data and can't be removed from the library.";
  }
  return error.message ?? "Couldn't remove the drill.";
}

// removeClonedDrill: removes this team's clone of a preset from the team
// library by deleting the team_drills row (the same hard-delete used
// elsewhere on mobile — matches that behavior so the preset card flips back
// to "Add to team"). Only ever touches the team's COPY; the global
// preset_drills row is untouched and stays browsable / re-addable. RLS on
// team_drills enforces that the caller belongs to the drill's team.
export async function removeClonedDrill(
  drillId: string,
): Promise<RemoveCloneResult> {
  if (!drillId) return { ok: false, error: "Missing drillId." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("team_drills")
    .delete()
    .eq("id", drillId);
  if (error) return { ok: false, error: friendlyRemoveCloneError(error) };

  revalidatePath("/drills");
  revalidatePath("/drills/library");
  return { ok: true };
}
