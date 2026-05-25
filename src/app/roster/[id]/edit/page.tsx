import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlayerForm, { type PlayerFormInitial } from "../../PlayerForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditPlayerPage({ params }: Props) {
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

  const { data: player } = await supabase
    .from("team_players")
    .select("id, team_id, player_name, positions, jersey_number, notes")
    .eq("id", id)
    .maybeSingle();

  if (!player || player.team_id !== membership.team_id) notFound();

  const initial: PlayerFormInitial = {
    id: player.id as string,
    playerName: (player.player_name as string) ?? "",
    positions: (player.positions as string[] | null) ?? [],
    jerseyNumber: (player.jersey_number as string | null) ?? "",
    notes: (player.notes as string | null) ?? "",
  };

  return <PlayerForm teamId={membership.team_id as string} initial={initial} />;
}
