// Team-context sidebar — primary nav rendered inside the .uff-web shell
// for any team-scoped page (team dashboard, drills, roster, practice,
// benchmarks, settings). The `active` prop highlights the current item;
// the `teamId` prop drives the back-to-dashboard link.
//
// Lifted out of `(workspace)/dashboard/team/[teamId]/page.tsx` so the new
// Drills surface (Build 4) and the future Roster / Practice / Benchmarks
// surfaces (Build 6) reuse the same nav instead of duplicating it.

import Link from "next/link";
import { DashIcon } from "@/components/uff/icons";
import SidebarCollapseToggle from "./SidebarCollapseToggle";
import type { SidebarWorkspace } from "@/lib/dashboard/sidebar-workspaces";

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
  // Other workspaces the user has access to (siblings to the current
  // team). Fetched server-side via `loadSidebarWorkspaces` and passed in
  // so this component stays synchronous — needed because some callers
  // (e.g. DrillForm) are client components that can't render an async
  // server component.
  workspaces?: SidebarWorkspace[];
};

// `leagueId` is in Props (existing callers still pass it) but unused
// inside the component now — its job is handled server-side by
// loadSidebarWorkspaces, which turns the parent league into a
// `workspaces` entry. We don't destructure it here to keep the lint
// surface clean.
export default function TeamSidebar({
  active,
  teamId,
  teamColor,
  teamName,
  user,
  workspaces = [],
}: Props) {
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const items: {
    id: NavId;
    label: string;
    href: string;
    icon: typeof DashIcon.home;
  }[] = [
    { id: "dashboard", label: "Dashboard", href: `/dashboard/team/${teamId}`, icon: DashIcon.home },
    { id: "roster", label: "Roster", href: `/dashboard/team/${teamId}/roster`, icon: DashIcon.team },
    { id: "drills", label: "Drills", href: "/drills", icon: DashIcon.drills },
    { id: "practice", label: "Practice", href: "/practice", icon: DashIcon.practice },
    { id: "benchmarks", label: "Benchmarks", href: "/benchmarks", icon: DashIcon.rules },
    { id: "settings", label: "Settings", href: "/settings", icon: DashIcon.gear },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-head sidebar-head--split">
        <div
          className="team-mark"
          title={teamName}
          aria-label={teamName}
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
            flexShrink: 0,
          }}
        >
          {teamName[0]}
        </div>
        <SidebarCollapseToggle />
      </div>

      <div className="navlbl">Team</div>
      {items.map((it) => (
        <Link
          key={it.id}
          href={it.href}
          className={`navitem ${it.id === active ? "active" : ""}`}
          title={it.label}
        >
          <it.icon size={18} />
          <span>{it.label}</span>
        </Link>
      ))}

      <div className="navlbl">Workspaces</div>
      {workspaces.map((w) => {
        const href =
          w.kind === "league"
            ? `/dashboard/league/${w.id}`
            : `/dashboard/team/${w.id}`;
        return (
          <Link
            key={`${w.kind}-${w.id}`}
            href={href}
            className="navitem"
            title={`${w.name} (${w.kind})`}
            style={{ paddingLeft: 10 }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: w.color,
                color: "#1a0f08",
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                flexShrink: 0,
              }}
            >
              {w.name[0]}
            </div>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {w.name}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: ".12em",
                color: "var(--uff-text-mute)",
              }}
            >
              {w.kind === "league" ? "LEAGUE" : "TEAM"}
            </span>
          </Link>
        );
      })}
      <Link
        href="/dashboard"
        className="navitem"
        title="All workspaces"
        style={{ paddingLeft: 10, fontSize: 12, color: "var(--uff-text-mute)" }}
      >
        <DashIcon.grid size={18} />
        <span>All workspaces</span>
      </Link>

      <div className="spacer" />

      <div
        className="user-card"
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
        title={`${user.firstName} ${user.lastName}`}
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
            flexShrink: 0,
          }}
        >
          {initials || "U"}
        </div>
        <div className="when-expanded" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, color: "var(--uff-text)" }}>
            {user.firstName} {user.lastName}
          </div>
        </div>
      </div>
    </aside>
  );
}
