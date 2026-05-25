"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isTeamColorId } from "@/components/uff/team-colors";

type Input = {
  teamName: string;
  format: "5v5" | "7v7" | "11v11";
  teamColorId: string; // one of TEAM_COLOR_IDS — enforced by teams_team_color_chk
  role: "coach" | "captain";
};

export async function createOnboardingTeam(input: Input) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" } as const;

  const name = input.teamName.trim();
  if (!name) return { error: "Team name is required." } as const;
  if (name.length > 80) return { error: "Team name must be 80 characters or fewer." } as const;
  if (!isTeamColorId(input.teamColorId)) {
    return { error: "Invalid team color." } as const;
  }

  // create_team_with_member(p_team_name, p_organization_name, p_format,
  //   p_team_color, p_coach_names, p_captain_names, p_role, p_league_id).
  // p_team_color must be one of the 8 ids (teams_team_color_chk).
  const { data: newTeamId, error: rpcError } = await supabase.rpc(
    "create_team_with_member",
    {
      p_team_name: name,
      p_organization_name: null,
      p_format: input.format,
      p_team_color: input.teamColorId,
      p_coach_names: [],
      p_captain_names: [],
      p_role: input.role,
      p_league_id: null,
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

  redirect(`/dashboard/team/${newTeamId}`);
}
