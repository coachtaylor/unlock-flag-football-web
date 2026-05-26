import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LegacyNewPlayerRedirect() {
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

  if (!membership) redirect("/onboarding/scope");
  redirect(`/dashboard/team/${membership.team_id}/roster/new`);
}
