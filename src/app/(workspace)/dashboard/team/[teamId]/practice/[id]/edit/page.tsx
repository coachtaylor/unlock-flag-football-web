// /practice/[id]/edit — the practice editor (Build 5.5 marquee surface).

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTeams } from "@/lib/access/teams";
import { teamColorHex, playerColorForIndex } from "@/components/uff/team-colors";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { fetchPlanFull, fetchBlockTemplates } from "@/lib/practice/plan-data";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { loadTeamFocus } from "@/lib/dashboard/team-home-data";
import EditorClient, {
  type DrillCatalogEntry,
  type RosterEntry,
  type EditorPlan,
  type ScoutingRecommendation,
} from "@/components/practice/EditorClient";
import type { SkillGroup } from "@/lib/types/skills";
import { formatDateLabel } from "@/components/practice/atoms";

export const dynamic = "force-dynamic";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export default async function PracticeEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; id: string }>;
  // From a scouting "Plan…" CTA — focusSkill expands the recommendations drawer
  // to a skill; fromScouting opens the drawer even with no specific skill.
  searchParams: Promise<{ focusSkill?: string; fromScouting?: string }>;
}) {
  const { teamId, id } = await params;
  const { focusSkill, fromScouting } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await fetchPlanFull(supabase, id);
  if (!plan) notFound();
  if (plan.team_id !== teamId) notFound();

  const accessibleTeams = await getAccessibleTeams(supabase, user.id);
  if (!accessibleTeams.some((t) => t.id === plan.team_id)) notFound();

  const [{ data: team }, { data: profile }, { data: drills }, { data: cats }, { data: players }, blockTemplates, teamFocus] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, team_name, team_color, league_id")
        .eq("id", plan.team_id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("team_drills")
        .select(
          "id, drill_name, category_id, benchmark_type, benchmark_types, description, default_duration_min, default_reps, status",
        )
        .eq("team_id", plan.team_id)
        .eq("status", "published")
        .order("drill_name", { ascending: true }),
      supabase.from("drill_categories").select("id, category_name"),
      supabase
        .from("team_players")
        .select("id, player_name, color_index, positions")
        .eq("team_id", plan.team_id)
        .eq("status", "active")
        .order("player_name", { ascending: true }),
      fetchBlockTemplates(supabase, plan.team_id),
      // Scouting recommendations for the editor's "Build from scouting" drawer —
      // SAME source as the scouting report (loadTeamFocus), so they can't drift.
      loadTeamFocus(supabase, plan.team_id),
    ]);
  if (!team) notFound();

  const catNameById = new Map<string, string>();
  for (const c of cats ?? []) catNameById.set(c.id as string, c.category_name as string);

  const recommendations: ScoutingRecommendation[] = teamFocus.skills.map((s) => ({
    skillId: s.skillId,
    skillName: s.skillName,
    skillGroup: s.skillGroup as SkillGroup,
    rank: s.rank,
    avgScore: s.avgScore,
    playersWithSignal: s.playersWithSignal,
    drills: s.drills.map((d) => ({ drillId: d.drillId, drillName: d.drillName })),
  }));

  // Focus skill (from a scouting "Plan <skill>" CTA): which of this team's drills
  // train it, plus its display name. Reuses the drill_skills inner-join scope
  // pattern from team-home-data. Only runs on the deep-linked path.
  let focusSkillName: string | null = null;
  const focusDrillIds = new Set<string>();
  if (focusSkill) {
    const [{ data: skillRow }, { data: drillSkillRows }] = await Promise.all([
      supabase.from("skills").select("skill_name").eq("id", focusSkill).maybeSingle(),
      supabase
        .from("drill_skills")
        .select("drill_id, team_drills!inner(team_id)")
        .eq("skill_id", focusSkill)
        .eq("team_drills.team_id", plan.team_id),
    ]);
    focusSkillName = (skillRow?.skill_name as string | null) ?? null;
    for (const r of drillSkillRows ?? []) focusDrillIds.add(r.drill_id as string);
  }

  // Hydrate each drill with its tagged player skills (same loader the drill
  // library + detail view use) so the picker can show + filter/sort by skill.
  const { loadDrillSkills } = await import("@/lib/drills/skills-data");
  const skillsByDrill = await loadDrillSkills(
    supabase,
    (drills ?? []).map((d) => d.id as string),
  );

  const drillCatalog: DrillCatalogEntry[] = (drills ?? []).map((d) => {
    const types = new Set<string>((d.benchmark_types as string[] | null) ?? []);
    if (d.benchmark_type) types.add(d.benchmark_type as string);
    return {
      id: d.id as string,
      name: d.drill_name as string,
      category_name: catNameById.get(d.category_id as string) ?? null,
      benchmark_types: Array.from(types),
      default_duration_min: (d.default_duration_min as number | null) ?? null,
      default_reps: (d.default_reps as number | null) ?? null,
      description: (d.description as string | null) ?? null,
      trainsFocus: focusDrillIds.has(d.id as string),
      skills: skillsByDrill[d.id as string] ?? [],
    };
  });

  const roster: RosterEntry[] = (players ?? []).map((p) => ({
    id: p.id as string,
    display_name: (p.player_name as string) ?? "Player",
    position: Array.isArray(p.positions) && p.positions.length > 0 ? (p.positions[0] as string) : null,
    initials: initialsFor((p.player_name as string) ?? "?"),
    color: playerColorForIndex((p.color_index as number) ?? 0),
  }));

  const teamColor = teamColorHex(team.team_color as string);
  const sidebarWorkspaces = await loadSidebarWorkspaces(
    plan.team_id,
    (team.league_id as string | null) ?? null,
  );
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  const editorPlan: EditorPlan = { ...plan, teamId: plan.team_id };

  return (
    <div className="uff-web">
      <TeamSidebar
        active="practice"
        teamId={plan.team_id}
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
            { label: team.team_name as string, href: `/dashboard/team/${plan.team_id}` },
            { label: "Practice", href: `/dashboard/team/${teamId}/practice` },
          ]}
          title="Edit plan"
          kicker={formatDateLabel(plan.practice_date).toUpperCase()}
          userInitials={initials}
          showSearch={false}
        />

        <div className="page" style={{ maxWidth: 1320, margin: "0 auto", width: "100%" }}>
          <EditorClient
            plan={editorPlan}
            drillCatalog={drillCatalog}
            blockTemplates={blockTemplates}
            roster={roster}
            recommendations={recommendations}
            focusSkillId={focusSkill ?? null}
            focusSkillName={focusSkillName}
            openRecommendations={Boolean(fromScouting)}
          />
        </div>
      </div>
    </div>
  );
}
