// Legacy /roster bridge — Build 6 moved the roster into the workspace
// group under /dashboard/team/[teamId]/roster. Old bookmarks land here;
// we resolve the user's first team membership and forward them.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LegacyRosterRedirect() {
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
  redirect(`/dashboard/team/${membership.team_id}/roster`);
}
