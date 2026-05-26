// /practice/[id]/edit — the practice editor (Build 5.5 marquee surface).

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTeams } from "@/lib/access/teams";
import { teamColorHex, playerColorForIndex } from "@/components/uff/team-colors";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { fetchPlanFull, fetchBlockTemplates } from "@/lib/practice/plan-data";
import EditorClient, {
  type DrillCatalogEntry,
  type RosterEntry,
  type EditorPlan,
} from "@/components/practice/EditorClient";
import { formatDateLabel } from "@/components/practice/atoms";

export const dynamic = "force-dynamic";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export default async function PracticeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await fetchPlanFull(supabase, id);
  if (!plan) notFound();

  const accessibleTeams = await getAccessibleTeams(supabase, user.id);
  if (!accessibleTeams.some((t) => t.id === plan.team_id)) notFound();

  const [{ data: team }, { data: profile }, { data: drills }, { data: cats }, { data: players }, blockTemplates] =
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
    ]);
  if (!team) notFound();

  const catNameById = new Map<string, string>();
  for (const c of cats ?? []) catNameById.set(c.id as string, c.category_name as string);

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
      />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={[
            { label: team.team_name as string, href: `/dashboard/team/${plan.team_id}` },
            { label: "Practice", href: "/practice" },
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
          />
        </div>
      </div>
    </div>
  );
}
