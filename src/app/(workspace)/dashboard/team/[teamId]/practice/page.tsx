// /dashboard/team/[teamId]/practice — list of plans, team-scoped (Build 8 pt 2).
//
// Reads teamId from the route (not the user's "first" team) so each team's
// planner is isolated. Access mirrors the roster/drills pages: a direct
// full-access member OR a league admin of the team's league. Renders the
// .uff-web shell with the team-context sidebar.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { memberCanManage } from "@/lib/team/staff-roles";
import { teamColorHex } from "@/components/uff/team-colors";
import { playerColorForIndex } from "@/components/uff/team-colors";
import { primarySide } from "@/lib/positions";
import { Icon } from "@/components/uff/icons";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { fetchPlanSummaries } from "@/lib/practice/plan-data";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import PracticeListClient from "./PracticeListClient";

export const dynamic = "force-dynamic";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default async function PracticeListPage({
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

  const [{ data: profile }, { data: team }, { data: membership }] =
    await Promise.all([
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
      supabase
        .from("team_members")
        .select("role, captain_view_only")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .maybeSingle(),
    ]);

  if (!team) notFound();

  // Access: direct member OR league_admin of the team's league.
  let canView = !!membership;
  let isLeagueAdmin = false;
  if (!canView && team.league_id) {
    const { data: leagueMember } = await supabase
      .from("league_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("league_id", team.league_id as string)
      .eq("role", "league_admin")
      .maybeSingle();
    isLeagueAdmin = !!leagueMember;
    canView = isLeagueAdmin;
  }
  if (!canView) notFound();

  const canManage =
    memberCanManage(
      membership?.role as string | null,
      membership?.captain_view_only as boolean | null,
    ) || isLeagueAdmin;

  const base = `/dashboard/team/${teamId}/practice`;

  const [plans, { data: players }] = await Promise.all([
    fetchPlanSummaries(supabase, teamId),
    supabase
      .from("team_players")
      .select("id, player_name, color_index, positions")
      .eq("team_id", teamId)
      .eq("status", "active"),
  ]);

  // Past-due is derived only — practices keep their real status so a stale
  // "live" practice stays live (and resumable). The detail-page
  // PastDueBanner branches on live vs scheduled for the right CTAs.

  // Map confirmed attendees per plan → list of avatar items, plus a
  // position breakdown (QB / Offense / Defense) of the same set.
  const rosterByPlan: Record<string, { initials: string; color: string }[]> = {};
  const breakdownByPlan: Record<string, { qb: number; off: number; def: number }> = {};
  if (plans.length > 0) {
    const planIds = plans.map((p) => p.id);
    const { data: attendees } = await supabase
      .from("practice_plan_attendees")
      .select("practice_plan_id, player_id, rsvp")
      .in("practice_plan_id", planIds)
      .eq("rsvp", true);

    const playerById = new Map<
      string,
      { initials: string; color: string; positions: string[] }
    >();
    for (const p of players ?? []) {
      playerById.set(p.id as string, {
        initials: initialsFor((p.player_name as string) ?? "?"),
        color: playerColorForIndex((p.color_index as number) ?? 0),
        positions: (p.positions as string[] | null) ?? [],
      });
    }
    for (const a of attendees ?? []) {
      const player = playerById.get(a.player_id as string);
      if (!player) continue;
      const k = a.practice_plan_id as string;
      const arr = rosterByPlan[k] ?? [];
      arr.push({ initials: player.initials, color: player.color });
      rosterByPlan[k] = arr;

      const bd = breakdownByPlan[k] ?? { qb: 0, off: 0, def: 0 };
      const side = primarySide(player.positions);
      if (side === "offense") bd.off += 1;
      else if (side === "defense") bd.def += 1;
      if (player.positions.includes("QB")) bd.qb += 1;
      breakdownByPlan[k] = bd;
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
  const sidebarWorkspaces = await loadSidebarWorkspaces(
    teamId,
    (team.league_id as string | null) ?? null,
  );
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
        workspaces={sidebarWorkspaces}
      />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={[{ label: team.team_name as string, href: `/dashboard/team/${teamId}` }]}
          title="Practice"
          kicker={kicker}
          userInitials={initials}
          showSearch={false}
          actions={
            canManage ? (
              <Link href={`${base}/new`} className="wbtn primary">
                <Icon.plus size={13} /> New plan
              </Link>
            ) : undefined
          }
        />
        <div className="page" style={{ maxWidth: 1320, margin: "0 auto", width: "100%" }}>
          <PracticeListClient
            teamId={teamId}
            base={base}
            teamName={team.team_name as string}
            canManage={canManage}
            plans={plans}
            rosterSize={(players ?? []).length}
            rosterByPlan={rosterByPlan}
            breakdownByPlan={breakdownByPlan}
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
