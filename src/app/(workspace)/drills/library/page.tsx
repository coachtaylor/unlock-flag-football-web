// /drills/library — Browse the global preset drill library and clone
// drills into the active team. Mirrors the /drills page shell (TeamSidebar
// + DashTopBar + .uff-web wrapper). Data fetched by loadPresetLibrary.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleTeams } from "@/lib/access/teams";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { Icon } from "@/components/uff/icons";
import { teamColorHex } from "@/components/uff/team-colors";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { loadPresetLibrary } from "@/lib/drills/preset-library-data";
import PresetLibraryClient from "./PresetLibraryClient";

export const dynamic = "force-dynamic";

export default async function PresetLibraryPage() {
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

  const accessibleTeams = await getAccessibleTeams(supabase, user.id);
  if (accessibleTeams.length === 0) redirect("/onboarding/scope");

  // Match the /drills page convention: prefer a direct team_member over
  // a league_admin team when picking the "primary" surface for cloning.
  // The preset library writes to a single team — the user's primary one
  // — and surfaces a team chip on the sidebar so the destination is
  // unambiguous. Multi-team users get the same sidebar team switcher
  // they're used to.
  const primary =
    accessibleTeams.find((t) => t.via === "team_member") ?? accessibleTeams[0];

  const { data: teamRow } = await supabase
    .from("teams")
    .select("id, team_name, format, team_color, league_id")
    .eq("id", primary.id)
    .maybeSingle();
  if (!teamRow) redirect("/dashboard");

  const teamId = teamRow.id as string;
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
            { label: "Drill library", href: "/drills" },
          ]}
          title="Preset library"
          kicker={kicker}
          userInitials={initials}
          showSearch={false}
          actions={
            <Link href="/drills" className="wbtn">
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
