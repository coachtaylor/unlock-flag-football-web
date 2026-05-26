// Legacy /roster/[id] bridge → workspace-scoped player detail.
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export default async function LegacyPlayerDetailRedirect({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: player } = await supabase
    .from("team_players")
    .select("team_id")
    .eq("id", id)
    .maybeSingle();

  if (!player) notFound();
  redirect(`/dashboard/team/${player.team_id}/roster/${id}`);
}
