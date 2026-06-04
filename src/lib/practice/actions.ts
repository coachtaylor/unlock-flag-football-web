"use server";

// Server actions for Build 5.5 (practice block model). Saves go through
// the replace_practice_plan_blocks RPC mobile already ships — atomic
// three-arg replace (blocks + breaks) with cross-block parallel-group
// validation. See migration in mobile session 2026-05-22.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchPlanFull, DEFAULT_PLAN_TITLE } from "./plan-data";

// Build the team-scoped practice base path (Build 8 pt 2). Practice now lives
// under /dashboard/team/[teamId]/practice; every revalidate/redirect target is
// derived from teamId so navigating back shows the right team's data.
function planBase(teamId: string): string {
  return `/dashboard/team/${teamId}/practice`;
}

// Revalidate the team-scoped list + (optionally) a single plan's detail/edit
// paths. teamId is threaded from the caller (which always knows it); without it
// we can't scope, so we no-op rather than touch the retired flat `/practice`.
function revalidatePlan(teamId: string | null | undefined, planId?: string) {
  if (!teamId) return;
  const b = planBase(teamId);
  revalidatePath(b);
  if (planId) {
    revalidatePath(`${b}/${planId}`);
    revalidatePath(`${b}/${planId}/edit`);
  }
}

export type SaveBlockInput = {
  template_id?: string | null;
  name: string;
  block_order: number;
  target_minutes?: number | null;
  drills: SaveDrillInput[];
};

export type SaveDrillInput = {
  drill_id?: string | null;
  drill_order: number;
  duration_minutes: number;
  reps_count?: number | null;
  notes?: string | null;
  parallel_group?: number | null;
};

export type SaveBreakInput = {
  after_block_order: number;
  break_order: number;
  duration_minutes: number;
};

export type SavePlanPayload = {
  plan_id: string;
  title: string;
  practice_date: string;
  start_time: string | null;
  end_time: string | null;
  status: "draft" | "scheduled";
  blocks: SaveBlockInput[];
  breaks: SaveBreakInput[];
};

export async function savePlan(
  payload: SavePlanPayload,
  teamId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Patch the parent plan row (title/date/time/status).
  const { error: planErr } = await supabase
    .from("practice_plans")
    .update({
      title: payload.title,
      practice_date: payload.practice_date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      status: payload.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.plan_id);
  if (planErr) return { ok: false, error: planErr.message };

  // Atomic blocks + drills + breaks replace via RPC.
  const { error: rpcErr } = await supabase.rpc("replace_practice_plan_blocks", {
    p_plan_id: payload.plan_id,
    p_blocks: payload.blocks,
    p_breaks: payload.breaks,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  revalidatePlan(teamId, payload.plan_id);
  return { ok: true };
}

// NOTE: This helper intentionally does NOT call revalidatePath. It can be
// invoked from a server component render (e.g. /practice/new) where calling
// revalidatePath would throw under Next 16's stricter "no revalidation
// during render" rule. Each user-triggered wrapper below (newPlanAndRedirect,
// duplicatePlan, deletePlan, savePlan) handles its own revalidation.
export async function createPlanDraft(teamId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("practice_plans")
    .insert({
      team_id: teamId,
      created_by: user.id,
      practice_date: iso,
      title: DEFAULT_PLAN_TITLE,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create plan");
  return data.id as string;
}

export async function newPlanAndRedirect(formData: FormData) {
  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) throw new Error("Missing teamId");
  const id = await createPlanDraft(teamId);
  revalidatePath(planBase(teamId));
  redirect(`${planBase(teamId)}/${id}/edit`);
}

export async function duplicatePlan(planId: string): Promise<string> {
  // Carry blocks + drills + breaks; do NOT copy attendees. Per spec §5.5.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const source = await fetchPlanFull(supabase, planId);
  if (!source) throw new Error("Plan not found");

  const { data: newPlan, error } = await supabase
    .from("practice_plans")
    .insert({
      team_id: source.team_id,
      created_by: user.id,
      practice_date: new Date().toISOString().slice(0, 10),
      title: `${source.title} (copy)`,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !newPlan) throw new Error(error?.message ?? "Failed to duplicate");

  const blocks = source.blocks.map((b) => ({
    template_id: b.template_id,
    name: b.name,
    block_order: b.block_order,
    target_minutes: b.target_minutes,
    drills: b.drills.map((d) => ({
      drill_id: d.drill_id,
      drill_order: d.drill_order,
      duration_minutes: d.duration_minutes,
      reps_count: d.reps_count,
      notes: d.notes,
      parallel_group: d.parallel_group,
    })),
  }));
  const breaks = source.breaks.map((br) => ({
    after_block_order: br.after_block_order,
    break_order: br.break_order,
    duration_minutes: br.duration_minutes,
  }));

  const { error: rpcErr } = await supabase.rpc("replace_practice_plan_blocks", {
    p_plan_id: newPlan.id,
    p_blocks: blocks,
    p_breaks: breaks,
  });
  if (rpcErr) throw new Error(rpcErr.message);

  revalidatePlan(source.team_id);
  return newPlan.id as string;
}

export async function duplicatePlanAndRedirect(formData: FormData) {
  const planId = String(formData.get("planId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  if (!planId) throw new Error("Missing planId");
  const newId = await duplicatePlan(planId);
  redirect(teamId ? `${planBase(teamId)}/${newId}/edit` : `/practice/${newId}/edit`);
}

export async function deletePlan(planId: string, teamId?: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("practice_plans").delete().eq("id", planId);
  if (error) throw new Error(error.message);
  revalidatePlan(teamId);
}

// Archive = soft delete. Live/completed practices can't be hard-deleted, only
// archived (they keep their real status and drop out of the active lists).
export async function archivePlan(planId: string, teamId?: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("practice_plans")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) throw new Error(error.message);
  revalidatePlan(teamId, planId);
}

export async function unarchivePlan(planId: string, teamId?: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("practice_plans")
    .update({ archived_at: null })
    .eq("id", planId);
  if (error) throw new Error(error.message);
  revalidatePlan(teamId, planId);
}

export async function saveAttendance(
  planId: string,
  rows: { player_id: string; rsvp: boolean | null }[],
  teamId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  // Replace strategy: delete all rows then re-insert. The table has no
  // unique constraint on (plan_id, player_id) yet so upsert isn't safe.
  const { error: delErr } = await supabase
    .from("practice_plan_attendees")
    .delete()
    .eq("practice_plan_id", planId);
  if (delErr) return { ok: false, error: delErr.message };
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("practice_plan_attendees").insert(
      rows.map((r) => ({
        practice_plan_id: planId,
        player_id: r.player_id,
        rsvp: r.rsvp,
      })),
    );
    if (insErr) return { ok: false, error: insErr.message };
  }
  revalidatePlan(teamId, planId);
  return { ok: true };
}
