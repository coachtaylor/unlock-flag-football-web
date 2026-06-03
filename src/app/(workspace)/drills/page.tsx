// Legacy redirect (Build 8): the team drill library moved to
// /dashboard/team/[teamId]/drills. A bare /drills link has no team context,
// so send the user to their dashboard to pick a team.

import { redirect } from "next/navigation";

export default function LegacyDrillsRedirect() {
  redirect("/dashboard");
}
