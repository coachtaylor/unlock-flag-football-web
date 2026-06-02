// Coaching-staff role taxonomy — the single source of truth for the
// team_members staff roles introduced in Build 16.5. Used by the roster
// coaching-staff table and (Build 16.5b) the invite UI + settings, so a
// role reads identically wherever it appears.
//
// Mirrors the DB CHECK from migration 78. team_members.role can also hold
// 'captain' (player-leaders, rendered in the PLAYERS table, not here) and
// the legacy values 'coach'/'assistant' (backfilled away by migration 78,
// kept valid for safety). Access tiers match get_my_writable_team_ids()
// in migration 79: head_coach / assistant_coach / captain (+ legacy coach)
// can write; team_manager is view-only.

export type StaffRole = "head_coach" | "assistant_coach" | "team_manager";
export type MemberRole = StaffRole | "captain" | "coach" | "assistant";

export const STAFF_ROLES: StaffRole[] = [
  "head_coach",
  "assistant_coach",
  "team_manager",
];

// Roles that may mutate team data. Keep in lockstep with
// get_my_writable_team_ids() (migration 79).
const FULL_ACCESS_ROLES: MemberRole[] = [
  "head_coach",
  "assistant_coach",
  "captain",
  "coach",
];

export function isFullAccess(role: string | null | undefined): boolean {
  return !!role && (FULL_ACCESS_ROLES as string[]).includes(role);
}

export type AccessTier = "full" | "view";

export type StaffRoleMeta = {
  id: StaffRole;
  /** Base label; head_coach uses headCoachLabel() when >1 exist. */
  label: string;
  access: AccessTier;
  accessLabel: string;
  /** Short description for invite pickers. */
  hint: string;
  /** UFF accent color (CSS var) used for the role's dot/chip. */
  color: string;
};

export const STAFF_ROLE_META: Record<StaffRole, StaffRoleMeta> = {
  head_coach: {
    id: "head_coach",
    label: "Head coach",
    access: "full",
    accessLabel: "Full access",
    hint: "Runs the team. Full access to everything.",
    color: "var(--uff-orange)",
  },
  assistant_coach: {
    id: "assistant_coach",
    label: "Assistant coach",
    access: "full",
    accessLabel: "Full access",
    hint: "Helps run sessions. Full access. Optional offense/defense focus.",
    color: "var(--uff-blue, #5BA8FF)",
  },
  team_manager: {
    id: "team_manager",
    label: "Team manager",
    access: "view",
    accessLabel: "View only",
    hint: "Trainer or manager. Can see everything, can't make changes.",
    color: "var(--uff-text-mute)",
  },
};

// When a team has more than one head coach, each is a "co-head coach".
export function headCoachLabel(headCount: number): string {
  return headCount > 1 ? "Co-head coach" : "Head coach";
}

// Resolve the display label for a staff role given how many head coaches
// exist on the team (so head_coach can flip to "Co-head coach").
export function staffRoleLabel(role: StaffRole, headCount: number): string {
  if (role === "head_coach") return headCoachLabel(headCount);
  return STAFF_ROLE_META[role].label;
}

export const SPECIALTY_LABELS: Record<string, string> = {
  offense: "Offense",
  defense: "Defense",
};

export function specialtyLabel(s: string): string {
  return SPECIALTY_LABELS[s] ?? s;
}

// ── Invite roles ──────────────────────────────────────────────────────
// Invites can grant any staff role OR captain (a player-leader added to the
// roster). One source of truth for the invite picker + the pending list.

export type InviteRole = StaffRole | "captain";

export const INVITE_ROLES: InviteRole[] = [...STAFF_ROLES, "captain"];

const CAPTAIN_INVITE_META = {
  label: "Captain",
  accessLabel: "Full access",
  access: "full" as AccessTier,
  hint: "Player-leader. Full access; also added to the roster as a player.",
};

export function inviteRoleLabel(role: InviteRole): string {
  return role === "captain" ? CAPTAIN_INVITE_META.label : STAFF_ROLE_META[role].label;
}

export function inviteRoleAccess(role: InviteRole): AccessTier {
  return role === "captain" ? CAPTAIN_INVITE_META.access : STAFF_ROLE_META[role].access;
}

export function inviteRoleAccessLabel(role: InviteRole): string {
  return role === "captain"
    ? CAPTAIN_INVITE_META.accessLabel
    : STAFF_ROLE_META[role].accessLabel;
}

export function inviteRoleHint(role: InviteRole): string {
  return role === "captain" ? CAPTAIN_INVITE_META.hint : STAFF_ROLE_META[role].hint;
}
