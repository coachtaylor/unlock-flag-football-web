// Player detail — 2-col workspace page. Left: hero card (avatar, badges,
// mini stats), Quick actions card. Right: time-range chips + a
// HistoryCard per (drill, benchmark_type) pair with a sparkline.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { DashIcon, Icon } from "@/components/uff/icons";
import {
  playerColorForIndex,
  teamColorHex,
} from "@/components/uff/team-colors";
import PlayerHistory, {
  type PlayerHistoryDrill,
} from "./PlayerHistory";

type BenchmarkRow = {
  id: string;
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

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function shortMonth(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

// Resolve a single benchmark row to a numeric sample for charting, using
// the benchmark_type to decide which column to read.
function sampleValue(b: BenchmarkRow, type: string | null): number | null {
  switch (type) {
    case "timed":
      return b.time_seconds != null ? Number(b.time_seconds) : null;
    case "rated":
      return b.rating != null ? Number(b.rating) : null;
    case "pct":
      if (b.attempts_count && b.made_count != null) {
        return (Number(b.made_count) / Number(b.attempts_count)) * 100;
      }
      return null;
    case "flags":
    case "drops":
    case "reps":
      return b.made_count != null ? Number(b.made_count) : null;
    default:
      if (b.time_seconds != null) return Number(b.time_seconds);
      if (b.rating != null) return Number(b.rating);
      return null;
  }
}

function unitFor(type: string | null) {
  switch (type) {
    case "timed":
      return "s";
    case "rated":
      return "/5";
    case "pct":
      return "%";
    case "flags":
      return " pulls";
    case "drops":
      return " drops";
    case "reps":
      return " reps";
    default:
      return "";
  }
}

function betterFor(type: string | null): "higher" | "lower" {
  return type === "timed" || type === "drops" ? "lower" : "higher";
}

function accentFor(type: string | null) {
  switch (type) {
    case "timed":
      return "var(--uff-orange)";
    case "rated":
      return "#6EA8FF";
    case "pct":
      return "#FFB347";
    case "flags":
      return "#B89BFF";
    case "drops":
      return "var(--uff-red)";
    case "reps":
      return "var(--uff-lime)";
    default:
      return "var(--uff-text)";
  }
}

function formatValue(v: number, type: string | null): string {
  switch (type) {
    case "timed":
      return v.toFixed(2);
    case "rated":
      return v.toFixed(1);
    case "pct":
      return v.toFixed(0);
    default:
      return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; playerId: string }>;
}) {
  const { teamId, playerId } = await params;
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

  const [{ data: player }, { data: benchesRaw }] = await Promise.all([
    supabase
      .from("team_players")
      .select(
        "id, team_id, player_name, positions, jersey_number, status, is_captain, is_injured, injury_note, color_index, notes, created_at"
      )
      .eq("id", playerId)
      .maybeSingle(),
    supabase
      .from("benchmark_results")
      .select(
        "id, assessment_date, created_at, time_seconds, rating, made_count, attempts_count, benchmark_type, team_drills(drill_name, benchmark_type)"
      )
      .eq("player_id", playerId)
      .order("assessment_date", { ascending: true }),
  ]);

  if (!player || player.team_id !== teamId) notFound();

  const positions = (player.positions as string[] | null) ?? [];
  const jerseyNumber = player.jersey_number as string | null;
  const status = player.status as "active" | "inactive";
  const isCaptain = (player.is_captain as boolean) ?? false;
  const isInjured = (player.is_injured as boolean) ?? false;
  const injuryNote = player.injury_note as string | null;
  const colorIndex = (player.color_index as number) ?? 0;
  const playerColor = playerColorForIndex(colorIndex);

  // Group benchmark rows by (drill_name, benchmark_type).
  const benches = (benchesRaw ?? []) as BenchmarkRow[];
  const groups = new Map<string, PlayerHistoryDrill>();
  for (const b of benches) {
    const drillJoin = b.team_drills;
    const drillRow = Array.isArray(drillJoin) ? drillJoin[0] : drillJoin;
    const drillName = drillRow?.drill_name ?? "Drill";
    const type = b.benchmark_type ?? drillRow?.benchmark_type ?? null;
    const value = sampleValue(b, type);
    if (value == null) continue;
    const key = `${drillName}::${type ?? ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        drillName,
        benchmarkType: type,
        unit: unitFor(type),
        better: betterFor(type),
        accent: accentFor(type),
        samples: [],
      });
    }
    groups.get(key)!.samples.push({
      date: b.assessment_date,
      value,
      label: formatValue(value, type),
    });
  }

  const drills: PlayerHistoryDrill[] = Array.from(groups.values()).sort(
    (a, b) => {
      const aLast = a.samples[a.samples.length - 1]?.date ?? "";
      const bLast = b.samples[b.samples.length - 1]?.date ?? "";
      return bLast.localeCompare(aLast);
    }
  );

  const benchmarkCount = benches.length;
  // Personal bests across all drills (samples that beat all prior in that drill).
  let pbCount = 0;
  for (const g of drills) {
    let best = g.better === "lower" ? Infinity : -Infinity;
    for (const s of g.samples) {
      const beats = g.better === "lower" ? s.value < best : s.value > best;
      if (beats) {
        if (best !== Infinity && best !== -Infinity) pbCount += 1;
        best = s.value;
      }
    }
  }

  const teamColor = teamColorHex(team.team_color);
  const userInitials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  const rosterBase = `/dashboard/team/${teamId}/roster`;
  const playerName = player.player_name as string;
  const joinedLabel = player.created_at
    ? `Joined ${shortMonth(player.created_at as string)}`
    : "";

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
            { label: "Roster", href: rosterBase },
          ]}
          title={playerName}
          kicker={jerseyNumber ? `#${jerseyNumber}` : undefined}
          status={isInjured ? "INJURED" : undefined}
          showSearch={false}
          userInitials={userInitials}
          actions={
            <>
              <Link
                href={`${rosterBase}/${playerId}/edit`}
                className="wbtn"
                style={{ height: 38 }}
              >
                <DashIcon.gear size={13} /> Edit
              </Link>
              <Link
                href="/benchmarks"
                className="wbtn primary"
                style={{ height: 38 }}
              >
                Run benchmark
              </Link>
            </>
          }
        />

        <div
          className="page player-detail-grid"
          style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}
        >
          {/* Hero column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              className="w-card hero"
              style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: playerColor,
                    color: "#1a0f08",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    border: "3px solid rgba(255,255,255,0.08)",
                    flexShrink: 0,
                    opacity: status === "inactive" ? 0.55 : 1,
                  }}
                >
                  {initialsFor(playerName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--uff-text-mute)",
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    {jerseyNumber ? `#${jerseyNumber} · ` : ""}
                    {positions.length ? positions.join(" / ") : "No position"}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: "var(--uff-text)",
                      letterSpacing: "-0.02em",
                      marginTop: 2,
                    }}
                  >
                    {playerName}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {isCaptain && (
                  <Badge color="#FFB347" bg="rgba(255,179,71,0.14)">
                    Captain
                  </Badge>
                )}
                {status === "active" ? (
                  <Badge color="var(--uff-lime)" bg="rgba(194,255,61,0.12)">
                    Active
                  </Badge>
                ) : (
                  <Badge color="var(--uff-text-mute)" bg="rgba(255,255,255,0.04)">
                    Inactive
                  </Badge>
                )}
                {isInjured && (
                  <Badge color="var(--uff-red)" bg="rgba(255,77,77,0.12)">
                    Injured
                  </Badge>
                )}
                {joinedLabel && (
                  <Badge
                    color="var(--uff-text-dim)"
                    bg="rgba(255,255,255,0.04)"
                  >
                    {joinedLabel}
                  </Badge>
                )}
              </div>

              {isInjured && injuryNote && (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "rgba(255,77,77,0.08)",
                    border: "1px solid rgba(255,77,77,0.30)",
                    borderRadius: 10,
                    fontSize: 12.5,
                    color: "var(--uff-text)",
                    lineHeight: 1.45,
                  }}
                >
                  <b style={{ color: "var(--uff-red)" }}>Injury note:</b>{" "}
                  {injuryNote}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <MiniHeroStat
                  label="Benchmarks"
                  value={String(benchmarkCount)}
                  sub={benchmarkCount === 0 ? "none yet" : "all time"}
                />
                <MiniHeroStat
                  label="Drills"
                  value={String(drills.length)}
                  sub="tracked"
                />
                <MiniHeroStat
                  label="PBs"
                  value={String(pbCount)}
                  sub={pbCount === 0 ? "—" : "all time"}
                  accent="var(--uff-orange)"
                />
                <MiniHeroStat
                  label="Position"
                  value={positions[0] ?? "—"}
                  sub={positions.length > 1 ? `+${positions.length - 1}` : ""}
                />
              </div>
            </div>

            <div className="w-card" style={{ padding: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--uff-text-mute)",
                  marginBottom: 8,
                }}
              >
                Quick actions
              </div>
              <QuickRow
                href="/benchmarks"
                label="Run a benchmark"
                meta="Pick a drill"
              />
              <QuickRow
                href="/practice"
                label="Mark attendance"
                meta="Next practice"
              />
              <QuickRow
                href={`${rosterBase}/${playerId}/edit`}
                label="Edit player"
                meta={isInjured ? "Update injury" : "Update profile"}
              />
            </div>

            {(player.notes as string | null) && (
              <div className="w-card" style={{ padding: 14 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--uff-text-mute)",
                    marginBottom: 8,
                  }}
                >
                  Notes
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "var(--uff-text-dim)",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                  }}
                >
                  {player.notes as string}
                </p>
              </div>
            )}
          </div>

          {/* History column */}
          <PlayerHistory drills={drills} />
        </div>

        <style>{`
          .player-detail-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 18px;
            padding-top: 18px;
          }
          @media (min-width: 1024px) {
            .player-detail-grid {
              grid-template-columns: 340px minmax(0, 1fr);
            }
          }
        `}</style>
      </div>
    </div>
  );
}

function MiniHeroStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1,
          marginTop: 4,
          color: accent || "var(--uff-text)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--uff-text-mute)",
          marginTop: 3,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function QuickRow({
  href,
  label,
  meta,
}: {
  href: string;
  label: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 8px",
        borderRadius: 8,
        textDecoration: "none",
        color: "inherit",
        borderTop: "1px solid var(--uff-line-soft)",
      }}
    >
      <span style={{ flex: 1, fontSize: 13, color: "var(--uff-text)" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 10.5,
          color: "var(--uff-text-mute)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {meta}
      </span>
      <Icon.chevR size={11} />
    </Link>
  );
}

function Badge({
  color,
  bg,
  children,
}: {
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: 4,
        background: bg,
        color,
      }}
    >
      {children}
    </span>
  );
}
