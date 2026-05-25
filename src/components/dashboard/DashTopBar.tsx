// Sticky top bar used across the workspace dashboards.
// Layout: [crumbs · title · kicker]  [search]  [actions / avatar]

"use client";

import { type ReactNode } from "react";
import { DashIcon } from "@/components/uff/icons";

type Crumb = { label: string; href?: string };

type Props = {
  crumbs?: Crumb[];
  title: string;
  kicker?: string;
  actions?: ReactNode;
  showSearch?: boolean;
  userInitials?: string;
  userAccent?: string;
};

export default function DashTopBar({
  crumbs = [],
  title,
  kicker,
  actions,
  showSearch = true,
  userInitials = "U",
  userAccent = "var(--uff-orange)",
}: Props) {
  return (
    <div className="topbar">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          flexWrap: "wrap",
        }}
      >
        {crumbs.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--uff-text-mute)",
            }}
          >
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {c.href ? (
                  <a
                    href={c.href}
                    style={{ color: "inherit", textDecoration: "none", cursor: "pointer" }}
                  >
                    {c.label}
                  </a>
                ) : (
                  <span>{c.label}</span>
                )}
                <span style={{ color: "var(--uff-line)" }}>/</span>
              </span>
            ))}
          </div>
        )}
        <strong
          style={{
            color: "var(--uff-text)",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </strong>
        {kicker && (
          <>
            <span style={{ color: "var(--uff-text-mute)", fontSize: 12 }}>·</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--uff-text-mute)",
                letterSpacing: ".04em",
              }}
            >
              {kicker}
            </span>
          </>
        )}
      </div>

      {showSearch && (
        <div className="search">
          <DashIcon.home size={14} />
          <span>Search leagues, teams, players…</span>
          <kbd>⌘K</kbd>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {actions}
        <button className="icon-btn" type="button" aria-label="Notifications">
          <DashIcon.bell size={16} />
          <span className="dot" />
        </button>
        <div className="avatar" style={{ background: userAccent }}>
          {userInitials}
        </div>
      </div>
    </div>
  );
}
