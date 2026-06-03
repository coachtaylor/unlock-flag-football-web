// Legacy redirect (Build 8): the drill library moved under
// /dashboard/team/[teamId]/drills. Old /drills/[id] links (dashboard widget
// pulses, practice plans, bookmarks) resolve the drill's team and forward to
// the team-scoped detail page transparently.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LegacyDrillRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: drill } = await supabase
    .from("team_drills")
    .select("team_id")
    .eq("id", id)
    .maybeSingle();
  if (!drill?.team_id) redirect("/dashboard");
  redirect(`/dashboard/team/${drill.team_id as string}/drills/${id}`);
}
