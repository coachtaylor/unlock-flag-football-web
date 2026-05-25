import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BenchmarksHubClient from "./BenchmarksHubClient";

type SearchParams = Promise<{ drill?: string }>;

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
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/team-setup");
  const teamId = membership.team_id;

  const [{ data: drills }, { data: players }] = await Promise.all([
    supabase
      .from("team_drills")
      .select("id, drill_name, benchmark_type, status")
      .eq("team_id", teamId)
      .eq("status", "published")
      .not("benchmark_type", "is", null)
      .order("drill_name", { ascending: true }),
    supabase
      .from("team_players")
      .select("id, player_name, positions")
      .eq("team_id", teamId)
      .eq("status", "active")
      .order("player_name", { ascending: true }),
  ]);

  const drillRows = (drills ?? []).map((d) => ({
    id: d.id as string,
    name: d.drill_name as string,
    benchmarkType: d.benchmark_type as "timed" | "rated",
  }));

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
