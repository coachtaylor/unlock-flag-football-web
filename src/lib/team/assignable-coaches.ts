// Assignable-coaches data layer — the people who can be assigned to lead a
// practice drill. Single source of truth for the practice detail page and the
// plan editor. Sourced from the get_team_assignable_coaches RPC (migration 95,
// reshaped in 96).
//
// Two sources, unioned by the RPC:
//   • staff   → team_members (head/assistant coach, manager, …). id = member id.
//   • captain → team_players where is_captain (account OR name-only). id =
//               player id — so a name-only co-captain still shows up.
// A drill assignment stores EITHER assigned_member_id (staff) OR
// assigned_player_id (captain). Use coachAssignmentColumns() to map a chosen
// coach to those columns, selectedCoachKey() to find the current pick.
//
// Mirror of mobile lib/team/assignable-coaches.ts — keep the two in sync.

import type { SupabaseClient } from "@supabase/supabase-js";
import { initialsFor } from "@/lib/format/initials";
import { playerColorForIndex } from "@/components/uff/team-colors";
import { STAFF_ROLE_META, STAFF_ROLES } from "@/lib/team/staff-roles";

export type CoachKind = "staff" | "captain";

export type AssignableCoach = {
  kind: CoachKind;
  // team_members.id for staff, team_players.id for captains.
  id: string;
  key: string;
  userId: string | null;
  role: string;
  name: string;
  initials: string;
  isCaptain: boolean;
  colorIndex: number | null;
  // Avatar color: captains use their roster swatch; staff use a role color.
  color: string;
  // Short role label for the picker ("Head coach", "Captain", …).
  roleLabel: string;
};

export type AssignableCoachRow = {
  id: string;
  kind: string;
  user_id: string | null;
  role: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  is_captain: boolean | null;
  color_index: number | null;
};

// Generic underscore → Title Case so any role reads correctly without a
// lookup table: "head_coach" → "Head Coach". Mirrors mobile memberRoleLabel.
function memberRoleLabel(role: string | null | undefined): string {
  if (!role) return "Member";
  return role
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function staffRoleColor(role: string): string {
  if ((STAFF_ROLES as string[]).includes(role)) {
    return STAFF_ROLE_META[role as keyof typeof STAFF_ROLE_META].color;
  }
  // Legacy 'coach'/'assistant' or anything else → orange.
  return "var(--uff-orange)";
}

export function coachKey(kind: CoachKind, id: string): string {
  return `${kind}:${id}`;
}

// The selection key for a drill row given its two assignment columns.
export function selectedCoachKey(
  assignedMemberId: string | null | undefined,
  assignedPlayerId: string | null | undefined,
): string | null {
  if (assignedMemberId) return coachKey("staff", assignedMemberId);
  if (assignedPlayerId) return coachKey("captain", assignedPlayerId);
  return null;
}

// Map a chosen coach (or null to clear) to the two DB columns.
export function coachAssignmentColumns(coach: AssignableCoach | null): {
  assigned_member_id: string | null;
  assigned_player_id: string | null;
} {
  if (!coach) return { assigned_member_id: null, assigned_player_id: null };
  return coach.kind === "captain"
    ? { assigned_member_id: null, assigned_player_id: coach.id }
    : { assigned_member_id: coach.id, assigned_player_id: null };
}

export function shapeAssignableCoach(row: AssignableCoachRow): AssignableCoach {
  const kind: CoachKind = row.kind === "captain" ? "captain" : "staff";
  const isCaptain = kind === "captain" || row.is_captain === true;
  const name = (row.name ?? "").trim() || (isCaptain ? "Captain" : "Coach");
  return {
    kind,
    id: row.id,
    key: coachKey(kind, row.id),
    userId: row.user_id,
    role: row.role,
    name,
    initials: initialsFor(name),
    isCaptain,
    colorIndex: row.color_index,
    color: isCaptain ? playerColorForIndex(row.color_index) : staffRoleColor(row.role),
    roleLabel: isCaptain ? "Captain" : memberRoleLabel(row.role),
  };
}

export async function loadAssignableCoaches(
  supabase: SupabaseClient,
  teamId: string,
): Promise<AssignableCoach[]> {
  const { data, error } = await supabase.rpc("get_team_assignable_coaches", {
    p_team_id: teamId,
  });
  if (error) {
    console.warn("[assignable-coaches] load error", error.message);
    return [];
  }
  return ((data ?? []) as AssignableCoachRow[]).map(shapeAssignableCoach);
}
