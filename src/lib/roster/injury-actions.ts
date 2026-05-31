"use server";

// Server actions for the injury modal on player detail (Build 6.5c).
// Lives in its own file so the import surface stays small — the existing
// PlayerForm submits via the browser-side Supabase client and doesn't
// need server actions, so there isn't an actions.ts to bolt this onto.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ToggleInjuryPayload = {
  playerId: string;
  teamId: string;
  isInjured: boolean;
  // Only used when isInjured === true. Empty / whitespace-only strings
  // collapse to null. When isInjured === false the note is left untouched
  // — recovering from an injury keeps the saved note for the record.
  note: string | null;
};

export async function toggleInjury(
  payload: ToggleInjuryPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Access check: caller must be a member of the team OR a league admin
  // of the team's league. Mirrors the read-side check in the player
  // detail page so the write surface can't be reached by users without
  // dashboard access.
  const { data: membership } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("team_id", payload.teamId)
    .maybeSingle();

  let canWrite = !!membership;
  if (!canWrite) {
    const { data: team } = await supabase
      .from("teams")
      .select("league_id")
      .eq("id", payload.teamId)
      .maybeSingle();
    if (team?.league_id) {
      const { data: leagueMember } = await supabase
        .from("league_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("league_id", team.league_id)
        .eq("role", "league_admin")
        .maybeSingle();
      canWrite = !!leagueMember;
    }
  }
  if (!canWrite) return { ok: false, error: "Not authorised" };

  // Marking injured updates the note; marking healthy flips only the flag
  // and preserves whatever note was saved (notes are never auto-deleted).
  const update: { is_injured: boolean; injury_note?: string | null } = {
    is_injured: payload.isInjured,
  };
  if (payload.isInjured) {
    update.injury_note = payload.note?.trim() || null;
  }

  const { error: updErr } = await supabase
    .from("team_players")
    .update(update)
    .eq("id", payload.playerId)
    .eq("team_id", payload.teamId);
  if (updErr) return { ok: false, error: updErr.message };

  // Player detail + roster list both surface injury — revalidate both.
  revalidatePath(`/dashboard/team/${payload.teamId}/roster`);
  revalidatePath(`/dashboard/team/${payload.teamId}/roster/${payload.playerId}`);
  return { ok: true };
}
