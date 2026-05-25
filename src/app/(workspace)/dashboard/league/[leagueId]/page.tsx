import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLeagueDashboardData } from "@/lib/dashboard/league-data";
import DashTopBar from "@/components/dashboard/DashTopBar";
import DashSection from "@/components/dashboard/DashSection";
import LeagueSidebar from "@/components/dashboard/LeagueSidebar";
import { Icon } from "@/components/uff/icons";
import type { LeagueTeam } from "@/lib/dashboard/league-data";

export default async function LeagueDashboardPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await getLeagueDashboardData(leagueId);
  if (!data) notFound();

  const { league, teams, user: profileUser } = data;
  const initials =
    `${profileUser.firstName?.[0] ?? ""}${profileUser.lastName?.[0] ?? ""}`.toUpperCase() ||
    profileUser.email[0]?.toUpperCase() ||
    "U";

  return (
    <div className="uff-web">
      <LeagueSidebar
        league={{
          id: league.id,
          name: league.league_name,
          color: league.league_color,
          teams: teams.length,
          members: league.members_count,
        }}
        user={{
          firstName: profileUser.firstName ?? profileUser.email,
          lastName: profileUser.lastName ?? "",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={[
            { label: "Workspaces", href: "/dashboard" },
            { label: "Leagues" },
          ]}
          title={league.league_name}
          kicker={league.format.toUpperCase()}
          userInitials={initials}
          actions={
            <Link
              href={`/teams/new?leagueId=${league.id}`}
              className="wbtn primary"
            >
              <Icon.plus size={13} /> Add team
            </Link>
          }
        />

        <div className="page" style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}>
          <LeagueHero league={league} />

          <LeagueStatsStrip teams={teams} />

          {teams.length === 0 ? (
            <LeagueEmptyState league={league} />
          ) : (
            <DashSection
              tick={league.league_color}
              label="Teams"
              meta={`${teams.length} active`}
              cta={
                <Link
                  href={`/teams/new?leagueId=${league.id}`}
                  className="wbtn primary"
                  style={{ height: 32, fontSize: 12.5, padding: "0 12px" }}
                >
                  <Icon.plus size={12} /> Add team
                </Link>
              }
            >
              <div
                className="dash-league-teams"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 14,
                }}
              >
                {teams.map((t) => (
                  <LeagueTeamCardWeb key={t.id} team={t} />
                ))}
                <AddTeamSlot leagueId={league.id} />
              </div>
            </DashSection>
          )}
        </div>

        <style>{`
          @media (max-width: 1100px) {
            .dash-league-teams { grid-template-columns: repeat(2, 1fr) !important; }
          }
          @media (max-width: 700px) {
            .dash-league-teams { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

function LeagueHero({
  league,
}: {
  league: { league_name: string; league_color: string; format: string; created_at: string; members_count: number };
}) {
  const created = new Date(league.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div
      className="w-card"
      style={{
        padding: 0,
        background: `linear-gradient(180deg, ${league.league_color}14 0%, transparent 50%), var(--uff-surface)`,
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      <div style={{ height: 4, background: league.league_color }} />
      <div
        style={{
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: league.league_color,
            color: "#1a0f08",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: "-0.04em",
            flexShrink: 0,
            boxShadow: `0 8px 24px ${league.league_color}40`,
          }}
        >
          {league.league_name[0]}
        </div>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
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
                padding: "2px 7px",
                borderRadius: 4,
                background: "rgba(255, 106, 26, 0.14)",
                color: "var(--uff-orange)",
              }}
            >
              YOU&apos;RE ADMIN
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--uff-text-mute)",
                letterSpacing: ".06em",
              }}
            >
              · DEFAULT {league.format.toUpperCase()}
            </span>
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              color: "var(--uff-text)",
            }}
          >
            {league.league_name}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--uff-text-dim)",
              marginTop: 4,
            }}
          >
            Created {created} · {league.members_count}{" "}
            {league.members_count === 1 ? "member" : "members"}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeagueStatsStrip({ teams }: { teams: LeagueTeam[] }) {
  const players = teams.reduce((a, t) => a + t.players_count, 0);
  const coaches = teams.reduce((a, t) => a + t.coaches_count, 0);
  const stats = [
    { label: "TEAMS", v: teams.length },
    { label: "PLAYERS", v: players },
    { label: "COACHES", v: coaches },
    { label: "FORMATS", v: new Set(teams.map((t) => t.format)).size || "—" },
  ];
  return (
    <div
      className="w-card"
      style={{
        padding: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        overflow: "hidden",
      }}
    >
      {stats.map((s, i) => (
        <div
          key={s.label}
          style={{
            padding: "18px 20px",
            borderRight:
              i < stats.length - 1 ? "1px solid var(--uff-line-soft)" : "none",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".16em",
              color: "var(--uff-text-mute)",
            }}
          >
            {s.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: s.v === 0 ? "var(--uff-text-mute)" : "var(--uff-text)",
            }}
          >
            {s.v}
          </span>
        </div>
      ))}
    </div>
  );
}

function LeagueTeamCardWeb({ team }: { team: LeagueTeam }) {
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
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: color,
              color: "#1a0f08",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-mono)",
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: "-0.04em",
            }}
          >
            {team.team_name[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14.5,
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
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--uff-text-mute)",
                letterSpacing: ".06em",
                marginTop: 4,
              }}
            >
              {team.format.toUpperCase()}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 14,
            padding: "10px 12px",
            background: "var(--uff-surface-2)",
            borderRadius: 10,
            border: "1px solid var(--uff-line-soft)",
          }}
        >
          <MiniCell n={team.players_count} label="players" />
          <span style={{ width: 1, background: "var(--uff-line-soft)" }} />
          <MiniCell n={team.coaches_count} label="coaches" />
        </div>

        <span
          className="wbtn"
          style={{ height: 32, fontSize: 12.5, justifyContent: "center" }}
        >
          Open team <Icon.chevR size={11} />
        </span>
      </div>
    </Link>
  );
}

function MiniCell({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 16,
          fontWeight: 700,
          color: n === 0 ? "var(--uff-text-mute)" : "var(--uff-text)",
          lineHeight: 1,
        }}
      >
        {n}
      </span>
      <span
        style={{
          fontSize: 9.5,
          color: "var(--uff-text-mute)",
          letterSpacing: ".08em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function AddTeamSlot({ leagueId }: { leagueId: string }) {
  return (
    <Link
      href={`/teams/new?leagueId=${leagueId}`}
      style={{
        width: "100%",
        minHeight: 184,
        background: "transparent",
        border: "1.5px dashed var(--uff-line)",
        borderRadius: 16,
        color: "var(--uff-text-dim)",
        fontFamily: "inherit",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        textDecoration: "none",
        transition: "border-color 120ms ease, color 120ms ease",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "rgba(255, 106, 26, 0.12)",
          color: "var(--uff-orange)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon.plus size={20} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--uff-text)" }}>
        Add team
      </span>
      <span style={{ fontSize: 11.5, color: "var(--uff-text-mute)" }}>
        Inherits your admin access
      </span>
    </Link>
  );
}

function LeagueEmptyState({
  league,
}: {
  league: { id: string; league_name: string; league_color: string };
}) {
  return (
    <div
      className="w-card"
      style={{
        padding: 32,
        borderTop: `2px solid ${league.league_color}`,
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(180deg, ${league.league_color}10 0%, transparent 60%), var(--uff-surface)`,
      }}
    >
      <div
        className="empty-grid"
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 32,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".18em",
              color: league.league_color,
              marginBottom: 12,
            }}
          >
            FIRST TEAM
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              color: "var(--uff-text)",
            }}
          >
            No teams yet. Add your first to get started.
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--uff-text-dim)",
              marginTop: 12,
              maxWidth: 460,
              lineHeight: 1.55,
            }}
          >
            You&apos;re the league admin for{" "}
            <strong style={{ color: "var(--uff-text)" }}>
              {league.league_name}
            </strong>
            . Every team you add inherits your admin access — you can coach
            them yourself or invite other coaches.
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <Link
              href={`/teams/new?leagueId=${league.id}`}
              className="wbtn primary"
              style={{ height: 40, fontSize: 13 }}
            >
              <Icon.plus size={13} /> Add first team
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: 14,
                borderRadius: 12,
                border: "1.5px dashed var(--uff-line)",
                background: "rgba(255,255,255,0.015)",
                opacity: 1 - i * 0.22,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--uff-line)",
                }}
              />
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    height: 9,
                    borderRadius: 3,
                    background: "var(--uff-line-soft)",
                    width: `${56 - i * 8}%`,
                  }}
                />
                <div
                  style={{
                    height: 7,
                    borderRadius: 3,
                    background: "var(--uff-line-soft)",
                    width: `${36 - i * 6}%`,
                  }}
                />
              </div>
              {i === 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: ".14em",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--uff-text-mute)",
                  }}
                >
                  SLOT 1
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .empty-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

