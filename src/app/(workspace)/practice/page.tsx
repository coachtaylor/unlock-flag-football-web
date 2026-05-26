// /practice — list of plans for the user's primary team (Build 5.5).
// Renders the .uff-web shell with the team-context sidebar.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTeams } from "@/lib/access/teams";
import { teamColorHex } from "@/components/uff/team-colors";
import { playerColorForIndex } from "@/components/uff/team-colors";
import { Icon } from "@/components/uff/icons";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { fetchPlanSummaries } from "@/lib/practice/plan-data";
import PracticeListClient from "./PracticeListClient";

export const dynamic = "force-dynamic";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default async function PracticeListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const accessibleTeams = await getAccessibleTeams(supabase, user.id);
  if (accessibleTeams.length === 0) redirect("/onboarding/scope");

  // Pick a primary team (direct membership preferred). Per-team URL
  // scoping for practice is deferred to Build 8 polish; matches the
  // (workspace)/drills pattern.
  const primary =
    accessibleTeams.find((t) => t.via === "team_member") ?? accessibleTeams[0];
  const { data: team } = await supabase
    .from("teams")
    .select("id, team_name, team_color, league_id")
    .eq("id", primary.id)
    .maybeSingle();
  if (!team) redirect("/dashboard");
  const teamId = team.id as string;

  const [plans, { data: players }] = await Promise.all([
    fetchPlanSummaries(supabase, teamId),
    supabase
      .from("team_players")
      .select("id, player_name, color_index")
      .eq("team_id", teamId)
      .eq("status", "active"),
  ]);

  // Map confirmed attendees per plan → list of avatar items.
  let rosterByPlan: Record<string, { initials: string; color: string }[]> = {};
  if (plans.length > 0) {
    const planIds = plans.map((p) => p.id);
    const { data: attendees } = await supabase
      .from("practice_plan_attendees")
      .select("practice_plan_id, player_id, rsvp")
      .in("practice_plan_id", planIds)
      .eq("rsvp", true);

    const playerById = new Map<string, { initials: string; color: string }>();
    for (const p of players ?? []) {
      playerById.set(p.id as string, {
        initials: initialsFor((p.player_name as string) ?? "?"),
        color: playerColorForIndex((p.color_index as number) ?? 0),
      });
    }
    for (const a of attendees ?? []) {
      const player = playerById.get(a.player_id as string);
      if (!player) continue;
      const k = a.practice_plan_id as string;
      const arr = rosterByPlan[k] ?? [];
      arr.push(player);
      rosterByPlan[k] = arr;
    }
  }

  // Stats — derived from completed plans only.
  // fetchPlanSummaries returns plans ordered by practice_date desc, so
  // completedPlans[0] is the most recent completed practice.
  const completedPlans = plans.filter((p) => p.status === "completed");
  const lastN = Math.min(completedPlans.length, 8);
  const recent = completedPlans.slice(0, lastN);
  const rosterSize = (players ?? []).length;
  const lastPracticeAttendPct =
    completedPlans.length > 0 && rosterSize > 0
      ? Math.round((completedPlans[0].rsvp_in / rosterSize) * 100)
      : 0;
  const overallAttendPct =
    completedPlans.length > 0 && rosterSize > 0
      ? Math.round(
          (completedPlans.reduce((a, p) => a + p.rsvp_in, 0) / (completedPlans.length * rosterSize)) * 100,
        )
      : 0;
  const fieldMin =
    recent.length > 0
      ? Math.round(recent.reduce((a, p) => a + p.total_minutes, 0) / recent.length)
      : 0;
  const avgDrills =
    recent.length > 0
      ? Number((recent.reduce((a, p) => a + p.drill_count, 0) / recent.length).toFixed(1))
      : 0;

  const teamColor = teamColorHex(team.team_color as string);
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  const scheduled = plans.filter((p) => p.status === "scheduled" || p.status === "live").length;
  const draftCount = plans.filter((p) => p.status === "draft").length;
  const kickerParts: string[] = [];
  if (scheduled) kickerParts.push(`${scheduled} scheduled`);
  if (draftCount) kickerParts.push(`${draftCount} draft`);
  const kicker = kickerParts.join(" · ") || "Empty planner";

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
      />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={[{ label: team.team_name as string, href: `/dashboard/team/${teamId}` }]}
          title="Practice"
          kicker={kicker}
          userInitials={initials}
          showSearch={false}
          actions={
            <Link href="/practice/new" className="wbtn primary">
              <Icon.plus size={13} /> New plan
            </Link>
          }
        />
        <div className="page" style={{ maxWidth: 1320, margin: "0 auto", width: "100%" }}>
          <PracticeListClient
            teamId={teamId}
            teamName={team.team_name as string}
            plans={plans}
            rosterSize={(players ?? []).length}
            rosterByPlan={rosterByPlan}
            stats={{
              practices: lastN,
              totalCompleted: completedPlans.length,
              lastPracticeAttendPct,
              overallAttendPct,
              fieldMin,
              avgDrills,
            }}
          />
        </div>
      </div>
    </div>
  );
}
