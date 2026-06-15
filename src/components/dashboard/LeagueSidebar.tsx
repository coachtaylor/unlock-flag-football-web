// League-context sidebar — rendered on /dashboard/league/[id] and on
// /teams/new when a league is preset / picked. Header chip shows the
// league identity; nav items scope to that league.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashIcon } from "@/components/uff/icons";
import BrandMark from "@/components/marketing/BrandMark";
import SidebarCollapseToggle from "./SidebarCollapseToggle";
import type { SidebarWorkspace } from "@/lib/dashboard/sidebar-workspaces";

export type LeagueContext = {
  id: string;
  name: string;
  color: string;
  teams: number;
  members: number;
};

type Props = {
  league: LeagueContext;
  user: { firstName: string; lastName: string };
  accent?: string;
  // Other workspaces the user can access (sibling leagues + standalone
  // teams). Fetched server-side via loadSidebarWorkspacesForLeague so the
  // league sidebar can navigate sideways the same way the team one does.
  workspaces?: SidebarWorkspace[];
};

export default function LeagueSidebar({
  league,
  user,
  accent = "var(--uff-orange)",
  workspaces = [],
}: Props) {
  const pathname = usePathname();
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  const overviewHref = `/dashboard/league/${league.id}`;
  const items: { id: string; label: string; icon: typeof DashIcon.home; href: string; count?: string }[] = [
    { id: "overview", label: "Overview", icon: DashIcon.home, href: overviewHref },
    { id: "teams", label: "Teams", icon: DashIcon.team, href: overviewHref, count: String(league.teams) },
    { id: "members", label: "Members", icon: DashIcon.users, href: overviewHref, count: String(league.members) },
    { id: "settings", label: "Settings", icon: DashIcon.gear, href: "/settings" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <SidebarCollapseToggle />
      </div>
      <div className="brand">
        <BrandMark className="mark" />
        <div className="name">
          <span className="t">Unlock FF</span>
          <span className="s">League console</span>
        </div>
      </div>

      <div
        className="context-card when-expanded"
        style={{
          margin: "0 -2px 6px",
          padding: "12px 12px",
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
            background: league.color,
            borderRadius: "0 2px 2px 0",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: league.color,
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
            {league.name[0]}
          </div>
          <div className="when-expanded" style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 9.5,
                color: "var(--uff-text-mute)",
                fontWeight: 700,
                letterSpacing: ".16em",
                marginBottom: 2,
              }}
            >
              LEAGUE · ADMIN
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
              {league.name}
            </div>
          </div>
        </div>
      </div>

      <div className="navlbl">League</div>
      {items.map((it) => {
        const active =
          it.id === "settings"
            ? pathname.startsWith("/settings")
            : it.href === overviewHref
              ? it.id === "overview" && pathname === overviewHref
              : pathname === it.href;
        return (
          <Link
            key={it.id}
            href={it.href}
            className={`navitem ${active ? "active" : ""}`}
            title={it.label}
          >
            <it.icon size={18} />
            <span>{it.label}</span>
            {it.count && <span className="count">{it.count}</span>}
          </Link>
        );
      })}

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
        title={`${user.firstName} ${user.lastName} · League admin`}
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
            background: accent,
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
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.2,
              color: "var(--uff-text)",
            }}
          >
            {user.firstName} {user.lastName}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: "var(--uff-text-mute)",
              letterSpacing: ".04em",
            }}
          >
            League admin
          </div>
        </div>
      </div>
    </aside>
  );
}
