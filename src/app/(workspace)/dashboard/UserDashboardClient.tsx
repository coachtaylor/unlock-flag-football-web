"use client";

import Link from "next/link";
import DashTopBar from "@/components/dashboard/DashTopBar";
import DashSection from "@/components/dashboard/DashSection";
import UserSidebar, { type WorkspaceItem } from "@/components/dashboard/UserSidebar";
import { Icon } from "@/components/uff/icons";
import type { UserHomeData, UserLeague, UserTeam } from "@/lib/dashboard/user-home-data";

export default function UserDashboardClient({ data }: { data: UserHomeData }) {
  const { user, leagues, teams } = data;
  const firstName = user.firstName ?? "there";
  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() ||
    user.email[0]?.toUpperCase() ||
    "U";

  const workspaces: WorkspaceItem[] = [
    ...leagues.map((l) => ({
      id: l.id,
      kind: "league" as const,
      name: l.league_name,
      color: l.league_color,
    })),
    ...teams.map((t) => ({
      id: t.id,
      kind: "team" as const,
      name: t.team_name,
      color: t.team_color ?? "#FF6A1A",
    })),
  ];

  const isEmpty = leagues.length === 0 && teams.length === 0;

  const totalMembers =
    leagues.reduce((a, l) => a + l.members_count, 0) +
    teams.reduce((a, t) => a + t.players_count, 0);

  return (
    <div className="uff-web">
      <UserSidebar
        workspaces={workspaces}
        user={{
          firstName: user.firstName ?? user.email.split("@")[0],
          lastName: user.lastName ?? "",
          email: user.email,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          title={`Hi ${firstName}`}
          kicker="ACCOUNT HOME"
          userInitials={initials}
        />

        <div className="page" style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}>
          <WelcomeStrip
            leagueCount={leagues.length}
            teamCount={teams.length}
            totalMembers={totalMembers}
          />

          {isEmpty ? (
            <EmptyState />
          ) : (
            <>
              {leagues.length > 0 && (
                <DashSection
                  label="My leagues"
                  meta={`${leagues.length}`}
                  cta={
                    <Link
                      href="/onboarding/create-league?scope=league"
                      className="wbtn primary"
                      style={{ height: 34, fontSize: 12.5, padding: "0 12px" }}
                    >
                      <Icon.plus size={12} /> New league
                    </Link>
                  }
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: leagues.length >= 2 ? "repeat(2, 1fr)" : "1fr",
                      gap: 14,
                    }}
                    className="dash-card-grid"
                  >
                    {leagues.map((l) => (
                      <LeagueCard key={l.id} league={l} />
                    ))}
                  </div>
                </DashSection>
              )}

              {teams.length > 0 && (
                <DashSection
                  label="My teams"
                  meta={`${teams.length} · standalone`}
                  cta={
                    <Link
                      href="/teams/new"
                      className="wbtn"
                      style={{ height: 34, fontSize: 12.5, padding: "0 12px" }}
                    >
                      <Icon.plus size={12} /> Add team
                    </Link>
                  }
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: teams.length >= 2 ? "repeat(2, 1fr)" : "1fr",
                      gap: 14,
                    }}
                    className="dash-card-grid"
                  >
                    {teams.map((t) => (
                      <TeamCard key={t.id} team={t} />
                    ))}
                  </div>
                </DashSection>
              )}

              {leagues.length > 0 && teams.length === 0 && <LeaguesOnlyHint />}
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .dash-card-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function WelcomeStrip({
  leagueCount,
  teamCount,
  totalMembers,
}: {
  leagueCount: number;
  teamCount: number;
  totalMembers: number;
}) {
  return (
    <div
      className="w-card hero"
      style={{
        padding: 24,
        display: "flex",
        alignItems: "center",
        gap: 28,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".16em",
            color: "var(--uff-orange)",
            marginBottom: 6,
          }}
        >
          WELCOME BACK
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: "var(--uff-text)",
          }}
        >
          Pick a workspace, or start something new.
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--uff-text-dim)",
            marginTop: 8,
            maxWidth: 520,
            lineHeight: 1.5,
          }}
        >
          Your leagues and standalone teams live here. Open one to manage drills,
          roster, and practice plans.
        </div>
      </div>

      <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
        <HeroStat label="Leagues" v={leagueCount} />
        <HeroStat label="Teams" v={teamCount} />
        <HeroStat label="Members" v={totalMembers} />
      </div>
    </div>
  );
}

function HeroStat({ label, v }: { label: string; v: number | string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: "var(--uff-text)",
        }}
      >
        {v}
      </span>
    </div>
  );
}

