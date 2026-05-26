// /practice/new — create a draft plan, then bounce to the editor.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTeams } from "@/lib/access/teams";
import { createPlanDraft } from "@/lib/practice/actions";

export const dynamic = "force-dynamic";

export default async function NewPracticePlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const teams = await getAccessibleTeams(supabase, user.id);
  if (teams.length === 0) redirect("/onboarding/scope");
  const primary = teams.find((t) => t.via === "team_member") ?? teams[0];
  const id = await createPlanDraft(primary.id);
  redirect(`/practice/${id}/edit`);
}
