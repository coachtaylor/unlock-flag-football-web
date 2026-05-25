"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Input = {
  teamName: string;
  format: "5v5" | "7v7" | "11v11";
  teamColorHex: string;
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

  // RPC create_team_with_member overload:
  // (p_team_name, p_organization_name, p_format, p_team_color,
  //  p_coach_names, p_captain_names, p_role, p_league_id)
  const { data: newTeamId, error: rpcError } = await supabase.rpc(
    "create_team_with_member",
    {
      p_team_name: name,
      p_organization_name: null,
      p_format: input.format,
      p_team_color: input.teamColorHex,
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