function LeagueCard({ league }: { league: UserLeague }) {
  return (
    <Link
      href={`/dashboard/league/${league.id}`}
      className="w-card"
      style={{
        padding: 0,
        borderTop: `2px solid ${league.league_color}`,
        cursor: "pointer",
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: league.league_color,
              color: "#1a0f08",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-mono)",
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: "-0.04em",
            }}
          >
            {league.league_name[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".18em",
                  color: "var(--uff-text-mute)",
                }}
              >
                LEAGUE
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: ".16em",
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "rgba(255, 106, 26, 0.12)",
                  color: "var(--uff-orange)",
                }}
              >
                ADMIN
              </span>
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
                color: "var(--uff-text)",
              }}
            >
              {league.league_name}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            padding: 12,
            background: "var(--uff-surface-2)",
            borderRadius: 10,
            border: "1px solid var(--uff-line-soft)",
          }}
        >
          <MicroStat label="TEAMS" v={league.teams_count} />
          <MicroStat label="MEMBERS" v={league.members_count} />
          <MicroStat label="FORMAT" v={league.format.toUpperCase()} mono />
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ flex: 1 }} />
          <span
            className="wbtn"
            style={{ height: 30, fontSize: 12, padding: "0 10px" }}
          >
            Open league <Icon.chevR size={11} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function TeamCard({ team }: { team: UserTeam }) {
  const isCaptain = team.role === "captain";
  const roleBg = isCaptain ? "rgba(194,255,61,0.12)" : "rgba(255,106,26,0.14)";
  const roleFg = isCaptain ? "var(--uff-lime)" : "var(--uff-orange)";
  const color = team.team_color ?? "#FF6A1A";

  return (
    <Link
      href={`/dashboard/team/${team.id}`}
      className="w-card"
      style={{
        padding: 0,
        borderTop: `2px solid ${color}`,
        cursor: "pointer",
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: color,
              color: "#1a0f08",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-mono)",
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: "-0.04em",
            }}
          >
            {team.team_name[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".18em",
                  color: "var(--uff-text-mute)",
                }}
              >
                TEAM
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: ".16em",
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: roleBg,
                  color: roleFg,
                }}
              >
                {team.role.toUpperCase()}
              </span>
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
                color: "var(--uff-text)",
              }}
            >
              {team.team_name}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
            padding: 12,
            background: "var(--uff-surface-2)",
            borderRadius: 10,
            border: "1px solid var(--uff-line-soft)",
          }}
        >
          <MicroStat label="PLAYERS" v={team.players_count} />
          <MicroStat label="FORMAT" v={team.format.toUpperCase()} mono />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 11.5,
              color: "var(--uff-text-dim)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon.bolt size={11} />
            <span>{isCaptain ? "You're on the roster" : "You coach this team"}</span>
          </span>
          <span style={{ flex: 1 }} />
          <span
            className="wbtn"
            style={{ height: 30, fontSize: 12, padding: "0 10px" }}
          >
            Open team <Icon.chevR size={11} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function MicroStat({
  label,
  v,
  mono,
}: {
  label: string;
  v: number | string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          fontSize: 14.5,
          fontWeight: 600,
          color: "var(--uff-text)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {v}
      </span>
    </div>
  );
}

function LeaguesOnlyHint() {
  return (
    <div
      style={{
        padding: "14px 18px",
        background: "rgba(255, 255, 255, 0.025)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
        color: "var(--uff-text-dim)",
        fontSize: 13,
        lineHeight: 1.5,
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "var(--uff-orange)" }}>
        <Icon.pin size={13} />
      </span>
      <span style={{ flex: 1, minWidth: 200 }}>
        Teams inside your leagues live on each league's dashboard — open a
        league to manage them. Standalone teams (not part of any league) would
        show up here.
      </span>
      <Link
        href="/teams/new"
        className="wbtn"
        style={{ height: 30, fontSize: 12, padding: "0 10px" }}
      >
        <Icon.plus size={12} /> Add standalone team
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="dash-card-grid"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
    >
      <EmptyCard
        kicker="LEAGUE"
        title="Manage many teams at once."
        body="Set up a league if you run a club, a tournament, or a season with multiple teams under one roof."
        primary="New league"
        primaryHref="/onboarding/create-league?scope=league"
        secondary={["Bulk roster sync", "Cross-team schedules", "One admin scope"]}
        accent="var(--uff-orange)"
      />
      <EmptyCard
        kicker="SINGLE TEAM"
        title="Coach or captain one squad."
        body="Add a standalone team to run practices, build drills, and benchmark your players."
        primary="New team"
        primaryHref="/teams/new"
        secondary={["Practice planner", "Drill library", "Roster + benchmarks"]}
        accent="var(--uff-lime)"
        ghost
      />
    </div>
  );
}

function EmptyCard({
  kicker,
  title,
  body,
  primary,
  primaryHref,
  secondary,
  accent,
  ghost,
}: {
  kicker: string;
  title: string;
  body: string;
  primary: string;
  primaryHref: string;
  secondary: string[];
  accent: string;
  ghost?: boolean;
}) {
  return (
    <div
      className="w-card"
      style={{
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        position: "relative",
        overflow: "hidden",
        background: ghost
          ? "var(--uff-surface)"
          : "linear-gradient(180deg, rgba(255,106,26,0.06) 0%, transparent 50%), var(--uff-surface)",
        borderTop: `2px solid ${accent}`,
      }}
    >
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".18em",
            color: accent,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: "var(--uff-text)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--uff-text-dim)",
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>

        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {secondary.map((s, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                color: "var(--uff-text-dim)",
              }}
            >
              <span style={{ color: accent }}>
                <Icon.bolt size={11} />
              </span>
              {s}
            </li>
          ))}
        </ul>

        <Link
          href={primaryHref}
          className={`wbtn ${ghost ? "" : "primary"}`}
          style={{
            alignSelf: "flex-start",
            height: 38,
            fontSize: 13,
            ...(ghost
              ? {}
              : { background: accent, color: "#1a0f08", borderColor: "transparent" }),
          }}
        >
          <Icon.plus size={13} /> {primary}
        </Link>
      </div>
    </div>
  );
}
