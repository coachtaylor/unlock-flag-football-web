// Player detail — 2-col workspace page. Left: hero card (avatar, badges,
// mini stats), Quick actions card. Right: time-range chips + a
// HistoryCard per (drill, benchmark_type) pair with a sparkline.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActorName } from "@/lib/activity";
import Byline from "@/components/activity/Byline";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { DashIcon, Icon } from "@/components/uff/icons";
import {
  playerColorForIndex,
  teamColorHex,
} from "@/components/uff/team-colors";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { memberCanManage } from "@/lib/team/staff-roles";
import PlayerHistory from "./PlayerHistory";
import {
  buildPlayerHistory,
  type BenchHistoryRow,
} from "@/lib/benchmarks/player-history";
import ObservationsFeed, {
  type ObservationRowData,
} from "@/components/dashboard/ObservationsFeed";
import InjuryModal from "@/components/roster/InjuryModal";
import PlayerSkillProfileCard, {
  type PlayerSkill,
} from "@/components/dashboard/widgets/PlayerSkillProfileCard";
import SkillGroupTrendCard from "@/components/app/charts/SkillGroupTrendCard";
import { buildSkillGroupTrend } from "@/lib/benchmarks/skill-group-trend";
import { loadSkillGroupMaps } from "@/lib/benchmarks/skill-group-maps";
import type { SkillGroup } from "@/lib/types/skills";

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function shortMonth(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; playerId: string }>;
}) {
  const { teamId, playerId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: team }, { data: profile }, { data: membership }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, team_name, format, team_color, league_id")
        .eq("id", teamId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("team_members")
        .select("role, captain_view_only")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .maybeSingle(),
    ]);

  if (!team) notFound();

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

  // View-only members (team_manager / view-only captains) can read this
  // page but get no edit / benchmark / injury / quick-action controls.
  const canManage =
    memberCanManage(
      membershipRole,
      membership?.captain_view_only as boolean | null
    ) || isLeagueAdmin;

  const [
    { data: player },
    { data: benchesRaw },
    { data: observationsRaw },
    { data: skillProfileRaw },
    skillGroupMaps,
  ] = await Promise.all([
      supabase
        .from("team_players")
        .select(
          "id, team_id, player_name, positions, jersey_number, status, is_captain, is_injured, injury_note, color_index, notes, created_at, created_by"
        )
        .eq("id", playerId)
        .maybeSingle(),
      supabase
        .from("benchmark_results")
        .select(
          "id, assessment_date, created_at, time_seconds, rating, made_count, attempts_count, benchmark_type, drill_id, team_drills(id, drill_name, benchmark_type, benchmark_types)"
        )
        .eq("player_id", playerId)
        .order("assessment_date", { ascending: true }),
      // Observations feed (Build 6.5b). Pulls every player_notes row
      // written for this player, joined to its practice for date + title
      // + linkability. practice_plan_id is nullable on the table — those
      // rows (if any) render with a "—" date and no link.
      supabase
        .from("player_notes")
        .select(
          "id, note_text, created_at, practice_plan_id, practice_plans(id, title, practice_date)"
        )
        .eq("player_id", playerId)
        .order("created_at", { ascending: false }),
      // Skill profile (Build 13). v_player_skill_profile already scopes to
      // skills the player has signal on, so no position-bias filtering is
      // needed — a row only exists where a tagged drill was assessed.
      supabase
        .from("v_player_skill_profile")
        .select("skill_id, skill_name, skill_group, composite_score, drill_sample_size")
        .eq("player_id", playerId)
        .eq("team_id", teamId),
      // Skill-group progression maps (Build 8): drill→skill weights + skill→group,
      // scoped to this team. Fed (with the benchmark rows above) into
      // buildSkillGroupTrend for the weekly per-group composite line.
      loadSkillGroupMaps(supabase, teamId),
    ]);

  if (!player || player.team_id !== teamId) notFound();

  const positions = (player.positions as string[] | null) ?? [];
  const jerseyNumber = player.jersey_number as string | null;
  const status = player.status as "active" | "inactive";
  const isCaptain = (player.is_captain as boolean) ?? false;
  const isInjured = (player.is_injured as boolean) ?? false;
  const injuryNote = player.injury_note as string | null;
  const colorIndex = (player.color_index as number) ?? 0;
  const playerColor = playerColorForIndex(colorIndex);

  // Per-drill benchmark history + locked-insight tail + PB count, via the
  // shared transform (one source of truth with the scouting sheet). Build 8.7.
  const { drills, locked, benchmarkCount, pbCount } = buildPlayerHistory(
    (benchesRaw ?? []) as BenchHistoryRow[]
  );

  // Skill profile rows (Build 13). composite_score is 0..1; drop nulls
  // (the view emits a row only when at least one tagged drill scored).
  type SkillProfileRow = {
    skill_id: string;
    skill_name: string;
    skill_group: SkillGroup;
    composite_score: number | null;
    drill_sample_size: number | null;
  };
  const skillProfile: PlayerSkill[] = ((skillProfileRaw ?? []) as SkillProfileRow[])
    .filter((r) => r.composite_score != null)
    .map((r) => ({
      skillId: r.skill_id,
      skillName: r.skill_name,
      skillGroup: r.skill_group,
      composite: Number(r.composite_score),
      sampleSize: r.drill_sample_size ?? 0,
    }));

  // Skill-group progression trend (Build 8), fed the same benchmark rows the
  // per-drill history uses + the shared team skill-group maps.
  const skillGroupTrend = buildSkillGroupTrend({
    rows: (benchesRaw ?? []) as { drill_id: string; assessment_date: string; rating: number | null; made_count: number | null; attempts_count: number | null }[],
    drillSkills: skillGroupMaps.drillSkills,
    skillGroupById: skillGroupMaps.skillGroupById,
    positions,
    now: new Date(),
  });

  const teamColor = teamColorHex(team.team_color);
  const userInitials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  const sidebarWorkspaces = await loadSidebarWorkspaces(teamId, team.league_id);
  const rosterBase = `/dashboard/team/${teamId}/roster`;
  const playerName = player.player_name as string;
  const joinedLabel = player.created_at
    ? `Joined ${shortMonth(player.created_at as string)}`
    : "";
  // Attribution byline (Build 14.5): who added this player.
  const addedByName = await resolveActorName(
    supabase,
    (player.created_by as string | null) ?? null,
  );

  return (
    <div className="uff-web">
      <TeamSidebar
        active="roster"
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
          crumbs={[
            { label: team.team_name, href: `/dashboard/team/${teamId}` },
            { label: "Roster", href: rosterBase },
          ]}
          title={playerName}
          kicker={jerseyNumber ? `#${jerseyNumber}` : undefined}
          status={isInjured ? "INJURED" : undefined}
          showSearch={false}
          userInitials={userInitials}
          actions={
            canManage ? (
              <>
                <Link
                  href={`${rosterBase}/${playerId}/edit`}
                  className="wbtn"
                  style={{ height: 38 }}
                >
                  <DashIcon.gear size={13} /> Edit
                </Link>
                <Link
                  href="/benchmarks"
                  className="wbtn primary"
                  style={{ height: 38 }}
                >
                  Run benchmark
                </Link>
              </>
            ) : undefined
          }
        />

        <div
          className="page player-detail-grid"
          style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}
        >
          {/* Hero column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              className="w-card hero"
              style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: playerColor,
                    color: "#1a0f08",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    border: "3px solid rgba(255,255,255,0.08)",
                    flexShrink: 0,
                    opacity: status === "inactive" ? 0.55 : 1,
                  }}
                >
                  {initialsFor(playerName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--uff-text-mute)",
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    {jerseyNumber ? `#${jerseyNumber} · ` : ""}
                    {positions.length === 0 ? (
                      "No position"
                    ) : (
                      <>
                        {/* Primary position in orange so the convention reads
                            at a glance — positions[0] = primary per src/lib/positions.ts. */}
                        <span style={{ color: "var(--uff-orange)" }}>
                          {positions[0]}
                        </span>
                        {positions.length > 1 && (
                          <span> · {positions.slice(1).join(" / ")}</span>
                        )}
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: "var(--uff-text)",
                      letterSpacing: "-0.02em",
                      marginTop: 2,
                    }}
                  >
                    {playerName}
                  </div>
                  {addedByName && (
                    <div style={{ marginTop: 4 }}>
                      <Byline who={addedByName} verb="Added" at={player.created_at as string | null} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {isCaptain && (
                  <Badge color="#FFB347" bg="rgba(255,179,71,0.14)">
                    Captain
                  </Badge>
                )}
                {status === "active" ? (
                  <Badge color="var(--uff-lime)" bg="rgba(194,255,61,0.12)">
                    Active
                  </Badge>
                ) : (
                  <Badge color="var(--uff-text-mute)" bg="rgba(255,255,255,0.04)">
                    Inactive
                  </Badge>
                )}
                {isInjured && (
                  <Badge color="var(--uff-red)" bg="rgba(255,77,77,0.12)">
                    Injured
                  </Badge>
                )}
                {joinedLabel && (
                  <Badge
                    color="var(--uff-text-dim)"
                    bg="rgba(255,255,255,0.04)"
                  >
                    {joinedLabel}
                  </Badge>
                )}
              </div>

              {isInjured && injuryNote && (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "rgba(255,77,77,0.08)",
                    border: "1px solid rgba(255,77,77,0.30)",
                    borderRadius: 10,
                    fontSize: 12.5,
                    color: "var(--uff-text)",
                    lineHeight: 1.45,
                  }}
                >
                  <b style={{ color: "var(--uff-red)" }}>Injury note:</b>{" "}
                  {injuryNote}
                </div>
              )}

              {canManage && (
                <div>
                  <InjuryModal
                    playerId={playerId}
                    teamId={teamId}
                    playerName={playerName}
                    currentlyInjured={isInjured}
                    currentNote={injuryNote}
                  />
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <MiniHeroStat
                  label="Benchmarks"
                  value={String(benchmarkCount)}
                  sub={benchmarkCount === 0 ? "none yet" : "all time"}
                />
                <MiniHeroStat
                  label="Drills"
                  value={String(drills.length)}
                  sub="tracked"
                />
                <MiniHeroStat
                  label="PBs"
                  value={String(pbCount)}
                  sub={pbCount === 0 ? "—" : "all time"}
                  accent="var(--uff-orange)"
                />
                <MiniHeroStat
                  label="Position"
                  value={positions[0] ?? "—"}
                  sub={positions.length > 1 ? `+${positions.length - 1}` : ""}
                />
              </div>
            </div>

            {canManage && (
              <div className="w-card" style={{ padding: 14 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--uff-text-mute)",
                    marginBottom: 8,
                  }}
                >
                  Quick actions
                </div>
                <QuickRow
                  href="/benchmarks"
                  label="Run a benchmark"
                  meta="Pick a drill"
                />
                <QuickRow
                  href={`/dashboard/team/${teamId}/practice`}
                  label="Mark attendance"
                  meta="Next practice"
                />
                <QuickRow
                  href={`${rosterBase}/${playerId}/edit`}
                  label="Edit player"
                  meta={isInjured ? "Update injury" : "Update profile"}
                />
              </div>
            )}

            <PlayerSkillProfileCard skills={skillProfile} playerName={playerName} />

            <SkillGroupTrendCard trend={skillGroupTrend} />

            {(player.notes as string | null) && (
              <div className="w-card" style={{ padding: 14 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--uff-text-mute)",
                    marginBottom: 8,
                  }}
                >
                  Notes
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "var(--uff-text-dim)",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                  }}
                >
                  {player.notes as string}
                </p>
              </div>
            )}

            <ObservationsFeed rows={(observationsRaw ?? []) as ObservationRowData[]} />
          </div>

          {/* History column */}
          <PlayerHistory drills={drills} locked={locked} />
        </div>

        <style>{`
          .player-detail-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 18px;
            padding-top: 18px;
          }
          @media (min-width: 1024px) {
            .player-detail-grid {
              grid-template-columns: 340px minmax(0, 1fr);
            }
          }
        `}</style>
      </div>
    </div>
  );
}

function MiniHeroStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1,
          marginTop: 4,
          color: accent || "var(--uff-text)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--uff-text-mute)",
          marginTop: 3,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function QuickRow({
  href,
  label,
  meta,
}: {
  href: string;
  label: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 8px",
        borderRadius: 8,
        textDecoration: "none",
        color: "inherit",
        borderTop: "1px solid var(--uff-line-soft)",
      }}
    >
      <span style={{ flex: 1, fontSize: 13, color: "var(--uff-text)" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 10.5,
          color: "var(--uff-text-mute)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {meta}
      </span>
      <Icon.chevR size={11} />
    </Link>
  );
}

function Badge({
  color,
  bg,
  children,
}: {
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: 4,
        background: bg,
        color,
      }}
    >
      {children}
    </span>
  );
}

