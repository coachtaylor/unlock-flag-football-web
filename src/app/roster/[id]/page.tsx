import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlayerStatusButton from "./PlayerStatusButton";

type Props = { params: Promise<{ id: string }> };

type BenchmarkRow = {
  id: string;
  assessment_date: string;
  time_seconds: number | null;
  rating: number | null;
  tags: string[] | null;
  notes: string | null;
  team_drills:
    | { drill_name: string; benchmark_type: "timed" | "rated" | null }
    | { drill_name: string; benchmark_type: "timed" | "rated" | null }[]
    | null;
};

type Grouped = {
  drillName: string;
  benchmarkType: "timed" | "rated" | null;
  results: BenchmarkRow[];
};

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PlayerDetailPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/team-setup");

  const [{ data: player }, { data: benchmarks }] = await Promise.all([
    supabase
      .from("team_players")
      .select(
        "id, team_id, player_name, positions, jersey_number, status, notes"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("benchmark_results")
      .select(
        "id, assessment_date, time_seconds, rating, tags, notes, team_drills(drill_name, benchmark_type)"
      )
      .eq("player_id", id)
      .order("assessment_date", { ascending: false }),
  ]);

  if (!player || player.team_id !== membership.team_id) notFound();

  const positions = (player.positions as string[] | null) ?? [];
  const jerseyNumber = player.jersey_number as string | null;
  const status = player.status as "active" | "inactive";
  const notes = player.notes as string | null;

  const grouped: Grouped[] = [];
  const groupIndex = new Map<string, number>();
  for (const b of (benchmarks ?? []) as BenchmarkRow[]) {
    const dr = Array.isArray(b.team_drills) ? b.team_drills[0] : b.team_drills;
    const drillName = dr?.drill_name ?? "Unknown drill";
    const benchmarkType = dr?.benchmark_type ?? null;
    const key = `${drillName}::${benchmarkType ?? ""}`;
    let idx = groupIndex.get(key);
    if (idx === undefined) {
      idx = grouped.length;
      groupIndex.set(key, idx);
      grouped.push({ drillName, benchmarkType, results: [] });
    }
    grouped[idx].results.push(b);
  }

  return (
    <div className="pt-3xl pb-2xl">
      <Link
        href="/roster"
        className="text-caption no-underline"
        style={{ color: "var(--color-text-secondary)" }}
      >
        ← Back to Roster
      </Link>

      <div className="flex items-baseline gap-md mt-md flex-wrap">
        <h1
          className="text-title font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          {player.player_name as string}
        </h1>
        {jerseyNumber && (
          <span
            className="text-heading tabular-nums"
            style={{ color: "var(--color-text-secondary)" }}
          >
            #{jerseyNumber}
          </span>
        )}
      </div>

      <p
        className="text-caption mt-sm"
        style={{
          color:
            status === "active"
              ? "var(--color-green-400)"
              : "var(--color-text-muted)",
        }}
      >
        {status === "active" ? "Active" : "Inactive"}
      </p>

      {positions.length > 0 && (
        <div className="flex items-center gap-xs mt-md flex-wrap">
          {positions.map((pos) => (
            <span
              key={pos}
              className="label-micro rounded-pill"
              style={{
                padding: "2px 8px",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {pos}
            </span>
          ))}
        </div>
      )}

      {notes && (
        <div className="mt-2xl">
          <p
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Notes
          </p>
          <p
            className="text-body mt-sm whitespace-pre-wrap"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {notes}
          </p>
        </div>
      )}

      <div className="mt-3xl">
        <h2
          className="text-heading font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          Benchmark Results
        </h2>

        {grouped.length === 0 ? (
          <div
            className="mt-lg p-2xl rounded-lg text-center"
            style={{
              backgroundColor: "var(--color-surface-base)",
              border: "1px dashed var(--color-border-default)",
            }}
          >
            <p
              className="text-body"
              style={{ color: "var(--color-text-muted)" }}
            >
              No benchmark data yet. Run an assessment to see results here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-md mt-lg">
            {grouped.map((group) => {
              const latest = group.results[0];
              const valueLabel =
                group.benchmarkType === "timed" && latest.time_seconds != null
                  ? `${Number(latest.time_seconds).toFixed(2)}s`
                  : group.benchmarkType === "rated" && latest.rating != null
                    ? `${latest.rating}/5`
                    : latest.time_seconds != null
                      ? `${Number(latest.time_seconds).toFixed(2)}s`
                      : latest.rating != null
                        ? `${latest.rating}/5`
                        : "—";
              const tags = latest.tags ?? [];
              return (
                <div
                  key={`${group.drillName}-${group.benchmarkType ?? ""}`}
                  className="p-lg rounded-lg"
                  style={{
                    backgroundColor: "var(--color-surface-base)",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <div className="flex items-start justify-between gap-md">
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-body font-medium"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {group.drillName}
                      </p>
                      <p
                        className="text-caption mt-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {formatDate(latest.assessment_date)}
                        {group.results.length > 1 &&
                          ` · ${group.results.length} results`}
                      </p>
                    </div>
                    <span
                      className="text-stat tabular-nums flex-shrink-0"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {valueLabel}
                    </span>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex items-center gap-xs mt-md flex-wrap">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="label-micro rounded-pill"
                          style={{
                            padding: "2px 8px",
                            backgroundColor: "rgba(255,255,255,0.04)",
                            color: "rgba(255,255,255,0.55)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3xl">
        <Link
          href={`/roster/${player.id}/edit`}
          className="w-full block py-lg rounded-xl text-body font-medium tracking-wide text-center no-underline"
          style={{
            backgroundColor: "var(--color-orange-500)",
            color: "#FFFFFF",
            letterSpacing: "0.3px",
          }}
        >
          Edit Player
        </Link>

        <PlayerStatusButton
          playerId={player.id as string}
          status={status}
        />
      </div>
    </div>
  );
}
