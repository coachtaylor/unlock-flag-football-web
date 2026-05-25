"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Input = {
  teamName: string;
  format: "4v4" | "5v5" | "7v7" | "11v11";
  teamColorHex: string;
  leagueId: string | null; // null = standalone
  coachIt: boolean; // ignored when leagueId is null (coach is implied)
};

export async function createTeam(input: Input) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" } as const;

  const name = input.teamName.trim();
  if (!name) return { error: "Team name is required." } as const;
  if (name.length > 80) return { error: "Team name must be 80 characters or fewer." } as const;

  // Standalone team always implies the creator is the coach. League
  // teams respect the coachIt flag — if false, no team_members row is
  // created for the creator (they're admin via league_members).
  const role = input.leagueId === null || input.coachIt ? "coach" : null;

  const { data: newTeamId, error: rpcError } = await supabase.rpc(
    "create_team_with_member",
    {
      p_team_name: name,
      p_organization_name: null,
      p_format: input.format,
      p_team_color: input.teamColorHex,
      p_coach_names: [],
      p_captain_names: [],
      p_role: role,
      p_league_id: input.leagueId,
    }
  );

  if (rpcError) return { error: rpcError.message } as const;

  redirect(`/dashboard/team/${newTeamId}`);
}
