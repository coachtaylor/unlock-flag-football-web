import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlayerForm from "../PlayerForm";

export default async function NewPlayerPage() {
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

  return <PlayerForm teamId={membership.team_id as string} />;
}
