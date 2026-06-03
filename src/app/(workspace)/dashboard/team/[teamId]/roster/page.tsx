// Roster list — team-scoped workspace page. Pulls every team_player for
// the team plus that player's most recent benchmark (across all drills)
// so the table can show the "Last benchmark" column without a per-row
// fetch. Captain badge is sourced from team_players.is_captain; injured
// status from team_players.is_injured.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { teamColorHex } from "@/components/uff/team-colors";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { lastNameSortKey } from "@/lib/format/name";
import RosterListClient, { type RosterPlayer } from "./RosterListClient";
import CoachingStaffTable, { type StaffMember } from "./CoachingStaffTable";
import SectionLabel from "./SectionLabel";
import InviteModal from "./InviteModal";
import PendingInvites, { type PendingInvite } from "./PendingInvites";
import {
  STAFF_ROLES,
  isFullAccess,
  type StaffRole,
  type InviteRole,
} from "@/lib/team/staff-roles";

type BenchmarkJoin = {
  player_id: string;
  assessment_date: string;
  created_at: string;
  time_seconds: number | null;
  rating: number | null;
  made_count: number | null;
  attempts_count: number | null;
  benchmark_type: string | null;
  team_drills:
    | { drill_name: string; benchmark_type: string | null }
    | { drill_name: string; benchmark_type: string | null }[]
    | null;
};

function formatBenchValue(b: BenchmarkJoin, drillType: string | null): string {
  const t = b.benchmark_type ?? drillType ?? null;
  if (t === "timed" && b.time_seconds != null)
    return `${Number(b.time_seconds).toFixed(2)}s`;
  if (t === "rated" && b.rating != null) return `${b.rating} / 5`;
  if (t === "pct" && b.attempts_count != null && b.made_count != null)
    return `${b.made_count} / ${b.attempts_count}`;
  if (t === "flags" && b.made_count != null) return `${b.made_count} pulls`;
  if (t === "drops" && b.made_count != null) return `${b.made_count} drops`;
  if (t === "reps" && b.made_count != null) return `${b.made_count} reps`;
  if (b.time_seconds != null) return `${Number(b.time_seconds).toFixed(2)}s`;
  if (b.rating != null) return `${b.rating} / 5`;
  return "—";
}

// Shape + drop-expired for pending invites. Module-scoped (not in the
// component body) so the Date.now() call stays out of render.
type InviteRpcRow = {
  id: string;
  token: string;
  role: string;
  coach_specialties: string[] | null;
  invitee_label: string | null;
  expires_at: string | null;
};
function shapePendingInvites(rows: InviteRpcRow[] | null): PendingInvite[] {
  const now = Date.now();
  return (rows ?? [])
    .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
    .map((r) => ({
      id: r.id,
      token: r.token,
      role: r.role as InviteRole,
      specialties: r.coach_specialties ?? [],
      label: r.invitee_label ?? null,
      expiresAt: r.expires_at ?? null,
    }));
}

