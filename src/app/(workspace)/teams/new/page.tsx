import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { teamColorHex } from "@/components/uff/team-colors";
import AddTeamClient from "./AddTeamClient";

export default async function AddTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string; standalone?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: leagueRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("league_members")
      .select("league_id, leagues!inner(id, league_name, league_color, format)")
      .eq("user_id", user.id)
      .eq("role", "league_admin"),
  ]);

  type EmbeddedLeague = {
    id: string;
    league_name: string;
    league_color: string;
    format: string;
  };
  // Resolve color id → hex once here so the client only sees hex.
  const userLeagues = (leagueRows ?? [])
    .map((r) => {
      const raw = r.leagues as EmbeddedLeague | EmbeddedLeague[] | null;
      return Array.isArray(raw) ? raw[0] ?? null : raw;
    })
    .filter((l): l is EmbeddedLeague => !!l)
    .map((l) => ({ ...l, league_color: teamColorHex(l.league_color) }));

  const { leagueId, standalone } = await searchParams;
  const presetLeague = leagueId
    ? userLeagues.find((l) => l.id === leagueId)
    : null;
  // `?standalone=1` from any "Add standalone team" link on the
  // dashboard. Ignored if a leagueId preset is also present (preset
  // wins).
  const forceStandalone = standalone === "1" && !presetLeague;

  // If a preset is given but the user isn't an admin of it, ignore it.
  return (
    <AddTeamClient
      user={{
        firstName: profile?.first_name ?? user.email ?? "",
        lastName: profile?.last_name ?? "",
        email: user.email ?? "",
      }}
      userLeagues={userLeagues}
      presetLeagueId={presetLeague?.id ?? null}
      forceStandalone={forceStandalone}
    />
  );
}
