// /drills/from-link/[jobId] — Review an AI draft, then save it (build-11).
//
// Loads an ai_drill_jobs row and renders the DrillForm in CREATE mode, seeded
// from the job's draft_json when the job is `ready`. no_signal/failed jobs
// still open the manual form, carrying only the source link so the coach can
// build the drill by hand without re-pasting.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { memberCanManage } from "@/lib/team/staff-roles";
import { teamColorHex } from "@/components/uff/team-colors";
import { categoryToSlug } from "@/components/uff-web/drills/atoms";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { loadAllSkills } from "@/lib/drills/skills-data";
import type { DrillDraft } from "@/lib/ai-drill/types";
import DrillForm from "../../DrillForm";

export const dynamic = "force-dynamic";

export default async function FromLinkPage({
  params,
}: {
  params: Promise<{ teamId: string; jobId: string }>;
}) {
  const { teamId, jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("ai_drill_jobs")
    .select("id, team_id, status, source_url, source_kind, draft_json")
    .eq("id", jobId)
    .maybeSingle();

  if (!job || (job.team_id as string) !== teamId) notFound();

  const [{ data: profile }, { data: team }, { data: membership }, { data: categories }, skillsCatalog] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("teams")
        .select("id, team_name, team_color, league_id")
        .eq("id", teamId)
        .maybeSingle(),
      supabase
        .from("team_members")
        .select("role, captain_view_only")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .maybeSingle(),
      supabase
        .from("drill_categories")
        .select("id, category_name, category_type, display_order")
        .or(`team_id.is.null,team_id.eq.${teamId}`)
        .order("display_order", { ascending: true })
        .order("category_name", { ascending: true }),
      loadAllSkills(supabase),
    ]);

  if (!team) notFound();

  // Saving a drill is a write — require a full-access member OR league admin.
  let isLeagueAdmin = false;
  if (!membership && team.league_id) {
    const { data: leagueMember } = await supabase
      .from("league_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("league_id", team.league_id as string)
      .eq("role", "league_admin")
      .maybeSingle();
    isLeagueAdmin = !!leagueMember;
  }
  const canManage =
    memberCanManage(
      membership?.role as string | null,
      membership?.captain_view_only as boolean | null
    ) || isLeagueAdmin;
  if (!canManage) redirect(`/dashboard/team/${teamId}/drills`);

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

  // Only a `ready` job carries a usable draft. no_signal/failed → manual form
  // that still remembers the source link.
  const draft =
    job.status === "ready"
      ? ((job.draft_json as DrillDraft | null) ?? null)
      : null;

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
      skills={skillsCatalog.skills}
      sidebarWorkspaces={sidebarWorkspaces}
      initialDraft={draft}
      aiJobId={job.id as string}
      sourceUrl={job.source_url as string | null}
      sourcePlatform={job.source_kind as string | null}
    />
  );
}
