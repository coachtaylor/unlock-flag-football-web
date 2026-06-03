"use server";

// Server actions for the preset drill library.
//
// clonePresetDrill: calls the public.clone_preset_drill_to_team RPC, which
// copies a preset_drills row into team_drills + copies the preset_drill_skills
// mappings into drill_skills (atomic). Returns the new team_drills.id so the
// client can route to /drills/[id] for review/edit.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteTeamDrill } from "@/lib/drills/lifecycle-actions";

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
  const base = `/dashboard/team/${teamId}/drills`;
  revalidatePath(base);
  revalidatePath(`${base}/library`);

  return { ok: true, drillId };
}

export type RemoveCloneResult = { ok: true } | { ok: false; error: string };

// removeClonedDrill: removes this team's clone of a preset from the team
// library by deleting the team_drills row, so the preset card flips back to
// "Add to team". Only ever touches the team's COPY; the global preset_drills
// row is untouched and stays browsable / re-addable. The delete + FK-error
// handling lives in the canonical deleteTeamDrill (lib/drills/lifecycle-
// actions) so the preset remove and the custom-drill permanent delete share
// one source of truth.
export async function removeClonedDrill(
  drillId: string,
  teamId?: string,
): Promise<RemoveCloneResult> {
  return deleteTeamDrill(drillId, teamId);
}
