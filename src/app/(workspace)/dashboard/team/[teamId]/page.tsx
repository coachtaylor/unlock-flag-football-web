// Team dashboard — ported from the original (app)/dashboard/page.tsx.
// Same data sources (vw_team_strength_weakness, benchmark_results,
// vw_practice_history, counts), now scoped to the teamId in the URL and
// wrapped in the .uff-web workspace shell with the existing (app)
// sidebar swapped out for a team-context navigation.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { Icon } from "@/components/uff/icons";
import { teamColorHex } from "@/components/uff/team-colors";

type StrengthRow = {
  category_name: string;
  avg_rating: number | null;
  avg_time: number | null;
  players_assessed: number | null;
  drills_in_category: number | null;
  total_assessments: number | null;
};

type RecentBenchmarkRow = {
  id: string;
  assessment_date: string;
  created_at: string;
  time_seconds: number | null;
  rating: number | null;
  team_players: { id: string; player_name: string } | null;
  team_drills: { drill_name: string; benchmark_type: string | null } | null;
};

type PracticeHistoryRow = {
  practice_plan_id: string;
  practice_date: string;
  title: string | null;
  drills_planned: number | null;
  drills_completed_count: number | null;
  drills_skipped_count: number | null;
  attendance_count: number | null;
  energy_level: number | null;
  highlights: string | null;
  areas_to_improve: string | null;
};

function formatShortDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ratingColor(rating: number) {
  if (rating >= 4) return "#4ADE80";
  if (rating >= 2.5) return "var(--uff-orange)";
  return "var(--uff-red)";
}

