// /practice/generate — AI practice plan generator (Build 12).
//
// Mirrors the practice editor's shell exactly (TeamSidebar + DashTopBar +
// .page) so the generator feels native to the planner, not bolted on. Access
// mirrors the editor: a managing team member OR a league admin of the team's
// league. View-only users are bounced.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamAccess, canManageTeam } from "@/lib/access/teams";
import { teamColorHex } from "@/components/uff/team-colors";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { loadTeamFocus } from "@/lib/dashboard/team-home-data";
import type { SkillGroup } from "@/lib/types/skills";
import GenerateClient from "@/components/practice/generate/GenerateClient";

export const dynamic = "force-dynamic";

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Access gate — managing member or league admin only (same as the editor).
  const access = await getTeamAccess(supabase, user.id, teamId);
  if (!access) notFound();
  if (!canManageTeam(access)) notFound();

  const [{ data: profile }, { data: team }, focus] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("teams")
      .select("id, team_name, team_color, league_id")
      .eq("id", teamId)
      .maybeSingle(),
    loadTeamFocus(supabase, teamId),
  ]);
  if (!team) notFound();

  const teamColor = teamColorHex(team.team_color as string);
  const sidebarWorkspaces = await loadSidebarWorkspaces(
    teamId,
    (team.league_id as string | null) ?? null,
  );
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  return (
    <div className="uff-web">
      <TeamSidebar
        active="practice"
        teamId={teamId}
        teamColor={teamColor}
        teamName={team.team_name as string}
        leagueId={(team.league_id as string | null) ?? null}
        user={{
          firstName: profile?.first_name ?? user.email ?? "",
          lastName: profile?.last_name ?? "",
        }}
        workspaces={sidebarWorkspaces}
      />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={[
            { label: team.team_name as string, href: `/dashboard/team/${teamId}` },
            { label: "Practice", href: `/dashboard/team/${teamId}/practice` },
          ]}
          title="Generate plan"
          kicker="AI ASSIST"
          userInitials={initials}
          showSearch={false}
        />
        <div className="page" style={{ maxWidth: 1320, margin: "0 auto", width: "100%" }}>
          <GenerateClient
            data={{
              teamId,
              defaultMinutes: 90,
              defaultFormat: "7v7",
              availableSkills: focus.skills.map((s) => ({
                skillId: s.skillId,
                skillName: s.skillName,
                skillGroup: s.skillGroup as SkillGroup,
                avgScore: s.avgScore,
              })),
            }}
          />
        </div>
      </div>
    </div>
  );
}
