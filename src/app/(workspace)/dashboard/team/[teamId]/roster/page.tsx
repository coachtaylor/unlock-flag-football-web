// Roster list — team-scoped workspace page. Pulls every team_player for
// the team plus that player's most recent benchmark (across all drills)
// so the table can show the "Last benchmark" column without a per-row
// fetch. Captain badge is sourced from team_players.is_captain; injured
// status from team_players.is_injured.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { teamColorHex } from "@/components/uff/team-colors";
import RosterListClient, { type RosterPlayer } from "./RosterListClient";

type BenchmarkJoin = {
  player_id: string;
  assessment_date: string;
  created_at: string;
  time_seconds: number | null;
  rating: number | null;
  made_count: number | null;
  attempts_count: number | null;
  benchmark_type: string | null;
  team_drills:
    | { drill_name: string; benchmark_type: string | null }
    | { drill_name: string; benchmark_type: string | null }[]
    | null;
};

function formatBenchValue(b: BenchmarkJoin, drillType: string | null): string {
  const t = b.benchmark_type ?? drillType ?? null;
  if (t === "timed" && b.time_seconds != null)
    return `${Number(b.time_seconds).toFixed(2)}s`;
  if (t === "rated" && b.rating != null) return `${b.rating} / 5`;
  if (t === "pct" && b.attempts_count != null && b.made_count != null)
    return `${b.made_count} / ${b.attempts_count}`;
  if (t === "flags" && b.made_count != null) return `${b.made_count} pulls`;
  if (t === "drops" && b.made_count != null) return `${b.made_count} drops`;
  if (t === "reps" && b.made_count != null) return `${b.made_count} reps`;
  if (b.time_seconds != null) return `${Number(b.time_seconds).toFixed(2)}s`;
  if (b.rating != null) return `${b.rating} / 5`;
  return "—";
}

function relativeWhen(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1w ago";
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
}

export default async function TeamRosterPage({
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

  const [{ data: team }, { data: profile }, { data: membership }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, team_name, format, team_color, league_id")
        .eq("id", teamId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("team_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .maybeSingle(),
    ]);

  if (!team) notFound();

  // Access: direct team_member OR league_admin on the team's league.
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

  const { data: players } = await supabase
    .from("team_players")
    .select(
      "id, player_name, positions, jersey_number, status, is_captain, is_injured, color_index, notes"
    )
    .eq("team_id", teamId)
    .order("player_name", { ascending: true });

  const playerIds = (players ?? []).map((p) => p.id as string);
  const recentByPlayer = new Map<string, BenchmarkJoin>();
  if (playerIds.length > 0) {
    const { data: benches } = await supabase
      .from("benchmark_results")
      .select(
        "player_id, assessment_date, created_at, time_seconds, rating, made_count, attempts_count, benchmark_type, team_drills(drill_name, benchmark_type)"
      )
      .in("player_id", playerIds)
      .order("created_at", { ascending: false });
    // First occurrence per player_id wins (already ordered desc).
    for (const row of (benches ?? []) as BenchmarkJoin[]) {
      if (!recentByPlayer.has(row.player_id)) {
        recentByPlayer.set(row.player_id, row);
      }
    }
  }

  const rosterPlayers: RosterPlayer[] = (players ?? []).map((p) => {
    const bench = recentByPlayer.get(p.id as string);
    const drillJoin = bench?.team_drills;
    const drillRow = Array.isArray(drillJoin) ? drillJoin[0] : drillJoin;
    const drillType = drillRow?.benchmark_type ?? null;
    const lastBench = bench
      ? {
          drillName: drillRow?.drill_name ?? "Drill",
          benchmarkType: bench.benchmark_type ?? drillType,
          value: formatBenchValue(bench, drillType),
          when: relativeWhen(bench.created_at),
        }
      : null;
    return {
      id: p.id as string,
      name: p.player_name as string,
      positions: (p.positions as string[] | null) ?? [],
      jerseyNumber: (p.jersey_number as string | null) ?? null,
      status: p.status as "active" | "inactive",
      isCaptain: (p.is_captain as boolean) ?? false,
      isInjured: (p.is_injured as boolean) ?? false,
      colorIndex: (p.color_index as number) ?? 0,
      lastBench,
    };
  });

  const teamColor = teamColorHex(team.team_color);
  const initials =
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
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={[
            { label: team.team_name, href: `/dashboard/team/${teamId}` },
          ]}
          title="Roster"
          kicker={`${rosterPlayers.filter((p) => p.status === "active").length} active`}
          showSearch={false}
          userInitials={initials}
        />

        <div
          className="page"
          style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}
        >
          <RosterListClient
            teamId={teamId}
            teamName={team.team_name}
            players={rosterPlayers}
          />
        </div>
      </div>
    </div>
  );
}
