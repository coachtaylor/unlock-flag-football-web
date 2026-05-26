// Team-context sidebar — primary nav rendered inside the .uff-web shell
// for any team-scoped page (team dashboard, drills, roster, practice,
// benchmarks, settings). The `active` prop highlights the current item;
// the `teamId` prop drives the back-to-dashboard link.
//
// Lifted out of `(workspace)/dashboard/team/[teamId]/page.tsx` so the new
// Drills surface (Build 4) and the future Roster / Practice / Benchmarks
// surfaces (Build 6) reuse the same nav instead of duplicating it.

import Link from "next/link";
import { DashIcon, Icon } from "@/components/uff/icons";

type NavId =
  | "dashboard"
  | "roster"
  | "drills"
  | "practice"
  | "benchmarks"
  | "settings";

type Props = {
  active: NavId;
  teamId: string;
  teamColor: string;
  teamName: string;
  leagueId: string | null;
  user: { firstName: string; lastName: string };
};

export default function TeamSidebar({
  active,
  teamId,
  teamColor,
  teamName,
  leagueId,
  user,
}: Props) {
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const items: {
    id: NavId;
    label: string;
    href: string;
    icon: typeof DashIcon.home;
  }[] = [
    { id: "dashboard", label: "Dashboard", href: `/dashboard/team/${teamId}`, icon: DashIcon.home },
    { id: "roster", label: "Roster", href: "/roster", icon: DashIcon.team },
    { id: "drills", label: "Drills", href: "/drills", icon: DashIcon.drills },
    { id: "practice", label: "Practice", href: "/practice", icon: DashIcon.practice },
    { id: "benchmarks", label: "Benchmarks", href: "/benchmarks", icon: DashIcon.rules },
    { id: "settings", label: "Settings", href: "/settings", icon: DashIcon.gear },
  ];

  return (
    <aside className="sidebar">
      <div
        style={{
          margin: "0 -2px 6px",
          padding: 12,
          borderRadius: 12,
          background: "rgba(255,255,255,0.025)",
          border: "1px solid var(--uff-line-soft)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: 3,
            background: teamColor,
            borderRadius: "0 2px 2px 0",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: teamColor,
              color: "#1a0f08",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-mono)",
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: "-0.04em",
            }}
          >
            {teamName[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 9.5,
                color: "var(--uff-text-mute)",
                fontWeight: 700,
                letterSpacing: ".16em",
                marginBottom: 2,
              }}
            >
              TEAM
            </div>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "var(--uff-text)",
              }}
            >
              {teamName}
            </div>
          </div>
        </div>
      </div>

      <div className="navlbl">Team</div>
      {items.map((it) => (
        <Link
          key={it.id}
          href={it.href}
          className={`navitem ${it.id === active ? "active" : ""}`}
        >
          <it.icon size={18} />
          <span>{it.label}</span>
        </Link>
      ))}

      <div className="spacer" />

      <Link
        href={leagueId ? `/dashboard/league/${leagueId}` : "/dashboard"}
        className="navitem"
        style={{ fontSize: 12, color: "var(--uff-text-mute)" }}
      >
        <Icon.arrowLeft size={13} />
        <span>{leagueId ? "Back to league" : "All workspaces"}</span>
      </Link>

      <div
        style={{
          marginTop: 8,
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--uff-line-soft)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--uff-orange)",
            color: "#1a0f08",
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {initials || "U"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, color: "var(--uff-text)" }}>
            {user.firstName} {user.lastName}
          </div>
        </div>
      </div>
    </aside>
  );
}
