// Legacy redirect (Build 8): the preset library moved to
// /dashboard/team/[teamId]/drills/library. A bare /drills/library link has no
// team context, so send the user to their dashboard to pick a team.

import { redirect } from "next/navigation";

export default function LegacyDrillsLibraryRedirect() {
  redirect("/dashboard");
}
