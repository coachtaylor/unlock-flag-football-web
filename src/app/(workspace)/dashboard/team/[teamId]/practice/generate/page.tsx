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
import { loadAllSkills } from "@/lib/drills/skills-data";
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

  const [{ data: profile }, { data: team }, catalog, { data: focusRows }] = await Promise.all([
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
    // Full skill taxonomy — the coach can target ANY skill, not just weaknesses.
    loadAllSkills(supabase),
    // Measured team scores (weakest first) drive the "Suggested" highlights.
    supabase
      .from("v_team_skill_focus")
      .select("skill_id, avg_score")
      .eq("team_id", teamId)
      .order("avg_score", { ascending: true }),
  ]);
  if (!team) notFound();

  // Merge: every skill from the taxonomy, scored where the team has signal.
  // The weakest three measured skills are flagged as suggestions in the wizard.
  const scoreById = new Map<string, number>(
    (focusRows ?? []).map((r) => [r.skill_id as string, Number(r.avg_score)]),
  );
  const suggestedSkillIds = (focusRows ?? []).slice(0, 3).map((r) => r.skill_id as string);
  const availableSkills = catalog.skills.map((s) => ({
    skillId: s.id,
    skillName: s.skill_name,
    skillGroup: s.skill_group,
    avgScore: scoreById.get(s.id) ?? null,
    description: s.description ?? null,
  }));

  const teamColor = teamColorHex(team.team_color as string);
  const sidebarWorkspaces = await loadSidebarWorkspaces(
    teamId,
    (team.league_id as string | null) ?? null,
  );
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  // Default the plan to the upcoming Sunday (today if it's already Sunday).
  const nextSunday = new Date();
  nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7));
  const defaultDate = nextSunday.toISOString().slice(0, 10);

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
              defaultMinutes: 120,
              defaultFormat: "7v7",
              defaultTitle: "Practice",
              defaultDate,
              availableSkills,
              suggestedSkillIds,
            }}
          />
        </div>
      </div>
    </div>
  );
}
