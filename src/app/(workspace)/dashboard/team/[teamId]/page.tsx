// Team dashboard — Build 7 (widget parity pass).
// Replaces the Build 3 strength/weakness layout with the full UFF Web
// coach console: hero + next-practice + pinned pulses + trends/movers +
// drill mix / cadence / attendance / attention + activity / most-run.
//
// Captain View Toggle: when the logged-in user is a captain of this
// team, a pill toggle appears in the topbar. ?view=player filters
// Pinned Pulses + Attendance to that captain's own player record.
// Other widgets stay team-wide on purpose (see WEB_BUILD_PLAN.md
// Build 7 risk note on scope leak).

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { teamColorHex } from "@/components/uff/team-colors";
import { Icon } from "@/components/uff/icons";
import Link from "next/link";

import { loadTeamDashboard, loadTeamSkillRadar } from "@/lib/dashboard/team-home-data";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import HeroCard from "@/components/dashboard/widgets/HeroCard";
import NextPracticeCard from "@/components/dashboard/widgets/NextPracticeCard";
import PinnedPulsesStrip from "@/components/dashboard/widgets/PinnedPulsesStrip";
import BenchmarkTrendsCard from "@/components/dashboard/widgets/BenchmarkTrendsCard";
import MoversCard from "@/components/dashboard/widgets/MoversCard";
import DrillMixCard from "@/components/dashboard/widgets/DrillMixCard";
import PracticeCadenceCard from "@/components/dashboard/widgets/PracticeCadenceCard";
import AttendanceCard from "@/components/dashboard/widgets/AttendanceCard";
import NeedsAttentionCard from "@/components/dashboard/widgets/NeedsAttentionCard";
import RecentActivityCard from "@/components/dashboard/widgets/RecentActivityCard";
import MostRunDrillsCard from "@/components/dashboard/widgets/MostRunDrillsCard";
import TeamSkillRadarCard from "@/components/dashboard/widgets/TeamSkillRadarCard";
import SectionHead from "@/components/dashboard/widgets/SectionHead";
import CaptainViewToggle from "@/components/dashboard/widgets/CaptainViewToggle";

function greetingFor(name: string | null) {
  const h = new Date().getHours();
  const first = name?.split(/\s+/)[0] || "Coach";
  if (h < 5) return `Late night, ${first}.`;
  if (h < 12) return `Good morning, ${first}.`;
  if (h < 17) return `Good afternoon, ${first}.`;
  return `Good evening, ${first}.`;
}

function weekLabel() {
  const now = new Date();
  // Naive "season week" — count ISO weeks since the start of the
  // current year. Replace with a real season-start when we wire it up.
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.ceil((days + start.getDay() + 1) / 7);
  return `WEEK ${week} · ${now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })}`;
}

