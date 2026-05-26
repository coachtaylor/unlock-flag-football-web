// Sidebar workspaces fetch for the team-context sidebar.
//
// Returns every other workspace the current user has access to, so the
// "Workspaces" nav section in TeamSidebar can list real names instead of
// a generic "Back to league" link:
//   • The current team's parent league (if any) — labeled with the
//     actual league name.
//   • Other leagues the user is an admin of.
//   • Other teams the user is a member of (deduped against league teams).
//
// All `color` fields come back as HEX (resolved via teamColorHex) so the
// sidebar can drop them straight into CSS without re-resolving.
//
// Mirrors the de-dup rule from getUserHomeData(): a team that belongs to
// one of the user's admin'd leagues is hidden as a standalone item —
// users navigate to it through the league instead.
//
// Self-fetching keeps the 14 TeamSidebar caller sites untouched.

import { createClient } from "@/lib/supabase/server";
import { teamColorHex } from "@/components/uff/team-colors";

export type SidebarWorkspace = {
  id: string;
  kind: "league" | "team";
  name: string;
  color: string; // hex
  isCurrentLeague?: boolean; // parent league of the current team
};

export async function loadSidebarWorkspaces(
  currentTeamId: string,
  currentLeagueId: string | null,
): Promise<SidebarWorkspace[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [leagueAdminRows, memberRows, currentLeagueRow] = await Promise.all([
    supabase
      .from("league_members")
      .select("league_id, leagues!inner(id, league_name, league_color)")
      .eq("user_id", user.id)
      .eq("role", "league_admin"),
    supabase
      .from("team_members")
      .select("team_id, teams!inner(id, team_name, team_color, league_id)")
      .eq("user_id", user.id),
    currentLeagueId
      ? supabase
          .from("leagues")
          .select("id, league_name, league_color")
          .eq("id", currentLeagueId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  type EmbeddedLeague = {
    id: string;
    league_name: string;
    league_color: string | null;
  };
  type EmbeddedTeam = {
    id: string;
    team_name: string;
    team_color: string | null;
    league_id: string | null;
  };

  const seenLeagueIds = new Set<string>();
  const out: SidebarWorkspace[] = [];

  // 1. Current team's parent league always appears first, even if the
  //    user isn't a league_admin (they may just be a team member). We
  //    fetch it separately so the link works regardless of role.
  const parentLeague =
    (currentLeagueRow as { data?: EmbeddedLeague | null })?.data ?? null;
  if (parentLeague) {
    seenLeagueIds.add(parentLeague.id);
    out.push({
      id: parentLeague.id,
      kind: "league",
      name: parentLeague.league_name,
      color: teamColorHex(parentLeague.league_color),
      isCurrentLeague: true,
    });
  }

  // 2. Other leagues the user admins.
  for (const row of leagueAdminRows.data ?? []) {
    const raw = row.leagues as EmbeddedLeague | EmbeddedLeague[] | null;
    const l = Array.isArray(raw) ? raw[0] ?? null : raw;
    if (!l) continue;
    if (seenLeagueIds.has(l.id)) continue;
    seenLeagueIds.add(l.id);
    out.push({
      id: l.id,
      kind: "league",
      name: l.league_name,
      color: teamColorHex(l.league_color),
    });
  }

  // 3. Other teams the user is on (skip current team + teams inside any
  //    league we've already surfaced so the same workspace isn't shown
  //    twice).
  const seenTeamIds = new Set<string>([currentTeamId]);
  for (const row of memberRows.data ?? []) {
    const raw = row.teams as EmbeddedTeam | EmbeddedTeam[] | null;
    const t = Array.isArray(raw) ? raw[0] ?? null : raw;
    if (!t) continue;
    if (seenTeamIds.has(t.id)) continue;
    if (t.league_id && seenLeagueIds.has(t.league_id)) continue;
    seenTeamIds.add(t.id);
    out.push({
      id: t.id,
      kind: "team",
      name: t.team_name,
      color: teamColorHex(t.team_color),
    });
  }

  return out;
}