// Parse a jersey number for sorting. Non-numeric / blank → null (sorts to
// the bottom). "00" → 0, "12" → 12.
function jerseyNumber(raw: string | null): number | null {
  const n = parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function relativeWhen(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1w ago";
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
}

export default async function TeamRosterPage({
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
        .select("role")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .maybeSingle(),
    ]);

  if (!team) notFound();

  // Access: direct team_member OR league_admin on the team's league.
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

  // Full-access members (+ league admins) can invite, revoke, and edit the
  // roster. team_managers are view-only (mirrors get_my_writable_team_ids()).
  const canManage = isFullAccess(membershipRole) || isLeagueAdmin;

  // Captains surface above regular players; within each group, ordered by
  // jersey number ascending with un-numbered players sent to the bottom
  // (last name breaks ties). The roster stacks coaches → captains → players.
  const { data: playerRows } = await supabase
    .from("team_players")
    .select(
      "id, player_name, first_name, last_name, positions, jersey_number, status, is_captain, is_injured, injury_note, color_index, notes"
    )
    .eq("team_id", teamId);
  const players = [...(playerRows ?? [])].sort((a, b) => {
    const ac = a.is_captain ? 0 : 1;
    const bc = b.is_captain ? 0 : 1;
    if (ac !== bc) return ac - bc; // captains first
    const an = jerseyNumber(a.jersey_number as string | null);
    const bn = jerseyNumber(b.jersey_number as string | null);
    if (an !== bn) {
      if (an == null) return 1; // no number → bottom
      if (bn == null) return -1;
      return an - bn; // least → greatest
    }
    return lastNameSortKey(
      a.first_name as string | null,
      a.last_name as string | null,
      a.player_name as string | null
    ).localeCompare(
      lastNameSortKey(
        b.first_name as string | null,
        b.last_name as string | null,
        b.player_name as string | null
      )
    );
  });

  // Coaching staff (head/assistant coaches + managers) for the top table.
  // Names come from a SECURITY DEFINER RPC because profiles RLS is self-only.
  const { data: staffRows } = await supabase.rpc("get_team_staff", {
    p_team_id: teamId,
  });

  const playerIds = (players ?? []).map((p) => p.id as string);
  const recentByPlayer = new Map<string, BenchmarkJoin>();
  if (playerIds.length > 0) {
    const { data: benches } = await supabase
      .from("benchmark_results")
      .select(
        "player_id, assessment_date, created_at, time_seconds, rating, made_count, attempts_count, benchmark_type, team_drills(drill_name, benchmark_type)"
      )
      .in("player_id", playerIds)
      .order("created_at", { ascending: false });
    // First occurrence per player_id wins (already ordered desc).
    for (const row of (benches ?? []) as BenchmarkJoin[]) {
      if (!recentByPlayer.has(row.player_id)) {
        recentByPlayer.set(row.player_id, row);
      }
    }
  }

  // Attendance %: a player's attended count over the team's completed
  // practices (mirrors the dashboard's attended===true definition). Null
  // until the team has logged at least one completed practice.
  const { data: completedPlans } = await supabase
    .from("practice_plans")
    .select("id")
    .eq("team_id", teamId)
    .eq("status", "completed");
  const totalCompleted = (completedPlans ?? []).length;
  const attendedByPlayer = new Map<string, number>();
  if (totalCompleted > 0 && playerIds.length > 0) {
    const { data: att } = await supabase
      .from("practice_plan_attendees")
      .select("player_id, attended, practice_plan_id")
      .in(
        "practice_plan_id",
        (completedPlans ?? []).map((p) => p.id as string)
      )
      .eq("attended", true);
    for (const r of att ?? []) {
      const pid = r.player_id as string;
      attendedByPlayer.set(pid, (attendedByPlayer.get(pid) ?? 0) + 1);
    }
  }

  const rosterPlayers: RosterPlayer[] = (players ?? []).map((p) => {
    const bench = recentByPlayer.get(p.id as string);
    const drillJoin = bench?.team_drills;
    const drillRow = Array.isArray(drillJoin) ? drillJoin[0] : drillJoin;
    const drillType = drillRow?.benchmark_type ?? null;
    const lastBench = bench
      ? {
          drillName: drillRow?.drill_name ?? "Drill",
          benchmarkType: bench.benchmark_type ?? drillType,
          value: formatBenchValue(bench, drillType),
          when: relativeWhen(bench.created_at),
        }
      : null;
    return {
      id: p.id as string,
      name: p.player_name as string,
      positions: (p.positions as string[] | null) ?? [],
      jerseyNumber: (p.jersey_number as string | null) ?? null,
      status: p.status as "active" | "inactive",
      isCaptain: (p.is_captain as boolean) ?? false,
      isInjured: (p.is_injured as boolean) ?? false,
      injuryNote: (p.injury_note as string | null) ?? null,
      colorIndex: (p.color_index as number) ?? 0,
      attendancePct:
        totalCompleted > 0
          ? Math.round(
              ((attendedByPlayer.get(p.id as string) ?? 0) / totalCompleted) * 100
            )
          : null,
      lastBench,
    };
  });

  // Shape staff rows. The RPC already filters to staff roles and orders
  // head → assistant → manager; we resolve a display name and the "you" flag.
  type StaffRpcRow = {
    member_id: string;
    user_id: string;
    role: string;
    coach_specialties: string[] | null;
    first_name: string | null;
    last_name: string | null;
  };
  const staff: StaffMember[] = ((staffRows as StaffRpcRow[] | null) ?? [])
    .filter((r): r is StaffRpcRow & { role: StaffRole } =>
      (STAFF_ROLES as string[]).includes(r.role)
    )
    .map((r) => {
      const name =
        [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || "Coach";
      return {
        memberId: r.member_id,
        userId: r.user_id,
        name,
        role: r.role,
        specialties: r.coach_specialties ?? [],
        isYou: r.user_id === user.id,
      };
    });

  // Pending (not accepted, not revoked, not expired) invite links — only
  // full-access members manage them, so only they pay for the query.
  let pendingInvites: PendingInvite[] = [];
  if (canManage) {
    const { data: inviteRows } = await supabase
      .from("team_invites")
      .select("id, token, role, coach_specialties, invitee_label, expires_at")
      .eq("team_id", teamId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    pendingInvites = shapePendingInvites(inviteRows as InviteRpcRow[] | null);
  }

  const captainCount = rosterPlayers.filter((p) => p.isCaptain).length;
  const playerNote = [
    captainCount > 0
      ? `${captainCount} ${captainCount === 1 ? "captain" : "captains"}`
      : null,
    `${rosterPlayers.length} ${rosterPlayers.length === 1 ? "player" : "players"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const teamColor = teamColorHex(team.team_color);
  const sidebarWorkspaces = await loadSidebarWorkspaces(teamId, team.league_id);
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

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
          ]}
          title="Roster"
          kicker={`${rosterPlayers.filter((p) => p.status === "active").length} active`}
          showSearch={false}
          userInitials={initials}
        />

        <div
          className="page"
          style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}
        >
          <CoachingStaffTable
            teamId={teamId}
            staff={staff}
            action={
              canManage ? (
                <InviteModal teamId={teamId} teamName={team.team_name} />
              ) : null
            }
            footer={
              canManage ? (
                <PendingInvites teamId={teamId} invites={pendingInvites} />
              ) : null
            }
          />

          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionLabel label="Players" note={playerNote || undefined} />
            <RosterListClient
              teamId={teamId}
              teamName={team.team_name}
              players={rosterPlayers}
              canManage={canManage}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
