"use server";

// Canonical drill lifecycle server actions, shared by the team library
// list cards, the drill detail page, and the preset library.
//
// Lifecycle (custom drills, preset_drill_id IS NULL):
//   draft/published --archive--> archived --unarchive--> draft
//   archived        --delete---> (row removed)
//
// Preset clones (preset_drill_id IS NOT NULL) skip 'archived' and are
// hard-removed straight from the team library — see removeClonedDrill in
// ../../app/(workspace)/drills/library/actions.ts, which now delegates to
// deleteTeamDrill below so the delete + FK-error handling lives in ONE
// place.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DeleteDrillResult = { ok: true } | { ok: false; error: string };

// Turn a Postgres FK-violation (23503) on a team_drills delete into a
// friendly, actionable message. The data tables (benchmark_results,
// practice_plan_drills) keep their no-cascade FKs on purpose, so deleting a
// drill that has real data is blocked — tell the coach why instead of
// leaking the raw constraint text. Kept in sync verbatim with the mobile
// copy (unlock-mobile lib/preset-library.ts).
export function friendlyRemoveCloneError(error: {
  code?: string;
  message?: string;
  details?: string;
}): string {
  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (error.code === "23503" || haystack.includes("foreign key")) {
    if (haystack.includes("benchmark_results")) {
      return "This drill has benchmark results logged. Archive it instead of deleting it.";
    }
    if (haystack.includes("practice_plan_drills")) {
      return "This drill is used in a practice plan. Remove it from the plan first, then delete it.";
    }
    return "This drill has linked data and can't be deleted.";
  }
  return error.message ?? "Couldn't delete the drill.";
}

// Hard-delete a team_drills row. Used both for the preset "Remove from
// library" flow and the custom-drill permanent delete (only reachable from
// the archive, behind a type-the-name confirm). RLS on team_drills enforces
// the caller belongs to the drill's team.
export async function deleteTeamDrill(
  drillId: string,
): Promise<DeleteDrillResult> {
  if (!drillId) return { ok: false, error: "Missing drillId." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.from("team_drills").delete().eq("id", drillId);
  if (error) return { ok: false, error: friendlyRemoveCloneError(error) };

  revalidatePath("/drills");
  revalidatePath("/drills/library");
  return { ok: true };
}

// Soft-delete: a custom drill drops out of the active library + every
// status='published' picker. Data (benchmark_results, etc.) is untouched.
export async function archiveTeamDrill(
  drillId: string,
): Promise<DeleteDrillResult> {
  if (!drillId) return { ok: false, error: "Missing drillId." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("team_drills")
    .update({ status: "archived" })
    .eq("id", drillId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/drills");
  revalidatePath(`/drills/${drillId}`);
  return { ok: true };
}

// Restore an archived drill. Returns to 'draft' (never auto-republishes) so
// the coach re-reviews before it re-enters the shared library + pickers.
export async function unarchiveTeamDrill(
  drillId: string,
): Promise<DeleteDrillResult> {
  if (!drillId) return { ok: false, error: "Missing drillId." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("team_drills")
    .update({ status: "draft" })
    .eq("id", drillId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/drills");
  revalidatePath(`/drills/${drillId}`);
  return { ok: true };
}
