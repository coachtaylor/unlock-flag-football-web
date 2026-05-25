// League dashboard data fetch.

import { createClient } from "@/lib/supabase/server";

export type LeagueTeam = {
  id: string;
  team_name: string;
  team_color: string | null;
  format: string;
  players_count: number;
  coaches_count: number;
};

export type LeagueDashboardData = {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  league: {
    id: string;
    league_name: string;
    league_color: string;
    format: string;
    created_at: string;
    members_count: number;
  };
  teams: LeagueTeam[];
  isAdmin: boolean;
};

export async function getLeagueDashboardData(
  leagueId: string
): Promise<LeagueDashboardData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: league }, { data: adminRow }, membersRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("leagues")
        .select("id, league_name, league_color, format, created_at")
        .eq("id", leagueId)
        .maybeSingle(),
      supabase
        .from("league_members")
        .select("role")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .eq("role", "league_admin")
        .maybeSingle(),
      supabase
        .from("league_members")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId),
    ]);

  if (!league) return null;

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, team_name, team_color, format")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: true });

  const teams: LeagueTeam[] = [];
  for (const row of teamRows ?? []) {
    teams.push({
      id: row.id,
      team_name: row.team_name,
      team_color: row.team_color,
      format: row.format,
      players_count: 0,
      coaches_count: 0,
    });
  }

  await Promise.all(
    teams.map(async (t) => {
      const [playersRes, coachesRes] = await Promise.all([
        supabase
          .from("team_players")
          .select("id", { count: "exact", head: true })
          .eq("team_id", t.id)
          .eq("status", "active"),
        supabase
          .from("team_members")
          .select("id", { count: "exact", head: true })
          .eq("team_id", t.id)
          .eq("role", "coach"),
      ]);
      t.players_count = playersRes.count ?? 0;
      t.coaches_count = coachesRes.count ?? 0;
    })
  );

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
    },
    league: {
      id: league.id,
      league_name: league.league_name,
      league_color: league.league_color,
      format: league.format,
      created_at: league.created_at,
      members_count: membersRes.count ?? 0,
    },
    teams,
    isAdmin: !!adminRow,
  };
}
