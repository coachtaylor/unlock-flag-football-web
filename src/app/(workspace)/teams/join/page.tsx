// /teams/join — Add yourself to an existing team by team ID.
// The team ID acts as the invite code; whoever has it can join.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinTeamClient from "./JoinTeamClient";

export const dynamic = "force-dynamic";

export default async function JoinTeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <JoinTeamClient />;
}
