import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { teamColorHex } from "@/components/uff/team-colors";
import PlayerForm from "../../PlayerForm";

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
        .select("role")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .maybeSingle(),
      supabase
        .from("team_players")
        .select(
          "id, team_id, player_name, positions, jersey_number, notes, is_captain, is_injured, injury_note"
        )
        .eq("id", playerId)
        .maybeSingle(),
    ]);

  if (!team || !player) notFound();
  if (!membership) notFound();
  if (player.team_id !== teamId) notFound();

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
              playerName: (player.player_name as string) ?? "",
              positions: (player.positions as string[] | null) ?? [],
              jerseyNumber: (player.jersey_number as string | null) ?? "",
              notes: (player.notes as string | null) ?? "",
              isCaptain: (player.is_captain as boolean) ?? false,
              isInjured: (player.is_injured as boolean) ?? false,
              injuryNote: (player.injury_note as string | null) ?? "",
            }}
          />
        </div>
      </div>
    </div>
  );
}
