import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BenchKind } from "@/components/uff-web/drills/atoms";
import { memberCanManage } from "@/lib/team/staff-roles";
import BenchmarksHubClient from "./BenchmarksHubClient";

type SearchParams = Promise<{ drill?: string }>;

const VALID_KINDS: ReadonlySet<string> = new Set([
  "timed",
  "rated",
  "reps",
  "pct",
  "flags",
  "drops",
]);

function coalesceTypes(
  benchmarkTypes: string[] | null,
  benchmarkType: string | null,
): BenchKind[] {
  const out: BenchKind[] = [];
  const seen = new Set<string>();
  for (const t of benchmarkTypes ?? []) {
    if (t && VALID_KINDS.has(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t as BenchKind);
    }
  }
  if (out.length === 0 && benchmarkType && VALID_KINDS.has(benchmarkType)) {
    out.push(benchmarkType as BenchKind);
  }
  return out;
}

export default async function BenchmarksHubPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { drill: preselectedDrillId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, role, captain_view_only")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/team-setup");
  const teamId = membership.team_id;

  // Benchmarking is a write flow — view-only members get a notice.
  if (
    !memberCanManage(
      membership.role as string | null,
      membership.captain_view_only as boolean | null
    )
  ) {
    return (
      <div className="pt-3xl" style={{ maxWidth: 560 }}>
        <h1 className="text-title font-medium" style={{ color: "var(--color-text-primary)" }}>
          Benchmarks
        </h1>
        <div
          className="mt-2xl p-lg rounded-lg"
          style={{ backgroundColor: "var(--color-surface-raised)" }}
        >
          <p className="text-body" style={{ color: "var(--color-text-muted)" }}>
            You have view-only access to this team, so you can&rsquo;t run
            benchmark assessments. A coach or full-access captain can log
            results; you&rsquo;ll see them on player and dashboard views.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: drills }, { data: players }] = await Promise.all([
    supabase
      .from("team_drills")
      .select("id, drill_name, benchmark_type, benchmark_types, status")
      .eq("team_id", teamId)
      .eq("status", "published")
      .order("drill_name", { ascending: true }),
    supabase
      .from("team_players")
      .select("id, player_name, positions")
      .eq("team_id", teamId)
      .eq("status", "active")
      .order("player_name", { ascending: true }),
  ]);

  const drillRows = (drills ?? [])
    .map((d) => ({
      id: d.id as string,
      name: d.drill_name as string,
      benchmarkTypes: coalesceTypes(
        d.benchmark_types as string[] | null,
        d.benchmark_type as string | null,
      ),
    }))
    .filter((d) => d.benchmarkTypes.length > 0);

  const playerRows = (players ?? []).map((p) => ({
    id: p.id as string,
    name: p.player_name as string,
    positions: (p.positions as string[] | null) ?? [],
  }));

  return (
    <BenchmarksHubClient
      drills={drillRows}
      players={playerRows}
      preselectedDrillId={preselectedDrillId ?? null}
    />
  );
}
