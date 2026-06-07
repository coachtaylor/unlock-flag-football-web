// Legacy (app)/benchmarks — DEMOTED (Build 8.7 Phase 5).
//
// The web benchmark surface is now the read-first Team Scouting Report at
// /dashboard/team/[teamId]/benchmarks (the team sidebar already points there).
// Per the locked product decision, web is reflection-first — benchmark capture
// happens in-person/mobile — so this orphaned write-hub just forwards.
//
// Auto-route ONLY when the team is unambiguous (a single accessible team). With
// 2+ teams we send the user to /dashboard to pick, rather than guessing a "first
// team" (the documented mis-routing antipattern).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTeams } from "@/lib/access/teams";

export const dynamic = "force-dynamic";

export default async function LegacyBenchmarksRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const teams = await getAccessibleTeams(supabase, user.id);
  if (teams.length === 1) {
    redirect(`/dashboard/team/${teams[0].id}/benchmarks`);
  }
  redirect("/dashboard");
}
