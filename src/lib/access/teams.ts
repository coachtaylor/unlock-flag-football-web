// Single source of truth for "which teams can this user touch?"
//
// A user can access a team if any of these hold:
//   • they have a row in team_members for that team (any role)
//   • they have a row in league_members with role='league_admin' for the
//     league that team belongs to
//
// Every team-scoped server route should call this instead of grabbing the
// user's first team_members row — that pattern silently 404s for users with
// multiple memberships (captain of one team, coach of another) and for
// league admins, since "first" is non-deterministic without an explicit
// order-by.

import type { SupabaseClient } from "@supabase/supabase-js";
import { memberCanManage } from "@/lib/team/staff-roles";

export type AccessibleTeam = {
  id: string;
  via: "team_member" | "league_admin";
  role: string | null;
  captainViewOnly: boolean;
  leagueId: string | null;
};

// Can this user mutate the team? League admins always can; direct members
// only with a full-access role — view-only team_managers AND view-only
// captains cannot. Mirrors get_my_writable_team_ids() (migration 90).
export function canManageTeam(t: AccessibleTeam | undefined | null): boolean {
  if (!t) return false;
  return t.via === "league_admin" || memberCanManage(t.role, t.captainViewOnly);
}

export async function getAccessibleTeams(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccessibleTeam[]> {
  const [{ data: memberships }, { data: adminLeagues }] = await Promise.all([
    supabase
      .from("team_members")
      .select("team_id, role, captain_view_only, teams!inner(id, league_id)")
      .eq("user_id", userId),
    supabase
      .from("league_members")
      .select("league_id")
      .eq("user_id", userId)
      .eq("role", "league_admin"),
  ]);

  const out = new Map<string, AccessibleTeam>();

  for (const row of memberships ?? []) {
    const team = row.teams as
      | { id: string; league_id: string | null }
      | { id: string; league_id: string | null }[]
      | null;
    const t = Array.isArray(team) ? team[0] ?? null : team;
    if (!t) continue;
    out.set(t.id, {
      id: t.id,
      via: "team_member",
      role: (row.role as string | null) ?? null,
      captainViewOnly: (row.captain_view_only as boolean | null) ?? false,
      leagueId: t.league_id,
    });
  }

  const adminLeagueIds = (adminLeagues ?? [])
    .map((r) => r.league_id as string | null)
    .filter((x): x is string => !!x);

  if (adminLeagueIds.length > 0) {
    const { data: leagueTeams } = await supabase
      .from("teams")
      .select("id, league_id")
      .in("league_id", adminLeagueIds);
    for (const t of leagueTeams ?? []) {
      const id = t.id as string;
      if (out.has(id)) continue; // direct membership already recorded
      out.set(id, {
        id,
        via: "league_admin",
        role: null,
        captainViewOnly: false,
        leagueId: (t.league_id as string | null) ?? null,
      });
    }
  }

  return Array.from(out.values());
}

export async function getAccessibleTeamIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  return (await getAccessibleTeams(supabase, userId)).map((t) => t.id);
}
