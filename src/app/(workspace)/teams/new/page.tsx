import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddTeamClient from "./AddTeamClient";

export default async function AddTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string }>;
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
  const userLeagues = (leagueRows ?? [])
    .map((r) => {
      const raw = r.leagues as EmbeddedLeague | EmbeddedLeague[] | null;
      return Array.isArray(raw) ? raw[0] ?? null : raw;
    })
    .filter((l): l is EmbeddedLeague => !!l);

  const { leagueId } = await searchParams;
  const presetLeague = leagueId
    ? userLeagues.find((l) => l.id === leagueId)
    : null;

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
    />
  );
}
