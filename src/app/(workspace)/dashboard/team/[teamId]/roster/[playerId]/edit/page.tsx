import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { teamColorHex } from "@/components/uff/team-colors";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import PlayerForm from "../../PlayerForm";
import { splitName } from "@/lib/format/name";
import { memberCanManage } from "@/lib/team/staff-roles";

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ teamId: string; playerId: string }>;
}) {
  const { teamId, playerId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resilient to schema drift: if migration 101 (photo_url/height_in/weight_lb)
  // hasn't been applied, retry without those columns so Edit still opens.
  const PLAYER_BASE =
    "id, team_id, player_name, first_name, last_name, positions, jersey_number, notes, is_captain, captain_access, user_id";
  const fetchPlayerRow = async () => {
    const full = await supabase
      .from("team_players")
      .select(`${PLAYER_BASE}, photo_url, height_in, weight_lb`)
      .eq("id", playerId)
      .maybeSingle();
    if (!full.error) return { data: full.data };
    const base = await supabase
      .from("team_players")
      .select(PLAYER_BASE)
      .eq("id", playerId)
      .maybeSingle();
    return { data: base.data };
  };

  const [{ data: team }, { data: profile }, { data: membership }, { data: player }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, team_name, format, team_color, league_id")
        .eq("id", teamId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("team_members")
        .select("role, captain_view_only")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .maybeSingle(),
      fetchPlayerRow(),
    ]);

  if (!team || !player) notFound();
  if (player.team_id !== teamId) notFound();

  // Access: a direct full-access member OR a league admin of the team's
  // league. Mirrors the player detail + roster pages — those fall back to
  // league_admin, so the edit page must too (otherwise a league admin can
  // open the roster + player but 404s on edit).
  let isLeagueAdmin = false;
  if (!membership && team.league_id) {
    const { data: leagueMember } = await supabase
      .from("league_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("league_id", team.league_id)
      .eq("role", "league_admin")
      .maybeSingle();
    isLeagueAdmin = !!leagueMember;
  }
  const canManage =
    memberCanManage(
      membership?.role as string | null,
      membership?.captain_view_only as boolean | null
    ) || isLeagueAdmin;
  // Non-members and view-only members (managers / view-only captains) can't
  // edit — bounce to the read-only detail page.
  if (!canManage) {
    redirect(`/dashboard/team/${teamId}/roster/${playerId}`);
  }

  const sidebarWorkspaces = await loadSidebarWorkspaces(teamId, team.league_id);
  const teamColor = teamColorHex(team.team_color);
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  const rosterBase = `/dashboard/team/${teamId}/roster`;

  return (
    <div className="uff-web">
      <TeamSidebar
        active="roster"
        teamId={teamId}
        teamColor={teamColor}
        teamName={team.team_name}
        leagueId={team.league_id}
        user={{
          firstName: profile?.first_name ?? user.email ?? "",
          lastName: profile?.last_name ?? "",
        }}
        workspaces={sidebarWorkspaces}
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={[
            { label: team.team_name, href: `/dashboard/team/${teamId}` },
            { label: "Roster", href: rosterBase },
            {
              label: player.player_name as string,
              href: `${rosterBase}/${playerId}`,
            },
          ]}
          title="Edit player"
          status="DRAFT"
          showSearch={false}
          userInitials={initials}
        />

        <div
          className="page"
          style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}
        >
          <PlayerForm
            teamId={teamId}
            rosterBasePath={rosterBase}
            initial={{
              id: player.id as string,
              // Prefer the structured columns; fall back to splitting the
              // display name for rows that predate the split or were created
              // by an RPC (first/last null).
              firstName:
                (player.first_name as string | null) ??
                splitName(player.player_name as string | null).first,
              lastName:
                (player.last_name as string | null) ??
                splitName(player.player_name as string | null).last,
              positions: (player.positions as string[] | null) ?? [],
              jerseyNumber: (player.jersey_number as string | null) ?? "",
              notes: (player.notes as string | null) ?? "",
              isCaptain: (player.is_captain as boolean) ?? false,
              captainAccess:
                (player.captain_access as "full" | "view" | "none" | null) ?? null,
              photoUrl: (player as { photo_url?: string | null }).photo_url ?? null,
              heightIn: (player as { height_in?: number | null }).height_in ?? null,
              weightLb: (player as { weight_lb?: number | null }).weight_lb ?? null,
              accountLinked: !!(player.user_id as string | null),
            }}
          />
        </div>
      </div>
    </div>
  );
}
