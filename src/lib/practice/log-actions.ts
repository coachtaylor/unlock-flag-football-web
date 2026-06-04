"use server";

// Post-practice log save action (Build 6.5a).
//
// One call replaces the plan's log + observations + per-drill log_notes.
// Strategy:
//   1. Upsert (insert or update) the single practice_logs row keyed by
//      practice_plan_id.
//   2. Replace ALL player_notes rows for the plan with the new payload —
//      the form is the source of truth for this plan's observation feed.
//      In MVP a single captain logs a plan, so replace-by-plan is safe.
//   3. Update each plan_drill's log_note (per-row patch, not RPC).
//   4. Transition the plan to status='completed' so it shows the right
//      pill on the list + detail pages.
//
// All four happen sequentially; if any fails, the call returns the error.
// We don't wrap in a transaction because Supabase JS doesn't expose one
// and the failure modes are mostly orthogonal (a drill update failing
// shouldn't unwind the log).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveLogDrill = {
  plan_drill_id: string;
  completed: boolean;
  skipped: boolean;
  log_note: string | null;
};

export type SaveLogObservation = {
  player_id: string;
  note_text: string;
};

export type SaveLogPayload = {
  plan_id: string;
  team_id: string;
  drills: SaveLogDrill[];
  observations: SaveLogObservation[];
  team_performance_notes: string | null;
  highlights: string | null;
  areas_to_improve: string | null;
  attendance_count: number | null;
  energy_level: number | null;
};

export async function savePracticeLog(
  payload: SaveLogPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const drillsCompleted = payload.drills
    .filter((d) => d.completed)
    .map((d) => d.plan_drill_id);
  const drillsSkipped = payload.drills
    .filter((d) => d.skipped)
    .map((d) => d.plan_drill_id);

  const logRow = {
    practice_plan_id: payload.plan_id,
    team_id: payload.team_id,
    logged_by: user.id,
    drills_completed: drillsCompleted,
    drills_skipped: drillsSkipped,
    team_performance_notes: payload.team_performance_notes,
    highlights: payload.highlights,
    areas_to_improve: payload.areas_to_improve,
    attendance_count: payload.attendance_count,
    energy_level: payload.energy_level,
    updated_at: new Date().toISOString(),
  };

  // 1. Upsert the practice_logs row. No unique constraint on
  // (practice_plan_id) in the schema today, so do a manual lookup +
  // update/insert.
  const { data: existing, error: lookupErr } = await supabase
    .from("practice_logs")
    .select("id")
    .eq("practice_plan_id", payload.plan_id)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: lookupErr.message };

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from("practice_logs")
      .update(logRow)
      .eq("id", existing.id);
    if (updErr) return { ok: false, error: updErr.message };
  } else {
    const { error: insErr } = await supabase
      .from("practice_logs")
      .insert(logRow);
    if (insErr) return { ok: false, error: insErr.message };
  }

  // 2. Replace player_notes for this plan. Delete-then-insert mirrors the
  // attendance pattern (see saveAttendance in actions.ts).
  const { error: delObsErr } = await supabase
    .from("player_notes")
    .delete()
    .eq("practice_plan_id", payload.plan_id);
  if (delObsErr) return { ok: false, error: delObsErr.message };
  const obsRows = payload.observations
    .map((o) => ({
      player_id: o.player_id,
      team_id: payload.team_id,
      practice_plan_id: payload.plan_id,
      note_text: o.note_text.trim(),
      created_by: user.id,
    }))
    .filter((o) => o.note_text.length > 0);
  if (obsRows.length > 0) {
    const { error: insObsErr } = await supabase
      .from("player_notes")
      .insert(obsRows);
    if (insObsErr) return { ok: false, error: insObsErr.message };
  }

  // 3. Patch per-drill log_note. Only update rows that actually have a
  // non-null log_note OR are flipping from a prior value to null/empty
  // (so the user can clear a note they wrote earlier).
  for (const d of payload.drills) {
    const trimmed = d.log_note?.trim() || null;
    const { error: updNoteErr } = await supabase
      .from("practice_plan_drills")
      .update({ log_note: trimmed })
      .eq("id", d.plan_drill_id);
    if (updNoteErr) return { ok: false, error: updNoteErr.message };
  }

  // 4. Mark the plan completed.
  const { error: planUpdErr } = await supabase
    .from("practice_plans")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", payload.plan_id);
  if (planUpdErr) return { ok: false, error: planUpdErr.message };

  // Team-scoped revalidation (Build 8 pt 2) — practice lives under
  // /dashboard/team/[teamId]/practice. payload.team_id is always present.
  const b = `/dashboard/team/${payload.team_id}/practice`;
  revalidatePath(b);
  revalidatePath(`${b}/${payload.plan_id}`);
  revalidatePath(`${b}/${payload.plan_id}/log`);
  return { ok: true };
}
