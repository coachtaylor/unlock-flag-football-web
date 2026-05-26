"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Pin or unpin a drill on the team dashboard. The dashboard shows up to
// 4 pinned drills as Pinned Pulses (Build 7). State lives on the drill
// row itself (team_drills.is_dashboard_pinned + dashboard_pinned_at)
// rather than in a separate join table — mobile uses the same column.

export async function togglePinDrill(
  drillId: string,
  teamId: string,
  pinned: boolean
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  // RLS handles authorization. The .eq() guards limit blast radius if a
  // caller passes a mismatched drillId / teamId pair.
  const { error } = await supabase
    .from("team_drills")
    .update({
      is_dashboard_pinned: pinned,
      dashboard_pinned_at: pinned ? new Date().toISOString() : null,
    })
    .eq("id", drillId)
    .eq("team_id", teamId);
  if (error) throw error;

  revalidatePath(`/dashboard/team/${teamId}`);
  revalidatePath(`/drills/${drillId}`);
}
