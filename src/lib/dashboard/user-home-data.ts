// User dashboard data fetch.
//
// Returns the user's leagues (where they're a league_admin) and their
// standalone teams (team_members rows where the team is NOT inside one
// of their leagues — per the de-duplication rule from §6.3 of the
// mobile onboarding doc).

import { createClient } from "@/lib/supabase/server";
import { teamColorHex } from "@/components/uff/team-colors";

// All returned `*_color` fields are HEX strings, ready to drop into
// CSS. The DB stores the 8-swatch id (`"blue"`, `"orange"`…) per the
// teams_team_color_chk / leagues_league_color_check constraints; the
// id→hex lookup happens here so page code never sees the raw id.
export type UserLeague = {
  id: string;
  league_name: string;
  league_color: string; // hex
  format: string;
  teams_count: number;
  members_count: number;
};

export type UserTeam = {
  id: string;
  team_name: string;
  team_color: string; // hex
  format: string;
  league_id: string | null;
  role: string;
  players_count: number;
};

export type UserHomeData = {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  leagues: UserLeague[];
  teams: UserTeam[]; // standalone only (or non-user-league teams)
};

export async function getUserHomeData(): Promise<UserHomeData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: leagueAdminRows }, { data: memberRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("league_members")
        .select(
          "league_id, role, leagues!inner(id, league_name, league_color, format)"
        )
        .eq("user_id", user.id)
        .eq("role", "league_admin"),
      supabase
        .from("team_members")
        .select(
          "team_id, role, teams!inner(id, team_name, team_color, format, league_id)"
        )
        .eq("user_id", user.id),
    ]);

  // Flatten leagues + collect their ids for de-dup.
  type EmbeddedLeague = {
    id: string;
    league_name: string;
    league_color: string;
    format: string;
  };
  const leagues: UserLeague[] = [];
  const leagueIds = new Set<string>();
  for (const row of leagueAdminRows ?? []) {
    const raw = row.leagues as EmbeddedLeague | EmbeddedLeague[] | null;
    const l = Array.isArray(raw) ? raw[0] ?? null : raw;
    if (!l) continue;
    if (leagueIds.has(l.id)) continue;
    leagueIds.add(l.id);
    leagues.push({
      id: l.id,
      league_name: l.league_name,
      league_color: teamColorHex(l.league_color),
      format: l.format,
      teams_count: 0, // filled below
      members_count: 0,
    });
  }

  // Fill per-league team + member counts (best-effort; missing perms = 0).
  await Promise.all(
    leagues.map(async (l) => {
      const [teamsRes, membersRes] = await Promise.all([
        supabase
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("league_id", l.id),
        supabase
          .from("league_members")
          .select("id", { count: "exact", head: true })
          .eq("league_id", l.id),
      ]);
      l.teams_count = teamsRes.count ?? 0;
      l.members_count = membersRes.count ?? 0;
    })
  );

  // Standalone teams = team_members rows whose team is NOT in one of
  // the user's leagues (and standalone teams with no league_id).
  type EmbeddedTeam = {
    id: string;
    team_name: string;
    team_color: string | null;
    format: string;
    league_id: string | null;
  };
  const teams: UserTeam[] = [];
  const seenTeamIds = new Set<string>();
  for (const row of memberRows ?? []) {
    const raw = row.teams as EmbeddedTeam | EmbeddedTeam[] | null;
    const t = Array.isArray(raw) ? raw[0] ?? null : raw;
    if (!t) continue;
    if (seenTeamIds.has(t.id)) continue;
    if (t.league_id && leagueIds.has(t.league_id)) continue; // hide league-owned teams
    seenTeamIds.add(t.id);
    teams.push({
      id: t.id,
      team_name: t.team_name,
      team_color: teamColorHex(t.team_color),
      format: t.format,
      league_id: t.league_id,
      role: row.role,
      players_count: 0,
    });
  }

  // Fill team player counts.
  await Promise.all(
    teams.map(async (t) => {
      const res = await supabase
        .from("team_players")
        .select("id", { count: "exact", head: true })
        .eq("team_id", t.id)
        .eq("status", "active");
      t.players_count = res.count ?? 0;
    })
  );

  // A user who is a captain-player on a team should read as "captain" here,
  // even when their app-access role is team_manager (a view-only captain).
  // Their captain identity lives on team_players.is_captain.
  if (teams.length > 0) {
    const { data: capRows } = await supabase
      .from("team_players")
      .select("team_id")
      .eq("user_id", user.id)
      .eq("is_captain", true)
      .in(
        "team_id",
        teams.map((t) => t.id)
      );
    const captainTeamIds = new Set(
      (capRows ?? []).map((r) => r.team_id as string)
    );
    for (const t of teams) {
      if (captainTeamIds.has(t.id)) t.role = "captain";
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
    },
    leagues,
    teams,
  };
}