export default async function TeamDashboardPage({
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

  // Allow league-admin override: if not a direct team_member but the
  // team belongs to a league the user admins, still let them view.
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

  const roleLabel =
    membership?.role === "captain"
      ? "CAPTAIN"
      : membership?.role === "coach"
      ? "COACH"
      : team.league_id
      ? "LEAGUE ADMIN"
      : "TEAM";

  const [
    strengthRes,
    recentBenchmarksRes,
    practiceHistoryRes,
    playersRes,
    drillsRes,
    benchmarksRes,
    practicesRes,
  ] = await Promise.all([
    supabase
      .from("vw_team_strength_weakness")
      .select("*")
      .eq("team_id", teamId),
    supabase
      .from("benchmark_results")
      .select(
        "id, assessment_date, created_at, time_seconds, rating, team_players(id, player_name), team_drills(drill_name, benchmark_type)"
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("vw_practice_history")
      .select("*")
      .eq("team_id", teamId)
      .order("practice_date", { ascending: false })
      .limit(3),
    supabase
      .from("team_players")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("status", "active"),
    supabase
      .from("team_drills")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("status", "published"),
    supabase
      .from("benchmark_results")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId),
    supabase
      .from("practice_plans")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId),
  ]);

  const strengths = (strengthRes.data ?? []) as StrengthRow[];
  const recentBenchmarks = (recentBenchmarksRes.data ?? []).map((row) => {
    const players = row.team_players as
      | { id: string; player_name: string }
      | { id: string; player_name: string }[]
      | null;
    const drills = row.team_drills as
      | { drill_name: string; benchmark_type: string | null }
      | { drill_name: string; benchmark_type: string | null }[]
      | null;
    return {
      ...row,
      team_players: Array.isArray(players) ? players[0] ?? null : players,
      team_drills: Array.isArray(drills) ? drills[0] ?? null : drills,
    };
  }) as RecentBenchmarkRow[];
  const practiceHistory = (practiceHistoryRes.data ?? []) as PracticeHistoryRow[];

  const playersCount = playersRes.count ?? 0;
  const drillsCount = drillsRes.count ?? 0;
  const benchmarksCount = benchmarksRes.count ?? 0;
  const practicesCount = practicesRes.count ?? 0;
  const isEmptyTeam =
    playersCount === 0 && drillsCount === 0 && benchmarksCount === 0;

  const teamColor = teamColorHex(team.team_color);
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  return (
    <div className="uff-web">
      {/* Team-context sidebar — primary app nav (Drills, Roster, Practice). */}
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
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={
            team.league_id
              ? [
                  { label: "League", href: `/dashboard/league/${team.league_id}` },
                ]
              : []
          }
          title={team.team_name}
          kicker={team.format?.toUpperCase()}
          userInitials={initials}
          actions={
            <>
              <Link href="/practice/new" className="wbtn">
                <Icon.plus size={13} /> Plan practice
              </Link>
              <Link href="/benchmarks" className="wbtn primary">
                Run benchmark
              </Link>
            </>
          }
        />

        <div className="page" style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}>
          {/* Hero */}
          <div
            className="w-card"
            style={{
              padding: 16,
              borderTop: `2px solid ${teamColor}`,
              background: `linear-gradient(180deg, ${teamColor}14 0%, transparent 50%), var(--uff-surface)`,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: ".18em",
                color: "var(--uff-text-mute)",
                marginBottom: 6,
              }}
            >
              {roleLabel}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                color: "var(--uff-text)",
              }}
            >
              {team.team_name}
            </div>
          </div>

          {/* Stat strip — 1col mobile → 2col md → 4col lg */}
          <div className="w-card td-stat-strip">
            <StatCell label="PLAYERS" v={playersCount} />
            <StatCell label="DRILLS" v={drillsCount} sub="published" />
            <StatCell label="BENCHMARKS" v={benchmarksCount} />
            <StatCell label="PRACTICES" v={practicesCount} last />
          </div>

          {isEmptyTeam ? (
            <EmptyTeamCard teamId={teamId} />
          ) : (
            <div className="td-body-grid">
              <div className="td-body-main">
                <SectionHead label="Team overview" />
                <TeamOverview rows={strengths} />
              </div>
              <div className="td-body-side">
                <div>
                  <SectionHead label="Recent assessments" />
                  <RecentAssessments rows={recentBenchmarks} teamId={teamId} />
                </div>
                <div>
                  <SectionHead label="Recent practices" />
                  <RecentPractices rows={practiceHistory} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* Stat strip: 1 → 2 → 4 columns at md/lg breakpoints.
           Border-right between cells only when on the same row. */
        .td-stat-strip {
          padding: 0;
          display: grid;
          grid-template-columns: 1fr;
          overflow: hidden;
        }
        .td-stat-strip > * {
          border-right: none !important;
          border-bottom: 1px solid var(--uff-line-soft);
        }
        .td-stat-strip > *:last-child { border-bottom: none; }
        @media (min-width: 768px) {
          .td-stat-strip { grid-template-columns: repeat(2, 1fr); }
          .td-stat-strip > *:nth-child(odd) { border-right: 1px solid var(--uff-line-soft) !important; }
          .td-stat-strip > *:nth-child(3),
          .td-stat-strip > *:nth-child(4) { border-bottom: none; }
        }
        @media (min-width: 1100px) {
          .td-stat-strip { grid-template-columns: repeat(4, 1fr); }
          .td-stat-strip > * { border-bottom: none; border-right: 1px solid var(--uff-line-soft) !important; }
          .td-stat-strip > *:last-child { border-right: none !important; }
        }

        /* Body grid: stacked everywhere except lg+, where it splits into
           a main column (strength/weakness) and a side column (recent
           assessments + practices). */
        .td-body-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        .td-body-main,
        .td-body-side {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 0;
        }
        .td-body-side { gap: 20px; }
        @media (min-width: 1100px) {
          .td-body-grid {
            grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
            gap: 24px;
          }
        }

        /* Strength/weakness rows: vertical list on mobile/md, 2-col
           horizontal grid at lg+ inside the main column. */
        .td-overview-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1px;
          background: var(--uff-line-soft);
          border: 1px solid var(--uff-line-soft);
          border-radius: 16px;
          overflow: hidden;
        }
        .td-overview-grid > * {
          background: var(--uff-surface);
        }
        @media (min-width: 1100px) {
          .td-overview-grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* Hover affordance: stat cells lift slightly, rows tint. */
        .td-stat-cell {
          transition: background 120ms ease;
        }
        .td-stat-cell:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .td-row-hover {
          transition: background 120ms ease;
        }
        .td-row-hover:hover {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
}


function StatCell({
  label,
  v,
  sub,
}: {
  label: string;
  v: number;
  sub?: string;
  last?: boolean; // accepted for API compatibility; borders driven by the parent grid
}) {
  return (
    <div
      className="td-stat-cell"
      style={{
        padding: "var(--stat-pad-y) var(--stat-pad-x)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: ".16em",
          color: "var(--uff-text-mute)",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: v === 0 ? "var(--uff-text-mute)" : "var(--uff-text)",
          }}
        >
          {v}
        </span>
        {sub && (
          <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>{sub}</span>
        )}
      </div>
    </div>
  );
}

function SectionHead({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: 0,
      }}
    >
      <span
        style={{
          width: 3,
          height: 14,
          background: "var(--uff-orange)",
          borderRadius: 2,
        }}
      />
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "-0.005em",
          color: "var(--uff-text)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function EmptyTeamCard({ teamId }: { teamId: string }) {
  // Brand-new team: no players, drills, or benchmarks. Centered hero
  // card with a single primary CTA (Run your first benchmark) and the
  // two secondary steps that get you there. Wider, more breathing room
  // than the old stacked list.
  const steps = [
    { n: 2, t: "Add drills", sub: "Build your library.", href: "/drills/new" },
    { n: 3, t: "Plan a practice", sub: "Build the agenda.", href: "/practice/new" },
  ];
  const rosterNewHref = `/dashboard/team/${teamId}/roster/new`;
  return (
    <div
      className="w-card"
      style={{
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(255,106,26,0.05) 0%, transparent 50%), var(--uff-surface)",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".18em",
          color: "var(--uff-orange)",
        }}
      >
        GET STARTED
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          color: "var(--uff-text)",
          maxWidth: 520,
        }}
      >
        Start with your roster.
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--uff-text-dim)",
          lineHeight: 1.5,
          maxWidth: 460,
        }}
      >
        Add players, run drills, and log practices. Strengths, gaps, and
        progression show up here as the data comes in.
      </p>
      <Link
        href={rosterNewHref}
        className="wbtn primary"
        style={{
          marginTop: 4,
          height: 44,
          fontSize: 14,
          padding: "0 22px",
        }}
      >
        Add players <Icon.arrowRight size={14} />
      </Link>

      <div
        className="td-empty-steps"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          width: "100%",
          maxWidth: 520,
          marginTop: 8,
        }}
      >
        {steps.map((s) => (
          <Link
            key={s.n}
            href={s.href}
            className="w-card subdued td-row-hover"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 10,
              textDecoration: "none",
              color: "inherit",
              textAlign: "left",
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 9999,
                background: "rgba(255, 106, 26, 0.15)",
                color: "var(--uff-orange)",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                flexShrink: 0,
              }}
            >
              {s.n}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--uff-text)",
                }}
              >
                {s.t}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--uff-text-dim)",
                  marginTop: 2,
                }}
              >
                {s.sub}
              </div>
            </div>
            <Icon.chevR size={13} />
          </Link>
        ))}
      </div>

      <style>{`
        @media (max-width: 600px) {
          .td-empty-steps { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function TeamOverview({ rows }: { rows: StrengthRow[] }) {
  const withData = rows.filter(
    (r) =>
      (r.total_assessments ?? 0) > 0 &&
      (r.avg_rating !== null || r.avg_time !== null)
  );
  if (withData.length === 0) {
    return (
      <div
        className="w-card subdued"
        style={{
          padding: 18,
          border: "1px dashed var(--uff-line)",
          background: "transparent",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)" }}>
          Run benchmark assessments to see team strengths and weaknesses here.
        </p>
        <Link
          href="/benchmarks"
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--uff-orange)",
            textDecoration: "none",
          }}
        >
          Start an assessment →
        </Link>
      </div>
    );
  }

  // Stacked vertically on mobile / md (1-col grid), horizontal multi-
  // column comparison at lg+ (the .td-overview-grid class collapses
  // to 1 col below 1100px). Each cell renders a category card.
  return (
    <div className="td-overview-grid">
      {withData.map((row) => {
        const ratingNum =
          row.avg_rating !== null ? Number(row.avg_rating) : null;
        const timeNum = row.avg_time !== null ? Number(row.avg_time) : null;
        return (
          <div
            key={row.category_name}
            className="td-row-hover"
            style={{
              padding: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--uff-text)",
                  textTransform: "capitalize",
                }}
              >
                {row.category_name}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--uff-text-dim)",
                  marginTop: 2,
                }}
              >
                {row.players_assessed ?? 0}{" "}
                {row.players_assessed === 1 ? "player" : "players"} ·{" "}
                {row.total_assessments ?? 0} assessments
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 4,
              }}
            >
              {ratingNum !== null && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 14,
                    fontWeight: 700,
                    color: ratingColor(ratingNum),
                  }}
                >
                  {ratingNum.toFixed(1)} / 5
                </span>
              )}
              {timeNum !== null && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--uff-text-dim)",
                  }}
                >
                  avg {timeNum.toFixed(2)}s
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentAssessments({
  rows,
  teamId,
}: {
  rows: RecentBenchmarkRow[];
  teamId: string;
}) {
  if (rows.length === 0) {
    return (
      <div
        className="w-card subdued"
        style={{
          padding: 18,
          border: "1px dashed var(--uff-line)",
          background: "transparent",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)" }}>
          No assessments yet. Run your first benchmark to track player
          performance.
        </p>
        <Link
          href="/benchmarks"
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--uff-orange)",
            textDecoration: "none",
          }}
        >
          Run a benchmark →
        </Link>
      </div>
    );
  }
  return (
    <div className="w-card" style={{ padding: 0, overflow: "hidden" }}>
      {rows.map((row, idx) => {
        const playerId = row.team_players?.id ?? null;
        const playerName = row.team_players?.player_name ?? "Unknown player";
        const drillName = row.team_drills?.drill_name ?? "Unknown drill";
        const benchmarkType = row.team_drills?.benchmark_type ?? null;
        const result =
          benchmarkType === "timed" && row.time_seconds !== null
            ? `${Number(row.time_seconds).toFixed(2)}s`
            : row.rating !== null
            ? `${row.rating}/5`
            : "—";
        const inner = (
          <div
            className="td-row-hover"
            style={{
              padding: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              borderTop:
                idx === 0 ? undefined : "1px solid var(--uff-line-soft)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--uff-text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {playerName}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--uff-text-dim)",
                  marginTop: 2,
                }}
              >
                {drillName} · {formatShortDate(row.assessment_date)}
              </div>
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--uff-text)",
              }}
            >
              {result}
            </span>
          </div>
        );
        return playerId ? (
          <Link
            key={row.id}
            href={`/dashboard/team/${teamId}/roster/${playerId}`}
            style={{
              display: "block",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            {inner}
          </Link>
        ) : (
          <div key={row.id}>{inner}</div>
        );
      })}
    </div>
  );
}

function RecentPractices({ rows }: { rows: PracticeHistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        className="w-card subdued"
        style={{
          padding: 18,
          border: "1px dashed var(--uff-line)",
          background: "transparent",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)" }}>
          No practices logged yet.
        </p>
        <Link
          href="/practice/new"
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--uff-orange)",
            textDecoration: "none",
          }}
        >
          Plan a practice →
        </Link>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((row) => {
        const planned = row.drills_planned ?? 0;
        const completed = row.drills_completed_count ?? 0;
        return (
          <Link
            key={row.practice_plan_id}
            href={`/practice/${row.practice_plan_id}`}
            className="w-card td-row-hover"
            style={{
              padding: 12,
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--uff-text)",
                }}
              >
                {formatShortDate(row.practice_date)}
                {row.title ? ` · ${row.title}` : ""}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--uff-text-dim)", marginTop: 2 }}>
                {row.attendance_count !== null
                  ? `${row.attendance_count} players`
                  : "Attendance —"}
              </div>
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                color: "var(--uff-text-dim)",
              }}
            >
              {completed}/{planned} drills
            </span>
          </Link>
        );
      })}
    </div>
  );
}
