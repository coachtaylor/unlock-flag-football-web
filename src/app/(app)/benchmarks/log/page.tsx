import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BenchmarkLogClient from "./BenchmarkLogClient";

type SearchParams = Promise<{ drill?: string; players?: string }>;

export default async function BenchmarkLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { drill: drillId, players: playerIdsParam } = await searchParams;

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

  if (!drillId || !playerIdsParam) redirect("/benchmarks");

  const playerIds = playerIdsParam.split(",").filter(Boolean);
  if (playerIds.length === 0) redirect("/benchmarks");

  const { data: drill } = await supabase
    .from("team_drills")
    .select("id, team_id, drill_name, benchmark_type")
    .eq("id", drillId)
    .maybeSingle();

  if (
    !drill ||
    drill.team_id !== teamId ||
    !drill.benchmark_type
  ) {
    redirect("/benchmarks");
  }

  const { data: players } = await supabase
    .from("team_players")
    .select("id, player_name, positions")
    .eq("team_id", teamId)
    .in("id", playerIds);

  const playerMap = new Map(
    (players ?? []).map((p) => [
      p.id as string,
      {
        id: p.id as string,
        name: p.player_name as string,
        positions: (p.positions as string[] | null) ?? [],
      },
    ])
  );

  const orderedPlayers = playerIds
    .map((id) => playerMap.get(id))
    .filter((p): p is { id: string; name: string; positions: string[] } => !!p);

  if (orderedPlayers.length === 0) redirect("/benchmarks");

  return (
    <BenchmarkLogClient
      teamId={teamId}
      userId={user.id}
      drill={{
        id: drill.id as string,
        name: drill.drill_name as string,
        benchmarkType: drill.benchmark_type as "timed" | "rated",
      }}
      players={orderedPlayers}
    />
  );
}
