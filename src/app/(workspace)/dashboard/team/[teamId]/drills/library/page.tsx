// /drills/library — Browse the global preset drill library and clone
// drills into the active team. Mirrors the /drills page shell (TeamSidebar
// + DashTopBar + .uff-web wrapper). Data fetched by loadPresetLibrary.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { memberCanManage } from "@/lib/team/staff-roles";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { Icon } from "@/components/uff/icons";
import { teamColorHex } from "@/components/uff/team-colors";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { loadPresetLibrary } from "@/lib/drills/preset-library-data";
import PresetLibraryClient from "./PresetLibraryClient";

export const dynamic = "force-dynamic";

export default async function PresetLibraryPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: teamRow }, { data: membership }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("teams")
        .select("id, team_name, format, team_color, league_id")
        .eq("id", teamId)
        .maybeSingle(),
      supabase
        .from("team_members")
        .select("role, captain_view_only")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .maybeSingle(),
    ]);

  if (!teamRow) notFound();

  // Cloning writes to the team — require a full-access member OR league admin.
  let isLeagueAdmin = false;
  if (!membership && teamRow.league_id) {
    const { data: leagueMember } = await supabase
      .from("league_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("league_id", teamRow.league_id as string)
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

  const base = `/dashboard/team/${teamId}/drills`;
  const teamColor = teamColorHex(teamRow.team_color as string | null);

  const [{ presets, skills }, sidebarWorkspaces] = await Promise.all([
    loadPresetLibrary(supabase, teamId),
    loadSidebarWorkspaces(teamId, teamRow.league_id as string | null),
  ]);

  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  const totalPresets = presets.length;
  const clonedCount = presets.filter((p) => p.alreadyCloned).length;
  const kicker = clonedCount
    ? `${totalPresets} presets · ${clonedCount} already in your library`
    : `${totalPresets} presets · pick the ones your team needs`;

  return (
    <div className="uff-web">
      <TeamSidebar
        active="drills"
        teamId={teamId}
        teamColor={teamColor}
        teamName={teamRow.team_name as string}
        leagueId={teamRow.league_id as string | null}
        user={{
          firstName: profile?.first_name ?? user.email ?? "",
          lastName: profile?.last_name ?? "",
        }}
        workspaces={sidebarWorkspaces}
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={[
            {
              label: teamRow.team_name as string,
              href: `/dashboard/team/${teamId}`,
            },
            { label: "Drill library", href: base },
          ]}
          title="Preset library"
          kicker={kicker}
          userInitials={initials}
          showSearch={false}
          actions={
            <Link href={base} className="wbtn">
              <Icon.arrowLeft size={13} /> Back to drills
            </Link>
          }
        />

        <div
          className="page"
          style={{ maxWidth: 1320, margin: "0 auto", width: "100%" }}
        >
          <PresetLibraryClient
            presets={presets}
            skills={skills}
            teamId={teamId}
          />
        </div>
      </div>
    </div>
  );
}
