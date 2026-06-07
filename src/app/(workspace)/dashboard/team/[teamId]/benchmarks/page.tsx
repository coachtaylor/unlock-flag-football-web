// Team Scouting Report (Build 8.7) — the read-first analytical surface that
// replaces the orphaned (app)/benchmarks "Run Assessment" write flow on web.
// Capture happens in-person/mobile; this page turns the resulting
// benchmark_results into a defensible team + player read that drives the plan.
//
// Reuses the team dashboard's access gate + shell verbatim and its data layer
// (loadTeamFocus / loadTeamSkillRadar via loadTeamScoutingData) so figures can't
// drift from the dashboard. Narrative spine §0→§4, top to bottom.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { teamColorHex } from "@/components/uff/team-colors";
import { memberCanManage } from "@/lib/team/staff-roles";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { loadTeamScoutingData } from "@/lib/dashboard/team-scouting-data";
import {
  ScoutingHeadlineCard,
  PositionRooms,
  MovementStrips,
  PlayerReportGrid,
} from "@/components/dashboard/scouting/ScoutingSections";

export const dynamic = "force-dynamic";

export default async function ScoutingReportPage({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: team } = await supabase
    .from("teams")
    .select("id, team_name, format, team_color, league_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) notFound();

  // ── Access gate (mirrors team dashboard page: member → league-admin fallback) ──
  const { data: membership } = await supabase
    .from("team_members")
    .select("role, captain_view_only")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .maybeSingle();

  const membershipRole = (membership?.role as string | null) ?? null;
  let canView = !!membership;
  let isLeagueAdmin = false;
  if (!canView && team.league_id) {
    const { data: leagueMember } = await supabase
      .from("league_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("league_id", team.league_id)
      .eq("role", "league_admin")
      .maybeSingle();
    isLeagueAdmin = !!leagueMember;
    canView = isLeagueAdmin;
  }
  if (!canView) notFound();

  const canManage =
    memberCanManage(membershipRole, membership?.captain_view_only as boolean | null) ||
    isLeagueAdmin;

  const [data, sidebarWorkspaces] = await Promise.all([
    loadTeamScoutingData(supabase, teamId),
    loadSidebarWorkspaces(teamId, team.league_id),
  ]);

  const teamColor = teamColorHex(team.team_color);
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  return (
    <div className="uff-web">
      <TeamSidebar
        active="benchmarks"
        teamId={teamId}
        teamColor={teamColor}
        teamName={team.team_name}
        leagueId={team.league_id}
        user={{
          firstName: profile?.first_name ?? user.email ?? "",
          lastName: profile?.last_name ?? "",
        }}
        workspaces={sidebarWorkspaces}
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={
            team.league_id
              ? [{ label: "League", href: `/dashboard/league/${team.league_id}` }]
              : []
          }
          title="Scouting report"
          kicker={team.team_name}
          userInitials={initials}
        />

        <div className="page scout-page" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          {!data.anyData ? (
            <ColdStart teamId={teamId} canManage={canManage} />
          ) : (
            <>
              <ScoutingHeadlineCard headline={data.headline} teamId={teamId} />
              <PositionRooms rooms={data.rooms} />
              <MovementStrips movers={data.movers} />
              <PlayerReportGrid cards={data.playerCards} />
              <DoThisNext
                teamId={teamId}
                drillName={data.headline.ctaDrillName}
                roomLabel={data.headline.weakestRoomLabel}
                skillLabel={data.headline.weakestRoomSkillLabel}
                focusSkillId={data.headline.focusSkillId}
                canManage={canManage}
              />
            </>
          )}
        </div>
      </div>

      <style>{`
        .scout-page { display: flex; flex-direction: column; gap: 16px; }
        .scout-rooms {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 640px) {
          .scout-rooms { grid-template-columns: repeat(3, 1fr); }
        }
        .scout-room {
          border: 1px solid var(--uff-line-soft);
          border-radius: 10px;
          padding: 14px;
          background: rgba(255,255,255,0.015);
        }
        .scout-players {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .scout-player-card {
          border: 1px solid var(--uff-line-soft);
          border-radius: 10px;
          padding: 12px;
          background: rgba(255,255,255,0.015);
        }
        @media (min-width: 640px) {
          .scout-players { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
          .scout-players { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  );
}

function DoThisNext({
  teamId,
  drillName,
  roomLabel,
  skillLabel,
  focusSkillId,
  canManage,
}: {
  teamId: string;
  drillName: string | null;
  roomLabel: string | null;
  skillLabel: string | null;
  focusSkillId: string | null;
  canManage: boolean;
}) {
  const href = focusSkillId
    ? `/dashboard/team/${teamId}/practice/new?focusSkill=${focusSkillId}`
    : `/dashboard/team/${teamId}/practice/new`;
  const gap = skillLabel ?? roomLabel;
  return (
    <div className="w-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionTitle>Do this next</SectionTitle>
      <div style={{ fontSize: 13.5, color: "var(--uff-text-dim)", lineHeight: 1.5 }}>
        {gap
          ? `${roomLabel ? `${roomLabel} needs work` : "Your weakest area"}${skillLabel ? ` — ${skillLabel}` : ""}. ${drillName ? `Schedule ${drillName} to target it.` : "Schedule a drill that trains it."}`
          : "Run a few benchmarks to get a recommendation here."}
      </div>
      {canManage && (
        <div>
          <Link href={href} className="wbtn">
            {drillName ? `Add ${drillName} to a practice` : "Plan a practice"} →
          </Link>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--uff-text-mute)",
      }}
    >
      {children}
    </span>
  );
}

function ColdStart({ teamId, canManage }: { teamId: string; canManage: boolean }) {
  return (
    <div
      className="w-card"
      style={{
        padding: 36,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ fontSize: 19, color: "var(--uff-text)" }}>No scouting signal yet</div>
      <div
        style={{
          fontSize: 13.5,
          color: "var(--uff-text-dim)",
          maxWidth: 440,
          lineHeight: 1.6,
        }}
      >
        Tag drills with skills, then run benchmark assessments on 3+ players. As results land,
        this page builds your team&rsquo;s strengths, gaps, and who to focus on.
      </div>
      {canManage && (
        <Link href={`/dashboard/team/${teamId}/drills`} className="wbtn">
          Go to drills →
        </Link>
      )}
    </div>
  );
}
