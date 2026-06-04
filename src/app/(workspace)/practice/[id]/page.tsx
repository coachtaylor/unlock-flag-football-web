// Redirect resolver for the retired flat /practice/[id] (Build 8 pt 2).
// Looks up the plan's team and forwards to the team-scoped detail page so old
// bookmarks / deep links keep working without threading teamId everywhere.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LegacyPlanRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("practice_plans")
    .select("team_id")
    .eq("id", id)
    .maybeSingle();
  if (!plan?.team_id) notFound();
  redirect(`/dashboard/team/${plan.team_id}/practice/${id}`);
}
