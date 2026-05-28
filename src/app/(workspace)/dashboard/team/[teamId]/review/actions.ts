"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ClearFlagResult =
  | { ok: true }
  | { ok: false; error: string };

// Build 11: captain clears the needs_review flag on a single
// benchmark_results row from the dashboard review queue. RLS already
// scopes writes to the user's team(s), so we only need to filter by id
// + team_id as a belt-and-suspenders guard.
export async function clearNeedsReview(args: {
  resultId: string;
  teamId: string;
}): Promise<ClearFlagResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("benchmark_results")
    .update({ needs_review: false })
    .eq("id", args.resultId)
    .eq("team_id", args.teamId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/team/${args.teamId}/review`);
  revalidatePath(`/dashboard/team/${args.teamId}`);
  return { ok: true };
}
