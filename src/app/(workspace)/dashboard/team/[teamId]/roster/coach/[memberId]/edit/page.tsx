// Coach edit — full-access-only form for a staff member's profile
// (Build 16.5c). View-only members are redirected back to the read-only
// detail page (RLS also rejects the write). Mirrors the player edit page.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { teamColorHex } from "@/components/uff/team-colors";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { memberCanManage } from "@/lib/team/staff-roles";
import { loadTeamStaffMember } from "@/lib/team/staff-detail";
import CoachForm from "../CoachForm";

export default async function CoachEditPage({
  params,
}: {
  params: Promise<{ teamId: string; memberId: string }>;
}) {
  const { teamId, memberId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: team }, { data: profile }, { data: membership }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, team_name, team_color, league_id")
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
    ]);

  if (!team) notFound();

  const rosterBase = `/dashboard/team/${teamId}/roster`;
  const coachBase = `${rosterBase}/coach/${memberId}`;

  const membershipRole = (membership?.role as string | null) ?? null;
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
      membershipRole,
      membership?.captain_view_only as boolean | null
    ) || isLeagueAdmin;
  // View-only (and non-members) can't edit — bounce to the read-only page.
  if (!canManage) redirect(coachBase);

  const coach = await loadTeamStaffMember(supabase, teamId, memberId);
  if (!coach) notFound();

  const teamColor = teamColorHex(team.team_color);
  const sidebarWorkspaces = await loadSidebarWorkspaces(teamId, team.league_id);
  const userInitials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

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
            { label: coach.name, href: coachBase },
          ]}
          title="Edit coach"
          showSearch={false}
          userInitials={userInitials}
        />

        <div className="page" style={{ maxWidth: 760, margin: "0 auto", width: "100%", paddingTop: 18 }}>
          <CoachForm
            teamId={teamId}
            coachBasePath={coachBase}
            initial={{
              memberId: coach.memberId,
              name: coach.name,
              role: coach.role,
              specialties: coach.specialties,
              yearsExperience: coach.yearsExperience,
              experienceDetail: coach.experienceDetail ?? "",
              certifications: coach.certifications,
              contactEmail: coach.contactEmail ?? "",
              contactPhone: coach.contactPhone ?? "",
            }}
          />
        </div>
      </div>
    </div>
  );
}
