// Coach detail — profile for a single coaching-staff member (Build 16.5c).
// Hero card (avatar, name, role, access), profile fields (years of
// experience, background, certifications, contact). Full-access members get
// Edit + Remove; view-only members can read it. Mirrors the player detail
// page's shell and access gating.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { DashIcon } from "@/components/uff/icons";
import { teamColorHex } from "@/components/uff/team-colors";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import { initialsFor } from "@/lib/format/initials";
import {
  STAFF_ROLE_META,
  staffRoleLabel,
  specialtyLabel,
  isFullAccess,
} from "@/lib/team/staff-roles";
import { loadTeamStaff, shapeStaffRow } from "@/lib/team/staff-detail";
import RemoveStaffButton from "../RemoveStaffButton";

export default async function CoachDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; memberId: string }>;
}) {
  const { teamId, memberId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: team }, { data: profile }, { data: membership }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, team_name, team_color, league_id")
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

  const canManage = isFullAccess(membershipRole) || isLeagueAdmin;

  const staffRows = await loadTeamStaff(supabase, teamId);
  const row = staffRows.find((r) => r.member_id === memberId);
  const coach = row ? shapeStaffRow(row) : null;
  if (!coach) notFound();

  const headCount = staffRows.filter((r) => r.role === "head_coach").length;
  const meta = STAFF_ROLE_META[coach.role];
  const roleLabel = staffRoleLabel(coach.role, headCount);
  const isYou = coach.userId === user.id;

  const teamColor = teamColorHex(team.team_color);
  const sidebarWorkspaces = await loadSidebarWorkspaces(teamId, team.league_id);
  const userInitials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";
  const rosterBase = `/dashboard/team/${teamId}/roster`;
  const coachBase = `${rosterBase}/coach/${memberId}`;

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
          title={coach.name}
          kicker={roleLabel}
          showSearch={false}
          userInitials={userInitials}
          actions={
            canManage ? (
              <>
                <Link
                  href={`${coachBase}/edit`}
                  className="wbtn"
                  style={{ height: 38 }}
                >
                  <DashIcon.gear size={13} /> Edit
                </Link>
                {!isYou && (
                  <RemoveStaffButton
                    memberId={memberId}
                    teamId={teamId}
                    name={coach.name}
                    rosterHref={rosterBase}
                  />
                )}
              </>
            ) : undefined
          }
        />

        <div
          className="page"
          style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 18 }}>
            {/* Hero */}
            <div
              className="w-card"
              style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "var(--uff-surface-2)",
                    border: `2px solid ${meta.color}`,
                    color: "var(--uff-text)",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    flexShrink: 0,
                  }}
                >
                  {initialsFor(coach.name)}
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
                    {roleLabel}
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
                    {coach.name}
                  </div>
                </div>
                <AccessBadge tier={meta.access} label={meta.accessLabel} />
              </div>

              {/* Focus tags (assistant coaches) */}
              {coach.role === "assistant_coach" && coach.specialties.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {coach.specialties.map((s) => (
                    <Tag key={s}>{specialtyLabel(s)}</Tag>
                  ))}
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="w-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
              <SectionTitle>Profile</SectionTitle>

              <FieldRow label="Years of experience">
                {coach.yearsExperience != null ? (
                  <Value>
                    {coach.yearsExperience}{" "}
                    {coach.yearsExperience === 1 ? "year" : "years"}
                  </Value>
                ) : (
                  <Empty />
                )}
              </FieldRow>

              <FieldRow label="Background">
                {coach.experienceDetail ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      color: "var(--uff-text)",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                    }}
                  >
                    {coach.experienceDetail}
                  </p>
                ) : (
                  <Empty />
                )}
              </FieldRow>

              <FieldRow label="Certifications">
                {coach.certifications.length > 0 ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {coach.certifications.map((c) => (
                      <Tag key={c}>{c}</Tag>
                    ))}
                  </div>
                ) : (
                  <Empty />
                )}
              </FieldRow>
            </div>

            {/* Contact */}
            <div className="w-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
              <SectionTitle>Contact</SectionTitle>
              <FieldRow label="Email">
                {coach.contactEmail ? (
                  <a href={`mailto:${coach.contactEmail}`} style={linkStyle}>
                    {coach.contactEmail}
                  </a>
                ) : (
                  <Empty />
                )}
              </FieldRow>
              <FieldRow label="Phone">
                {coach.contactPhone ? (
                  <a href={`tel:${coach.contactPhone}`} style={linkStyle}>
                    {coach.contactPhone}
                  </a>
                ) : (
                  <Empty />
                )}
              </FieldRow>
            </div>

            {canManage && (
              <Link
                href={`${coachBase}/edit`}
                className="wbtn primary"
                style={{ height: 44, justifyContent: "center" }}
              >
                Edit profile
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--uff-text-mute)",
      }}
    >
      {children}
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--uff-text-dim)",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 14, color: "var(--uff-text)" }}>{children}</span>
  );
}

function Empty() {
  return (
    <span style={{ fontSize: 13, color: "var(--uff-text-mute)" }}>
      Not added yet
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: "0.02em",
        padding: "4px 10px",
        borderRadius: 999,
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line-soft)",
        color: "var(--uff-text-dim)",
      }}
    >
      {children}
    </span>
  );
}

function AccessBadge({ tier, label }: { tier: "full" | "view"; label: string }) {
  const isFull = tier === "full";
  const color = isFull ? "var(--uff-lime)" : "var(--uff-text-mute)";
  const bg = isFull ? "rgba(194,255,61,0.10)" : "rgba(255,255,255,0.04)";
  const border = isFull
    ? "1px solid rgba(194,255,61,0.30)"
    : "1px solid var(--uff-line-soft)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "5px 10px",
        borderRadius: 999,
        background: bg,
        border,
        color,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

const linkStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--uff-orange)",
  textDecoration: "none",
};
