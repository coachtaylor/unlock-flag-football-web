// /practice/[id]/log — Post-practice log (Build 6.5a).
//
// Server gate + load. Fetches the plan (for the drill list + RSVP), any
// existing practice_logs row (for re-edits), and the observations feed
// (player_notes for this plan) so the client form can prefill.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTeams } from "@/lib/access/teams";
import { teamColorHex, playerColorForIndex } from "@/components/uff/team-colors";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { fetchPlanFull } from "@/lib/practice/plan-data";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { formatDateLabel } from "@/components/practice/atoms";
import { blockColor } from "@/lib/practice/block-colors";
import PostPracticeLogClient, {
  type LogPlayer,
  type LogDrill,
  type LogObservation,
  type LogInitial,
} from "./PostPracticeLogClient";

export const dynamic = "force-dynamic";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export default async function PostPracticeLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  // Drafts can't be logged — they're unfinished plans, and logging
  // would persist a "completed" status against an un-finalized roster
  // of blocks/drills. Bounce back to the detail page with a notice the
  // page surfaces inline.
  if (plan.status === "draft") {
    redirect(`/practice/${id}?blocked=draft`);
  }

  const [
    { data: team },
    { data: players },
    { data: profile },
    { data: existingLog },
    { data: existingObservations },
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, team_name, team_color, league_id")
      .eq("id", plan.team_id)
      .maybeSingle(),
    supabase
      .from("team_players")
      .select("id, player_name, color_index, jersey_number, positions, is_injured")
      .eq("team_id", plan.team_id)
      .eq("status", "active")
      .order("player_name"),
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("practice_logs")
      .select(
        "drills_completed, drills_skipped, team_performance_notes, highlights, areas_to_improve, attendance_count, energy_level",
      )
      .eq("practice_plan_id", id)
      .maybeSingle(),
    supabase
      .from("player_notes")
      .select("player_id, note_text")
      .eq("practice_plan_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!team) notFound();

  // Flat list of all non-water-break drills across all blocks, with each
  // drill carrying its block name + color for the visual grouping. The
  // post-practice log treats the plan as a linear checklist — block
  // boundaries are visual cues only.
  const drills: LogDrill[] = [];
  for (const b of plan.blocks) {
    const c = blockColor(b.name);
    for (const d of b.drills) {
      if (d.is_water_break) continue;
      drills.push({
        planDrillId: d.id,
        drillName: d.drill_name ?? "Drill",
        blockName: b.name,
        blockAccent: c.accent,
        existingLogNote: d.log_note ?? null,
      });
    }
  }

  const completedSet = new Set<string>(
    ((existingLog?.drills_completed as string[] | null) ?? []),
  );
  const skippedSet = new Set<string>(
    ((existingLog?.drills_skipped as string[] | null) ?? []),
  );

  // If no log exists yet, default every drill to "completed". Captains can
  // toggle individual ones to "skipped" — the common case post-practice
  // is "we did everything except X".
  const isFreshLog = !existingLog;

  const drillInitial = drills.map((d) => {
    const completed = isFreshLog
      ? true
      : completedSet.has(d.planDrillId);
    const skipped = isFreshLog ? false : skippedSet.has(d.planDrillId);
    return {
      planDrillId: d.planDrillId,
      completed,
      skipped,
      logNote: d.existingLogNote ?? "",
    };
  });

  const roster: LogPlayer[] = (players ?? []).map((p) => ({
    id: p.id as string,
    name: (p.player_name as string) ?? "Player",
    position:
      Array.isArray(p.positions) && p.positions.length > 0 ? (p.positions[0] as string) : null,
    initials: initialsFor((p.player_name as string) ?? "?"),
    color: playerColorForIndex((p.color_index as number) ?? 0),
    isInjured: !!p.is_injured,
  }));

  const observationInitial: LogObservation[] = (existingObservations ?? []).map(
    (o) => ({
      player_id: o.player_id as string,
      note_text: (o.note_text as string) ?? "",
    }),
  );

  // Default attendance_count: prior log value if present, else the count
  // of RSVP=true (intent), else 0. Coaches can edit.
  const rsvpInCount = plan.attendees.filter((a) => a.rsvp === true).length;
  const attendanceDefault =
    (existingLog?.attendance_count as number | null) ?? rsvpInCount;

  const initial: LogInitial = {
    drills: drillInitial,
    observations: observationInitial,
    teamPerformanceNotes:
      (existingLog?.team_performance_notes as string | null) ?? "",
    highlights: (existingLog?.highlights as string | null) ?? "",
    areasToImprove: (existingLog?.areas_to_improve as string | null) ?? "",
    attendanceCount: attendanceDefault,
    energyLevel: (existingLog?.energy_level as number | null) ?? null,
    alreadyLogged: !!existingLog,
  };

  const teamColor = teamColorHex(team.team_color as string);
  const sidebarWorkspaces = await loadSidebarWorkspaces(
    plan.team_id,
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
            { label: "Practice", href: "/practice" },
            { label: plan.title || "Plan", href: `/practice/${plan.id}` },
          ]}
          title="Log practice"
          kicker={formatDateLabel(plan.practice_date).toUpperCase()}
          userInitials={initials}
          showSearch={false}
        />

        <PostPracticeLogClient
          planId={plan.id}
          teamId={plan.team_id}
          planTitle={plan.title}
          dateLabel={formatDateLabel(plan.practice_date)}
          drills={drills}
          roster={roster}
          initial={initial}
        />
      </div>
    </div>
  );
}