export default async function TeamDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { teamId } = await params;
  const sp = await searchParams;
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

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .maybeSingle();

  let canView = !!membership;
  if (!canView && team.league_id) {
    const { data: leagueMember } = await supabase
      .from("league_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("league_id", team.league_id)
      .eq("role", "league_admin")
      .maybeSingle();
    canView = !!leagueMember;
  }
  if (!canView) notFound();

  // Load all widget data in one pass.
  const [data, sidebarWorkspaces, skillRadar] = await Promise.all([
    loadTeamDashboard(supabase, teamId, user.id),
    loadSidebarWorkspaces(teamId, team.league_id),
    loadTeamSkillRadar(supabase, teamId),
  ]);

  const playerView = sp.view === "player" && data.isCurrentUserCaptain;
  // Captain view re-loads the player-scoped slice so pulses + attendance
  // reflect just this captain's data. The rest of the data object is
  // unchanged (team-wide).
  const scopedData = playerView
    ? await loadTeamDashboard(supabase, teamId, user.id, {
        playerScope: data.currentUserPlayerId,
      })
    : null;

  const pulses = scopedData?.pulses ?? data.pulses;
  const attendance = scopedData?.attendance ?? data.attendance;

  const teamColor = teamColorHex(team.team_color);
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  const heroCopy = data.nextPractice
    ? `${data.nextPractice.blockCount || 0} blocks scheduled for ${formatPracticeDate(data.nextPractice.practiceDate)}. ${
        data.attention.length
          ? `${data.attention.length} player${data.attention.length === 1 ? "" : "s"} flagged below.`
          : "Roster is healthy."
      }`
    : "No practice scheduled. Plan one to start building the dashboard's signal.";

  const hasAnyData =
    data.pulses.length ||
    data.movers.length ||
    data.drillMix.total ||
    data.attendance.rate != null ||
    data.cadence.cells.length;

  return (
    <div className="uff-web">
      <TeamSidebar
        active="dashboard"
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
              ? [
                  { label: "League", href: `/dashboard/league/${team.league_id}` },
                ]
              : []
          }
          title={team.team_name}
          kicker={team.format?.toUpperCase()}
          userInitials={initials}
          actions={
            <>
              <CaptainViewToggle isCaptain={data.isCurrentUserCaptain} />
              <Link href="/practice/new" className="wbtn">
                <Icon.plus size={13} /> Plan practice
              </Link>
              <Link href="/benchmarks" className="wbtn primary">
                Run benchmark
              </Link>
            </>
          }
        />

        <div className="page td-page" style={{ maxWidth: 1440, margin: "0 auto", width: "100%" }}>
          {/* Hero + Next practice */}
          <div className="td-row td-row-hero">
            <HeroCard
              greeting={greetingFor(profile?.first_name ?? null)}
              weekLabel={weekLabel()}
              practicesLogged={data.cadence.cells.filter((c) => c.intensity >= 2).length}
              practicesPlanned={data.cadence.cells.length}
              copy={heroCopy}
              stats={data.hero}
              hasNextPractice={!!data.nextPractice}
            />
            <NextPracticeCard practice={data.nextPractice} />
          </div>

          {/* Pinned pulses (KPI strip) */}
          <div>
            <SectionHead
              label={playerView ? "Your pulses" : "Pinned pulses"}
              meta={`${data.pulses.length} / 4`}
            />
            <PinnedPulsesStrip pulses={pulses} />
          </div>

          {/* Trends + Movers */}
          <div className="td-row td-row-trends">
            <div className="w-card">
              <SectionHead label="Benchmark trends" meta="5 WEEKS" />
              <BenchmarkTrendsCard series={data.trendSeries} />
            </div>
            <MoversCard movers={data.movers} teamId={teamId} />
          </div>

          {/* Team skill radar + Needs attention */}
          <div className="td-row td-row-radar">
            <TeamSkillRadarCard data={skillRadar} />
            <NeedsAttentionCard items={data.attention} teamId={teamId} />
          </div>

          {/* Drill mix · Cadence · Attendance (3-up wrap) */}
          <div className="td-row td-row-trio">
            <DrillMixCard
              entries={data.drillMix.entries}
              total={data.drillMix.total}
              underweight={data.drillMix.underweight}
            />
            <PracticeCadenceCard data={data.cadence} />
            <AttendanceCard data={attendance} />
          </div>

          {/* Activity + Most-run drills */}
          <div className="td-row td-row-trends">
            <RecentActivityCard
              rows={data.activity}
              teamId={teamId}
              needsReviewCount={data.needsReviewCount}
            />
            <MostRunDrillsCard rows={data.mostRunDrills} />
          </div>

          {!hasAnyData && (
            <div
              className="w-card"
              style={{
                padding: 32,
                textAlign: "center",
                color: "var(--uff-text-dim)",
                fontSize: 13.5,
                lineHeight: 1.6,
                border: "1px dashed var(--uff-line)",
              }}
            >
              Brand-new team. Pin a drill, log a benchmark, and complete a practice — widgets
              unlock as the data lands.
            </div>
          )}
        </div>
      </div>

      <style>{`
        .td-page { gap: 20px; }
        .td-row { display: grid; gap: 16px; grid-template-columns: 1fr; }
        @media (min-width: 1024px) {
          .td-row-hero { grid-template-columns: 1.4fr 1fr; }
          .td-row-trends { grid-template-columns: 1.6fr 1fr; }
          .td-row-radar { grid-template-columns: 1.5fr 1fr; }
          .td-row-trio { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  );
}

function formatPracticeDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
