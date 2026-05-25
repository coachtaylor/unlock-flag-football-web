// Team dashboard — home screen for captains.
// Pulls real aggregated data from coach dashboard views (Build 5a):
//   - vw_team_strength_weakness for the team overview card
//   - benchmark_results (joined) for recent assessments
//   - vw_practice_history for recent practices
// Plus the existing top-level counts and quick actions.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function ratingColor(rating: number) {
  if (rating >= 4) return "var(--color-green-400)";
  if (rating >= 2.5) return "var(--color-orange-400)";
  return "var(--color-error)";
}

function FilledDots({
  filled,
  total,
  color,
}: {
  filled: number;
  total: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-xs">
      {Array.from({ length: total }).map((_, i) => {
        const isFilled = i < Math.round(filled);
        return (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              backgroundColor: isFilled
                ? color
                : "var(--color-border-default)",
            }}
          />
        );
      })}
    </div>
  );
}

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, role, teams(team_name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/team-setup");

  const teamId = membership.team_id;
  const teamRecord = membership.teams as
    | { team_name: string }
    | { team_name: string }[]
    | null;
  const teamName = Array.isArray(teamRecord)
    ? teamRecord[0]?.team_name
    : teamRecord?.team_name;

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

  const stats = [
    { label: "Players", value: playersCount, sub: "active" },
    { label: "Drills", value: drillsCount, sub: "published" },
    { label: "Benchmarks", value: benchmarksCount, sub: "logged" },
    { label: "Practices", value: practicesCount, sub: "planned" },
  ];

  const quickActions = [
    {
      label: "Add a drill",
      description: "Build out your library",
      href: "/drills/new",
    },
    {
      label: "Add a player",
      description: "Grow your roster",
      href: "/roster/new",
    },
    {
      label: "Plan practice",
      description: "Schedule Sunday's drills",
      href: "/practice/new",
    },
    {
      label: "Run Assessment",
      description: "Benchmark your players",
      href: "/benchmarks",
    },
  ];

  // Empty state — brand new team, no data anywhere yet.
  if (isEmptyTeam) {
    const steps = [
      {
        n: 1,
        title: "Add your players",
        description: "Build the roster you'll be coaching.",
        href: "/roster/new",
      },
      {
        n: 2,
        title: "Create your drills",
        description: "Seed the library with what you already run.",
        href: "/drills/new",
      },
      {
        n: 3,
        title: "Run your first assessment",
        description: "Benchmark a drill to start collecting data.",
        href: "/benchmarks",
      },
    ];

    return (
      <div className="pt-2xl pb-xl">
        <div
          className="rounded-xl p-2xl overflow-hidden relative"
          style={{
            background:
              "linear-gradient(135deg, rgba(212, 138, 48, 0.18) 0%, rgba(22, 28, 36, 0.4) 60%, var(--color-surface-raised) 100%)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <p
            className="label-micro"
            style={{ color: "var(--color-orange-300)" }}
          >
            Your Team
          </p>
          <h1
            className="text-display font-medium mt-xs"
            style={{ color: "var(--color-text-primary)" }}
          >
            {teamName ?? "Your team"}
          </h1>
          <p
            className="text-body mt-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Let's get your dashboard set up.
          </p>
        </div>

        <p className="label-micro mt-3xl">Get Started</p>

        <div className="flex flex-col gap-md mt-md">
          {steps.map((step) => (
            <Link
              key={step.n}
              href={step.href}
              className="p-lg rounded-xl flex items-center gap-lg no-underline transition-all active:scale-[0.98]"
              style={{
                backgroundColor: "var(--color-surface-raised)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <span
                className="flex items-center justify-center text-heading font-medium tabular-nums shrink-0"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(212, 138, 48, 0.15)",
                  color: "var(--color-orange-300)",
                  border: "1px solid rgba(212, 138, 48, 0.3)",
                }}
              >
                {step.n}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-heading font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {step.title}
                </p>
                <p
                  className="text-caption mt-xs"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {step.description}
                </p>
              </div>
              <span
                className="text-body font-medium shrink-0"
                style={{ color: "var(--color-orange-400)" }}
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2xl pb-xl">
      <div
        className="rounded-xl p-2xl overflow-hidden relative"
        style={{
          background:
            "linear-gradient(135deg, rgba(212, 138, 48, 0.18) 0%, rgba(22, 28, 36, 0.4) 60%, var(--color-surface-raised) 100%)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <p
          className="label-micro"
          style={{ color: "var(--color-orange-300)" }}
        >
          Your Team
        </p>
        <h1
          className="text-display font-medium mt-xs"
          style={{ color: "var(--color-text-primary)" }}
        >
          {teamName ?? "Your team"}
        </h1>
        <p
          className="text-body mt-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Team Dashboard
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-md mt-2xl">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="p-lg rounded-xl"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            <p className="label-micro">{stat.label}</p>
            <p
              className="text-stat font-medium tabular-nums mt-sm"
              style={{ color: "var(--color-text-primary)" }}
            >
              {stat.value}
            </p>
            <p
              className="text-caption mt-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Team Overview */}
      <p className="label-micro mt-3xl">Team Overview</p>
      <div className="mt-md">
        <TeamOverview rows={strengths} />
      </div>

      {/* Recent Assessments */}
      <p className="label-micro mt-3xl">Recent Assessments</p>
      <div className="mt-md">
        <RecentAssessments rows={recentBenchmarks} />
      </div>

      {/* Recent Practices */}
      <p className="label-micro mt-3xl">Recent Practices</p>
      <div className="mt-md">
        <RecentPractices rows={practiceHistory} />
      </div>

      {/* Quick Actions */}
      <p className="label-micro mt-3xl">Quick Actions</p>
      <div className="flex flex-col gap-md mt-md">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="p-lg rounded-xl flex items-center justify-between no-underline transition-all active:scale-[0.98]"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            <div>
              <p
                className="text-heading font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {action.label}
              </p>
              <p
                className="text-caption mt-xs"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {action.description}
              </p>
            </div>
            <span
              className="text-body font-medium"
              style={{ color: "var(--color-orange-400)" }}
            >
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Team Overview: strengths/weaknesses by drill category
// ----------------------------------------------------------------
function TeamOverview({ rows }: { rows: StrengthRow[] }) {
  const withData = rows.filter(
    (r) => (r.total_assessments ?? 0) > 0 && (r.avg_rating !== null || r.avg_time !== null)
  );

  if (withData.length === 0) {
    return (
      <div
        className="p-lg rounded-lg"
        style={{
          backgroundColor: "transparent",
          border: "1px dashed var(--color-border-default)",
        }}
      >
        <p
          className="text-body"
          style={{ color: "var(--color-text-muted)" }}
        >
          Run benchmark assessments to see team strengths and weaknesses here.
        </p>
        <Link
          href="/benchmarks"
          className="text-caption font-medium mt-sm inline-block no-underline"
          style={{ color: "var(--color-orange-400)" }}
        >
          Start an assessment →
        </Link>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {withData.map((row, idx) => {
        const hasRating =
          row.avg_rating !== null && Number.isFinite(Number(row.avg_rating));
        const hasTime =
          row.avg_time !== null && Number.isFinite(Number(row.avg_time));
        const ratingNum = hasRating ? Number(row.avg_rating) : null;
        const timeNum = hasTime ? Number(row.avg_time) : null;
        return (
          <div
            key={row.category_name}
            className="p-lg flex items-center justify-between"
            style={{
              borderTop:
                idx === 0
                  ? undefined
                  : "1px solid var(--color-border-subtle)",
            }}
          >
            <div className="flex-1 min-w-0">
              <p
                className="text-body font-medium capitalize"
                style={{ color: "var(--color-text-primary)" }}
              >
                {row.category_name}
              </p>
              <p
                className="text-caption mt-xs"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {row.players_assessed ?? 0}{" "}
                {row.players_assessed === 1 ? "player" : "players"} ·{" "}
                {row.total_assessments ?? 0} assessments
              </p>
            </div>
            <div className="flex flex-col items-end gap-xs ml-md">
              {ratingNum !== null && (
                <div className="flex items-center gap-sm">
                  <FilledDots
                    filled={ratingNum}
                    total={5}
                    color={ratingColor(ratingNum)}
                  />
                  <span
                    className="text-caption font-medium tabular-nums"
                    style={{ color: ratingColor(ratingNum) }}
                  >
                    {ratingNum.toFixed(1)}
                  </span>
                </div>
              )}
              {timeNum !== null && (
                <span
                  className="text-caption tabular-nums"
                  style={{ color: "var(--color-text-secondary)" }}
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

// ----------------------------------------------------------------
// Recent Assessments
// ----------------------------------------------------------------
function RecentAssessments({ rows }: { rows: RecentBenchmarkRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        className="p-lg rounded-lg"
        style={{
          backgroundColor: "transparent",
          border: "1px dashed var(--color-border-default)",
        }}
      >
        <p
          className="text-body"
          style={{ color: "var(--color-text-muted)" }}
        >
          No assessments yet. Run your first benchmark to track player
          performance.
        </p>
        <Link
          href="/benchmarks"
          className="text-caption font-medium mt-sm inline-block no-underline"
          style={{ color: "var(--color-orange-400)" }}
        >
          Run a benchmark →
        </Link>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
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

        const content = (
          <div
            className="p-lg flex items-center justify-between"
            style={{
              borderTop:
                idx === 0
                  ? undefined
                  : "1px solid var(--color-border-subtle)",
            }}
          >
            <div className="flex-1 min-w-0">
              <p
                className="text-body font-medium truncate"
                style={{ color: "var(--color-text-primary)" }}
              >
                {playerName}
              </p>
              <p
                className="text-caption mt-xs truncate"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {drillName} · {formatShortDate(row.assessment_date)}
              </p>
            </div>
            <span
              className="text-heading font-medium tabular-nums ml-md"
              style={{ color: "var(--color-text-primary)" }}
            >
              {result}
            </span>
          </div>
        );

        return playerId ? (
          <Link
            key={row.id}
            href={`/roster/${playerId}`}
            className="block no-underline"
          >
            {content}
          </Link>
        ) : (
          <div key={row.id}>{content}</div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------
// Recent Practices
// ----------------------------------------------------------------
function RecentPractices({ rows }: { rows: PracticeHistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        className="p-lg rounded-lg"
        style={{
          backgroundColor: "transparent",
          border: "1px dashed var(--color-border-default)",
        }}
      >
        <p
          className="text-body"
          style={{ color: "var(--color-text-muted)" }}
        >
          No practices logged yet.
        </p>
        <Link
          href="/practice/new"
          className="text-caption font-medium mt-sm inline-block no-underline"
          style={{ color: "var(--color-orange-400)" }}
        >
          Plan a practice →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      {rows.map((row) => {
        const planned = row.drills_planned ?? 0;
        const completed = row.drills_completed_count ?? 0;
        const energy = row.energy_level ?? 0;
        return (
          <Link
            key={row.practice_plan_id}
            href={`/practice/${row.practice_plan_id}`}
            className="p-lg rounded-xl no-underline transition-all active:scale-[0.98]"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            <div className="flex items-center justify-between">
              <p
                className="text-body font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {formatShortDate(row.practice_date)}
                {row.title ? ` · ${row.title}` : ""}
              </p>
              <span
                className="text-caption tabular-nums"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {completed}/{planned} drills
              </span>
            </div>
            <div className="flex items-center justify-between mt-sm">
              <span
                className="text-caption"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {row.attendance_count !== null
                  ? `${row.attendance_count} players`
                  : "Attendance —"}
              </span>
              {energy > 0 && (
                <div className="flex items-center gap-sm">
                  <span
                    className="text-micro uppercase"
                    style={{
                      color: "var(--color-text-muted)",
                      letterSpacing: "0.8px",
                    }}
                  >
                    Energy
                  </span>
                  <FilledDots
                    filled={energy}
                    total={5}
                    color="var(--color-orange-400)"
                  />
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
