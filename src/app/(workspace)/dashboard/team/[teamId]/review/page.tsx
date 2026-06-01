// Build 11 — Needs-review queue. Surfaces every benchmark_results row
// where a captain ticked "Mark for review" during logging. The queue is
// capped to the last 30 days (matches the dashboard badge logic) so it
// stays scannable.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveActorNames } from "@/lib/activity";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { teamColorHex } from "@/components/uff/team-colors";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { BENCH_BY_ID, type BenchKind } from "@/components/uff-web/drills/atoms";
import ReviewQueueRow from "./ReviewQueueRow";

type ReviewRow = {
  id: string;
  drill_id: string;
  player_id: string;
  benchmark_type: string;
  rating: number | null;
  time_seconds: number | null;
  made_count: number | null;
  attempts_count: number | null;
  tags: string[] | null;
  notes: string | null;
  assessment_date: string;
  created_at: string;
  captured_on: string | null;
  entry_mode: string | null;
  assessed_by: string | null;
};

function formatValue(row: ReviewRow): string {
  const kind = (row.benchmark_type as BenchKind | null) ?? null;
  if (!kind) return "—";
  const meta = BENCH_BY_ID[kind];
  if (kind === "timed") {
    return row.time_seconds != null ? `${row.time_seconds.toFixed(2)}${meta.unit}` : "—";
  }
  if (kind === "rated") {
    return row.rating != null ? `${row.rating}${meta.unit}` : "—";
  }
  if (kind === "pct") {
    if (row.made_count == null || row.attempts_count == null) return "—";
    const pct = row.attempts_count
      ? Math.round((row.made_count / row.attempts_count) * 100)
      : 0;
    return `${row.made_count}/${row.attempts_count} (${pct}%)`;
  }
  return row.made_count != null ? `${row.made_count} ${meta.unit}` : "—";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ReviewQueuePage({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: team } = await supabase
    .from("teams")
    .select("id, team_name, format, team_color, league_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) notFound();

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .maybeSingle();
  let canView = !!membership;
  if (!canView && team.league_id) {
    const { data: leagueMember } = await supabase
      .from("league_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("league_id", team.league_id)
      .eq("role", "league_admin")
      .maybeSingle();
    canView = !!leagueMember;
  }
  if (!canView) notFound();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const thirtyDaysAgoStr = cutoff.toISOString().slice(0, 10);

  const { data: flagged } = await supabase
    .from("benchmark_results")
    .select(
      "id, drill_id, player_id, benchmark_type, rating, time_seconds, made_count, attempts_count, tags, notes, assessment_date, created_at, captured_on, entry_mode, assessed_by",
    )
    .eq("team_id", teamId)
    .eq("needs_review", true)
    .gte("assessment_date", thirtyDaysAgoStr)
    .order("assessment_date", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = (flagged ?? []) as ReviewRow[];

  // Resolve drill + player names in two small lookups so RLS stays happy.
  const drillIds = Array.from(new Set(rows.map((r) => r.drill_id)));
  const playerIds = Array.from(new Set(rows.map((r) => r.player_id)));

  const [drillsRes, playersRes, workspaces] = await Promise.all([
    drillIds.length
      ? supabase
          .from("team_drills")
          .select("id, drill_name")
          .in("id", drillIds)
      : Promise.resolve({ data: [] as { id: string; drill_name: string }[] }),
    playerIds.length
      ? supabase
          .from("team_players")
          .select("id, player_name")
          .in("id", playerIds)
      : Promise.resolve({ data: [] as { id: string; player_name: string }[] }),
    loadSidebarWorkspaces(teamId, team.league_id),
  ]);
  const drillNameById = new Map(
    (drillsRes.data ?? []).map((d) => [d.id as string, d.drill_name as string]),
  );
  const playerNameById = new Map(
    (playersRes.data ?? []).map((p) => [p.id as string, p.player_name as string]),
  );
  // Who logged each flagged assessment (Build 14.5) — surfaces calibration:
  // you can see which captain rated, including the self-assessment-bias case.
  const assessorNameById = await resolveActorNames(
    supabase,
    rows.map((r) => r.assessed_by),
  );

  const teamColor = teamColorHex(team.team_color);
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  return (
    <div className="uff-web">
      <TeamSidebar
        active="dashboard"
        teamId={teamId}
        teamColor={teamColor}
        teamName={team.team_name}
        leagueId={team.league_id}
        user={{
          firstName: profile?.first_name ?? user.email ?? "",
          lastName: profile?.last_name ?? "",
        }}
        workspaces={workspaces}
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={[
            { label: team.team_name, href: `/dashboard/team/${teamId}` },
          ]}
          title="Review queue"
          kicker="FLAGGED · LAST 30 DAYS"
          userInitials={initials}
        />

        <div
          className="page"
          style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}
        >
          <div className="w-card">
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: "var(--uff-text-dim)",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Flagged entries
                </p>
                <h2
                  style={{
                    fontSize: 20,
                    color: "var(--uff-text)",
                    fontWeight: 500,
                  }}
                >
                  {rows.length} {rows.length === 1 ? "entry" : "entries"} to revisit
                </h2>
              </div>
              <Link
                href={`/dashboard/team/${teamId}`}
                style={{
                  fontSize: 13,
                  color: "var(--uff-text-dim)",
                  textDecoration: "none",
                }}
              >
                ← Back to dashboard
              </Link>
            </div>

            {rows.length === 0 ? (
              <div
                style={{
                  border: "1px dashed var(--uff-line)",
                  borderRadius: 10,
                  padding: 32,
                  textAlign: "center",
                  color: "var(--uff-text-dim)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                Nothing flagged. When a captain ticks{" "}
                <span style={{ color: "var(--uff-text)" }}>Mark for review</span>{" "}
                during benchmark logging, entries show up here for follow-up.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {rows.map((row) => (
                  <ReviewQueueRow
                    key={row.id}
                    teamId={teamId}
                    resultId={row.id}
                    drillId={row.drill_id}
                    drillName={drillNameById.get(row.drill_id) ?? "Drill"}
                    playerName={playerNameById.get(row.player_id) ?? "Player"}
                    benchmarkType={row.benchmark_type}
                    value={formatValue(row)}
                    assessmentDate={formatDate(row.assessment_date)}
                    capturedOn={row.captured_on ?? "desktop"}
                    entryMode={row.entry_mode ?? "benchmark"}
                    assessorName={
                      row.assessed_by ? assessorNameById.get(row.assessed_by) ?? null : null
                    }
                    tags={row.tags ?? []}
                    notes={row.notes}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
