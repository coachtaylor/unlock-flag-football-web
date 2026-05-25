"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isTeamColorId } from "@/components/uff/team-colors";

type Input = {
  leagueName: string;
  format: "5v5" | "7v7" | "both";
  leagueColorId: string; // one of TEAM_COLOR_IDS — enforced by leagues_league_color_check
};

export async function createOnboardingLeague(input: Input) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" } as const;

  const name = input.leagueName.trim();
  if (!name) return { error: "League name is required." } as const;
  if (name.length > 80) return { error: "League name must be 80 characters or fewer." } as const;
  if (!isTeamColorId(input.leagueColorId)) {
    return { error: "Invalid league color." } as const;
  }

  // create_league_with_admin(p_league_name text, p_format text, p_league_color text)
  // p_league_color must be one of the 8 ids (leagues_league_color_check).
  const { data: newLeagueId, error: rpcError } = await supabase.rpc(
    "create_league_with_admin",
    {
      p_league_name: name,
      p_format: input.format,
      p_league_color: input.leagueColorId,
    }
  );

  if (rpcError) return { error: rpcError.message } as const;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      onboarding_step: 4,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message } as const;

  redirect(`/dashboard/league/${newLeagueId}`);
}
