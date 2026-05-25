import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RosterListClient from "./RosterListClient";

export default async function RosterPage() {
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

  const { data: players } = await supabase
    .from("team_players")
    .select("id, player_name, positions, jersey_number, status")
    .eq("team_id", teamId)
    .order("player_name", { ascending: true });

  const playerRows = (players ?? []).map((p) => ({
    id: p.id as string,
    name: p.player_name as string,
    positions: (p.positions as string[] | null) ?? [],
    jerseyNumber: (p.jersey_number as string | null) ?? null,
    status: p.status as "active" | "inactive",
  }));

  const activeCount = playerRows.filter((p) => p.status === "active").length;

  return (
    <div className="pt-3xl">
      <div className="flex items-center justify-between">
        <h1
          className="text-title font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          Roster
        </h1>
        <Link
          href="/roster/new"
          className="rounded-pill text-caption font-medium no-underline"
          style={{
            padding: "8px 14px",
            minHeight: "44px",
            display: "inline-flex",
            alignItems: "center",
            backgroundColor: "var(--color-orange-500)",
            color: "#FFFFFF",
            letterSpacing: "0.3px",
          }}
        >
          Add Player
        </Link>
      </div>

      <p
        className="text-caption mt-xs"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {activeCount} {activeCount === 1 ? "player" : "players"}
      </p>

      <RosterListClient players={playerRows} />
    </div>
  );
}
