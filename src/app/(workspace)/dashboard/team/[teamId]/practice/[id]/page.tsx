// /practice/[id] — read-only view of a single plan (Build 5.5).

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTeams, canManageTeam } from "@/lib/access/teams";
import { teamColorHex, playerColorForIndex } from "@/components/uff/team-colors";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { fetchPlanFull, interleavePlan, planTotals } from "@/lib/practice/plan-data";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { resolveActorNames } from "@/lib/activity";
import Byline from "@/components/activity/Byline";
import EntityHistory from "@/components/activity/EntityHistory";
import {
  PracticeStatusPill,
  BudgetBar,
  MiniStat,
  PIcon,
  formatDateLabel,
  formatTimeLabel,
} from "@/components/practice/atoms";
import { BlockReadCard, BreakReadRow } from "@/components/practice/BlockReadCard";
import ManageAttendanceCard, { type RsvpPlayer } from "@/components/practice/ManageAttendanceCard";
import PastDueBanner, { isPlanPastDue } from "@/components/practice/PastDueBanner";
import PlanLifecycleActions from "@/components/practice/PlanLifecycleActions";
import { blockColor } from "@/lib/practice/block-colors";
import { duplicatePlanAndRedirect } from "@/lib/practice/actions";

export const dynamic = "force-dynamic";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export default async function PracticeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; id: string }>;
  searchParams: Promise<{ blocked?: string }>;
}) {
  const { teamId, id } = await params;
  const { blocked } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await fetchPlanFull(supabase, id);
  if (!plan) notFound();
  // Guard against a plan opened under the wrong team's URL.
  if (plan.team_id !== teamId) notFound();

  const accessibleTeams = await getAccessibleTeams(supabase, user.id);
  if (!accessibleTeams.some((t) => t.id === plan.team_id)) notFound();
  const canManage = canManageTeam(
    accessibleTeams.find((t) => t.id === plan.team_id),
  );

  const base = `/dashboard/team/${teamId}/practice`;

  const [{ data: team }, { data: players }, { data: profile }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, team_name, team_color, league_id")
      .eq("id", plan.team_id)
      .maybeSingle(),
    supabase
      .from("team_players")
      .select("id, player_name, color_index, jersey_number, positions, is_injured")
      .eq("team_id", plan.team_id)
      .eq("status", "active"),
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  if (!team) notFound();

  const t = planTotals(plan);
  const rows = interleavePlan(plan);

  // Attribution byline (Build 14.5): last editor, falling back to creator.
  const planActors = await resolveActorNames(supabase, [plan.created_by, plan.updated_by]);
  const planEditorId = plan.updated_by ?? plan.created_by;
  const planEditorName = planEditorId ? planActors.get(planEditorId) ?? "Coach" : null;

  // Build the full roster payload for the manage-attendance card. We want
  // every active player on the team so the modal can flip their status,
  // not just the ones who've already RSVP'd.
  const roster: RsvpPlayer[] = (players ?? []).map((p) => ({
    id: p.id as string,
    name: (p.player_name as string) ?? "Player",
    position:
      Array.isArray(p.positions) && p.positions.length > 0 ? (p.positions[0] as string) : null,
    initials: initialsFor((p.player_name as string) ?? "?"),
    color: playerColorForIndex((p.color_index as number) ?? 0),
    isInjured: !!p.is_injured,
  }));
  const initialAttendees: Record<string, boolean | null> = Object.fromEntries(
    plan.attendees.map((a) => [a.player_id, a.rsvp]),
  );

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
            { label: "Practice", href: base },
          ]}
          title={plan.title}
          kicker={formatDateLabel(plan.practice_date).toUpperCase()}
          userInitials={initials}
          showSearch={false}
          actions={
            !canManage ? undefined : (
            <>
              <form action={duplicatePlanAndRedirect}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="teamId" value={teamId} />
                <button type="submit" className="wbtn">
                  <PIcon.copy size={13} /> Duplicate
                </button>
              </form>
              {plan.status === "draft" ? (
                <span
                  className="wbtn"
                  title="Finalize the plan to enable logging."
                  aria-disabled
                  style={{
                    opacity: 0.45,
                    cursor: "not-allowed",
                    pointerEvents: "none",
                  }}
                >
                  Log practice
                </span>
              ) : (
                <Link
                  href={`${base}/${plan.id}/log`}
                  className="wbtn"
                  title={plan.status === "completed" ? "Edit the post-practice log" : "Log what happened at this practice"}
                >
                  {plan.status === "completed" ? "Edit log" : "Log practice"}
                </Link>
              )}
              <Link href={`${base}/${plan.id}/edit`} className="wbtn primary">
                Edit plan
              </Link>
              <PlanLifecycleActions
                planId={plan.id}
                teamId={teamId}
                status={plan.status}
                archived={plan.archived}
                title={plan.title}
              />
            </>
            )
          }
        />

        <div className="page" style={{ maxWidth: 1440, margin: "0 auto", width: "100%" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 440px",
              gap: 24,
              alignItems: "start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PastDueBanner
                status={plan.status}
                planId={plan.id}
                base={base}
                isPastDue={isPlanPastDue(plan.practice_date, plan.start_time, plan.status)}
                showDraftBlockedNotice={blocked === "draft"}
              />

              {/* Plan hero */}
              <div className="w-card hero" style={{ padding: "22px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <PracticeStatusPill status={plan.status} />
                  <span
                    className="mono"
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      fontSize: 10.5,
                      color: "var(--uff-text-mute)",
                      letterSpacing: ".06em",
                    }}
                  >
                    PLAN ID · {plan.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                    color: "var(--uff-text)",
                  }}
                >
                  {plan.title}
                </div>
                {planEditorName && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <Byline
                      who={planEditorName}
                      verb={plan.updated_by ? "Updated" : "Created"}
                      at={plan.updated_at ?? plan.created_at}
                    />
                    <EntityHistory entityType="practice_plan" entityId={plan.id} label="View full history" />
                  </div>
                )}
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    flexWrap: "wrap",
                    fontSize: 12.5,
                    color: "var(--uff-text-dim)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <PIcon.cal size={14} />
                    <span>
                      {formatDateLabel(plan.practice_date)}
                      {formatTimeLabel(plan.start_time) ? ` · ${formatTimeLabel(plan.start_time)}` : ""}
                      {formatTimeLabel(plan.end_time) ? `–${formatTimeLabel(plan.end_time)}` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <PIcon.clock size={14} />
                    <span className="mono" style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>
                      {t.total}m{t.target > 0 ? ` of ${t.target}m planned` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <PIcon.people size={14} />
                    <span>
                      {t.rsvpIn} confirmed{t.rsvpOut > 0 ? ` · ${t.rsvpOut} out` : ""}
                    </span>
                  </div>
                </div>
                {plan.blocks.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <BudgetBar plan={plan} totals={t} />
                  </div>
                )}
              </div>

              {/* Blocks list */}
              <div className="w-card" style={{ padding: 20 }}>
                <div className="sect-head" style={{ marginBottom: 18 }}>
                  <div className="title">
                    <span className="tk" />
                    Practice flow
                  </div>
                  <div className="meta">
                    {plan.blocks.length} BLOCKS · {t.drillCount} DRILLS · {plan.breaks.length} BREAKS
                  </div>
                </div>

                {plan.blocks.length === 0 ? (
                  <div
                    style={{
                      padding: "28px 24px",
                      border: "1px dashed var(--uff-line)",
                      borderRadius: 12,
                      color: "var(--uff-text-mute)",
                      fontSize: 13,
                      textAlign: "center",
                    }}
                  >
                    This plan has no blocks yet. <Link href={`${base}/${plan.id}/edit`} style={{ color: "var(--uff-orange)" }}>Edit the plan</Link> to add one.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {rows.map((row) => {
                      if (row.kind === "block") {
                        const idx = plan.blocks.findIndex((b) => b.id === row.payload.id);
                        return <BlockReadCard key={row.payload.id} block={row.payload} index={idx} />;
                      }
                      return <BreakReadRow key={row.payload.id} minutes={row.payload.duration_minutes} />;
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Side rail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 80 }}>
              <ManageAttendanceCard
                planId={plan.id}
                teamId={teamId}
                dateLabel={formatDateLabel(plan.practice_date)}
                roster={roster}
                initialAttendees={initialAttendees}
                canManage={canManage}
              />

              <div className="w-card subdued" style={{ padding: 16 }}>
                <div className="sect-head" style={{ marginBottom: 12 }}>
                  <div className="title">
                    <span className="tk" />
                    At a glance
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <MiniStat
                    label="Block phases"
                    value={`${plan.blocks.length} ordered`}
                    sub={plan.blocks.map((b) => blockColor(b.name).accent)}
                  />
                  <MiniStat label="Parallel slots" value={t.parallelSlots} />
                  <MiniStat
                    label="Benchmarks"
                    value={`${t.benchCount} drill${t.benchCount === 1 ? "" : "s"}`}
                  />
                  <MiniStat label="Water breaks" value={plan.breaks.length} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

