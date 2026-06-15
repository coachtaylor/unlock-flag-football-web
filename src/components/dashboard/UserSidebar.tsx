// User-context sidebar — rendered on /dashboard and /teams/new (when no
// league preset). Lists Home / Activity / Settings, then the user's
// Workspaces (up to 4) so they can jump between them.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashIcon } from "@/components/uff/icons";
import BrandMark from "@/components/marketing/BrandMark";
import SidebarCollapseToggle from "./SidebarCollapseToggle";

export type WorkspaceItem = {
  id: string;
  kind: "league" | "team";
  name: string;
  color: string;
};

type Props = {
  workspaces: WorkspaceItem[];
  user: { firstName: string; lastName: string; email: string };
  accent?: string;
};

export default function UserSidebar({
  workspaces,
  user,
  accent = "var(--uff-orange)",
}: Props) {
  const pathname = usePathname();
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  const main = [
    { id: "home", label: "Home", icon: DashIcon.home, href: "/dashboard" },
    { id: "activity", label: "Activity", icon: DashIcon.bell, href: "/dashboard" },
    { id: "settings", label: "Settings", icon: DashIcon.gear, href: "/settings" },
  ];

  const isActive = (id: string) => {
    if (id === "home") return pathname === "/dashboard";
    if (id === "settings") return pathname.startsWith("/settings");
    return false;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <SidebarCollapseToggle />
      </div>
      <div className="brand">
        <BrandMark className="mark" />
        <div className="name">
          <span className="t">Unlock FF</span>
          <span className="s">Your account</span>
        </div>
      </div>

      <div className="navlbl">Account</div>
      {main.map((it) => (
        <Link
          key={it.id}
          href={it.href}
          className={`navitem ${isActive(it.id) ? "active" : ""}`}
          title={it.label}
        >
          <it.icon size={18} />
          <span>{it.label}</span>
        </Link>
      ))}

      {workspaces.length > 0 && (
        <>
          <div className="navlbl">Workspaces</div>
          {workspaces.slice(0, 4).map((w) => {
            const href =
              w.kind === "league"
                ? `/dashboard/league/${w.id}`
                : `/dashboard/team/${w.id}`;
            const active =
              w.kind === "league"
                ? pathname === `/dashboard/league/${w.id}`
                : pathname === `/dashboard/team/${w.id}`;
            return (
              <Link
                key={`${w.kind}-${w.id}`}
                href={href}
                className={`navitem ${active ? "active" : ""}`}
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
        </>
      )}

      <div className="spacer" />

      <div
        className="user-card"
        title={`${user.firstName} ${user.lastName} · ${user.email}`}
        style={{
          marginTop: 14,
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
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.email}
          </div>
        </div>
      </div>
    </aside>
  );
}
