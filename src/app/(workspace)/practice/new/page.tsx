// Redirect resolver for the retired flat /practice/new (Build 8 pt 2). No team
// in the URL to scope the new plan to, so bounce to the dashboard.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyPracticeNewRedirect() {
  redirect("/dashboard");
}
