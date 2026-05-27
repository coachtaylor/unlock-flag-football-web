"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Dashboard pin actions backed by the team_dashboard_pins table
// (migration 63_team_dashboard_pins.sql).
//
// Each row in team_dashboard_pins is one (drill, benchmark_type, position)
// slice. A single drill can be pinned multiple times with different types
// or position scopes. The 4-slot cap is enforced atomically inside the
// pin_dashboard_slice RPC. position = null means "all positions".
//
// Backward-compatible: togglePinDrill is preserved as a thin wrapper that
// pins/unpins the drill's primary benchmark type at team-wide scope. The
// PinButton single-click affordance still calls into it.

export type PinError = "pin_cap_reached" | "drill_not_found" | string;

export type AddPinResult =
  | { ok: true; pinId: string; pinnedCount: number }
  | { ok: false; error: PinError };

export type RemovePinResult =
  | { ok: true; pinnedCount: number }
  | { ok: false; error: PinError };

/** Pin one (drill, benchmark_type, position) slice. */
export async function addPin(args: {
  drillId: string;
  teamId: string;
  benchmarkType: string;
  position: string | null;
}): Promise<AddPinResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase.rpc("pin_dashboard_slice", {
    p_drill_id: args.drillId,
    p_benchmark_type: args.benchmarkType,
    p_position: args.position,
  });

  if (error) {
    // Postgres exception messages flow through .message; the RPC uses
    // explicit 'pin_cap_reached' / 'drill_not_found' tokens.
    const msg = error.message ?? "unknown";
    if (msg.includes("pin_cap_reached")) {
      return { ok: false, error: "pin_cap_reached" };
    }
    if (msg.includes("drill_not_found")) {
      return { ok: false, error: "drill_not_found" };
    }
    return { ok: false, error: msg };
  }

  // RPC returns one row: { pin_id, pinned_count }.
  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath(`/dashboard/team/${args.teamId}`);
  revalidatePath(`/drills/${args.drillId}`);
  return {
    ok: true,
    pinId: row?.pin_id ?? "",
    pinnedCount: row?.pinned_count ?? 0,
  };
}

/** Pin a "by-position" breakdown slice. One card on the dashboard, one
 *  row per position in `positions`. Counts as one slot regardless of N. */
export async function addBreakdownPin(args: {
  drillId: string;
  teamId: string;
  benchmarkType: string;
  positions: string[];
}): Promise<AddPinResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  if (!args.positions.length) {
    return { ok: false, error: "breakdown_requires_positions" };
  }

  const { data, error } = await supabase.rpc("pin_dashboard_breakdown_slice", {
    p_drill_id: args.drillId,
    p_benchmark_type: args.benchmarkType,
    p_positions: args.positions,
  });

  if (error) {
    const msg = error.message ?? "unknown";
    if (msg.includes("pin_cap_reached")) return { ok: false, error: "pin_cap_reached" };
    if (msg.includes("drill_not_found")) return { ok: false, error: "drill_not_found" };
    if (msg.includes("breakdown_requires_positions"))
      return { ok: false, error: "breakdown_requires_positions" };
    return { ok: false, error: msg };
  }

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath(`/dashboard/team/${args.teamId}`);
  revalidatePath(`/drills/${args.drillId}`);
  return {
    ok: true,
    pinId: row?.pin_id ?? "",
    pinnedCount: row?.pinned_count ?? 0,
  };
}

/** Delete one pin row by id. RLS limits to the user's team(s). */
export async function removePin(args: {
  pinId: string;
  teamId: string;
  drillId: string;
}): Promise<RemovePinResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("team_dashboard_pins")
    .delete()
    .eq("id", args.pinId)
    .eq("team_id", args.teamId);
  if (error) return { ok: false, error: error.message };

  const { count } = await supabase
    .from("team_dashboard_pins")
    .select("id", { count: "exact", head: true })
    .eq("team_id", args.teamId);

  revalidatePath(`/dashboard/team/${args.teamId}`);
  revalidatePath(`/drills/${args.drillId}`);
  return { ok: true, pinnedCount: count ?? 0 };
}

// ── Legacy compatibility ──────────────────────────────────────────────
//
// togglePinDrill is the Build 7 entry point that PinButton has been
// calling. We keep it as a wrapper so any unmigrated caller still works:
//   - pin = true: pins the drill's first benchmark_type at team-wide scope
//   - pin = false: removes ALL pins for that drill on this team
// The PinButton popover (Branch 2) uses addPin/removePin directly and
// should be preferred for new code.
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

  if (pinned) {
    // Look up the drill's primary benchmark_type for the legacy pin.
    const { data: drill } = await supabase
      .from("team_drills")
      .select("benchmark_types, benchmark_type")
      .eq("id", drillId)
      .eq("team_id", teamId)
      .maybeSingle();
    const arr = (drill?.benchmark_types as string[] | null) ?? null;
    const benchType = arr?.[0] ?? (drill?.benchmark_type as string | null) ?? null;
    if (!benchType) throw new Error("drill has no benchmark type to pin");

    const result = await addPin({
      drillId,
      teamId,
      benchmarkType: benchType,
      position: null,
    });
    if (!result.ok) throw new Error(result.error);
  } else {
    const { error } = await supabase
      .from("team_dashboard_pins")
      .delete()
      .eq("drill_id", drillId)
      .eq("team_id", teamId);
    if (error) throw error;
  }

  // Keep legacy column in sync for one deploy cycle so anything still
  // reading from team_drills.is_dashboard_pinned stays consistent.
  await supabase
    .from("team_drills")
    .update({
      is_dashboard_pinned: pinned,
      dashboard_pinned_at: pinned ? new Date().toISOString() : null,
    })
    .eq("id", drillId)
    .eq("team_id", teamId);

  revalidatePath(`/dashboard/team/${teamId}`);
  revalidatePath(`/drills/${drillId}`);
}
