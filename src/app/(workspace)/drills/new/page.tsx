// /drills/new — Drill form, create mode (Web Build 4).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { teamColorHex } from "@/components/uff/team-colors";
import { categoryToSlug } from "@/components/uff-web/drills/atoms";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import DrillForm from "../DrillForm";

export const dynamic = "force-dynamic";

export default async function NewDrillPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding/scope");
  const teamId = membership.team_id as string;

  const [{ data: team }, { data: categories }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, team_name, team_color, league_id")
      .eq("id", teamId)
      .maybeSingle(),
    supabase
      .from("drill_categories")
      .select("id, category_name, category_type, display_order")
      .or(`team_id.is.null,team_id.eq.${teamId}`)
      .order("display_order", { ascending: true })
      .order("category_name", { ascending: true }),
  ]);

  if (!team) redirect("/dashboard");

  const sidebarWorkspaces = await loadSidebarWorkspaces(
    teamId,
    (team.league_id as string | null) ?? null,
  );

  const cats = (categories ?? []).map((c) => {
    const name = c.category_name as string;
    return {
      id: c.id as string,
      name,
      slug: categoryToSlug(name),
      type: ((c.category_type as string) === "phase"
        ? "phase"
        : "skill") as "phase" | "skill",
    };
  });

  const firstName = (profile?.first_name as string | null) ?? "";
  const lastName = (profile?.last_name as string | null) ?? "";
  const initials =
    `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  return (
    <DrillForm
      team={{
        id: team.id as string,
        name: team.team_name as string,
        color: teamColorHex(team.team_color as string | null),
        leagueId: (team.league_id as string | null) ?? null,
      }}
      user={{ firstName, lastName, initials }}
      categories={cats}
      sidebarWorkspaces={sidebarWorkspaces}
    />
  );
}
