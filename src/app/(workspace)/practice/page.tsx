// Redirect resolver for the retired flat /practice list (Build 8 pt 2).
// Practice is now team-scoped under /dashboard/team/[teamId]/practice. A bare
// /practice has no team in the URL to resolve, so send the user to their
// dashboard, where they pick a team and reach that team's planner.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyPracticeListRedirect() {
  redirect("/dashboard");
}
