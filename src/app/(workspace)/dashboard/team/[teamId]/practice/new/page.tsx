// /dashboard/team/[teamId]/practice/new — create a draft plan for THIS team,
// then bounce to the editor (Build 8 pt 2). Team comes from the route, not the
// user's "first" team.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTeams, canManageTeam } from "@/lib/access/teams";
import { createPlanDraft } from "@/lib/practice/actions";

export const dynamic = "force-dynamic";

export default async function NewPracticePlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  // Carries the scouting "Plan…" deep-link through draft creation: focusSkill
  // expands the recommendations drawer to a skill; fromScouting opens the drawer
  // even for group-level CTAs that have no specific skill.
  searchParams: Promise<{ focusSkill?: string; fromScouting?: string }>;
}) {
  const { teamId } = await params;
  const { focusSkill, fromScouting } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const teams = await getAccessibleTeams(supabase, user.id);
  const team = teams.find((t) => t.id === teamId);
  if (!team) notFound();
  // View-only members can't create plans — send them back to the list.
  if (!canManageTeam(team)) redirect(`/dashboard/team/${teamId}/practice`);

  const id = await createPlanDraft(teamId);
  const qp = new URLSearchParams();
  if (fromScouting) qp.set("fromScouting", fromScouting);
  if (focusSkill) qp.set("focusSkill", focusSkill);
  const qs = qp.toString();
  redirect(`/dashboard/team/${teamId}/practice/${id}/edit${qs ? `?${qs}` : ""}`);
}
