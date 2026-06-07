"use server";

// Write paths for the Team Scouting Report side sheet (Build 8.7 Phase 3).
// Web is read-first; these are the two desk-work corrections that are awkward
// on a phone at practice:
//   • addPlayerNote      → append a dated observation (player_notes)
//   • correctBenchmarkResult → fix a fat-fingered value on an existing row
//
// No new-result-from-memory path (capture stays mobile/in-person). Both gate
// on full team-management access via the canonical access lib so a view-only
// captain can't write even if they reach the action.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTeamAccess, canManageTeam } from "@/lib/access/teams";

type Result = { ok: true } | { ok: false; error: string };

async function requireManage(
  teamId: string,
): Promise<
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const access = await getTeamAccess(supabase, user.id, teamId);
  if (!canManageTeam(access)) return { ok: false, error: "Not authorised" };

  return { ok: true, userId: user.id, supabase };
}

export async function addPlayerNote(input: {
  teamId: string;
  playerId: string;
  noteText: string;
}): Promise<Result> {
  const text = input.noteText.trim();
  if (!text) return { ok: false, error: "Note can't be empty" };

  const gate = await requireManage(input.teamId);
  if (!gate.ok) return gate;

  // player_notes.practice_plan_id is nullable — a note written from the
  // scouting sheet isn't tied to a specific practice.
  const { error } = await gate.supabase.from("player_notes").insert({
    player_id: input.playerId,
    team_id: input.teamId,
    note_text: text,
    created_by: gate.userId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/team/${input.teamId}/benchmarks`);
  revalidatePath(`/dashboard/team/${input.teamId}/roster/${input.playerId}`);
  return { ok: true };
}

export async function correctBenchmarkResult(input: {
  teamId: string;
  resultId: string;
  playerId: string;
  // Only the value columns for the row's type are sent; the rest stay null.
  timeSeconds?: number | null;
  rating?: number | null;
  madeCount?: number | null;
  attemptsCount?: number | null;
}): Promise<Result> {
  const gate = await requireManage(input.teamId);
  if (!gate.ok) return gate;

  const patch: Record<string, number | null> = {};
  if ("timeSeconds" in input) patch.time_seconds = input.timeSeconds ?? null;
  if ("rating" in input) patch.rating = input.rating ?? null;
  if ("madeCount" in input) patch.made_count = input.madeCount ?? null;
  if ("attemptsCount" in input) patch.attempts_count = input.attemptsCount ?? null;
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update" };
  }

  // team_id guard belts-and-suspenders alongside RLS — the row must belong to
  // the team the caller is authorised on.
  const { error } = await gate.supabase
    .from("benchmark_results")
    .update(patch)
    .eq("id", input.resultId)
    .eq("team_id", input.teamId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/team/${input.teamId}/benchmarks`);
  revalidatePath(`/dashboard/team/${input.teamId}/roster/${input.playerId}`);
  return { ok: true };
}
