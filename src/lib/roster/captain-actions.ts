"use server";

// Server action for removing a captain's access (migration 90). When a
// captain's tag is pulled from a player who has a linked account, their
// coach-side membership is revoked. The caller chooses whether to keep the
// person as a name-only player (keepAsPlayer) or remove the roster row.
//
// Lives server-side so it revalidates the roster + team dashboard — the
// captain change alters both the players list and the dashboard's captain
// counts, and a bare client-side write would leave those routes stale (the
// "Trevor reappears only on refresh" bug).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RevokeCaptainPayload = {
  playerId: string;
  teamId: string;
  // false → keep a name-only player row (and its account link, for future
  // player-side access). true → delete the roster row entirely.
  deletePlayer: boolean;
};

export async function revokeCaptainAccess(
  payload: RevokeCaptainPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.rpc("revoke_captain_access", {
    p_player_id: payload.playerId,
    p_delete_player: payload.deletePlayer,
  });
  if (error) return { ok: false, error: error.message };

  // Roster list, the (now-removed) player detail, and the team dashboard all
  // read captain state — refresh them so the change shows without a reload.
  revalidatePath(`/dashboard/team/${payload.teamId}/roster`);
  revalidatePath(`/dashboard/team/${payload.teamId}/roster/${payload.playerId}`);
  revalidatePath(`/dashboard/team/${payload.teamId}`);
  return { ok: true };
}
