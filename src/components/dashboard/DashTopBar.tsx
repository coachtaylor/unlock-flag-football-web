// Sticky top bar used across the workspace dashboards.
// Layout: [crumbs · title · kicker]  [search]  [actions / avatar]

"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { DashIcon } from "@/components/uff/icons";

type Crumb = { label: string; href?: string };

type Props = {
  crumbs?: Crumb[];
  /** Short uppercase mono label rendered to the LEFT of the title (e.g. "SCOPE"). */
  eyebrow?: string;
  title: string;
  /** Same look as eyebrow but rendered to the RIGHT of the title. */
  kicker?: string;
  /** Lifecycle pill rendered on the right side (e.g. "CREATE" / "DRAFT" / "PUBLISHED"). */
  status?: string;
  actions?: ReactNode;
  showSearch?: boolean;
  userInitials?: string;
  userAccent?: string;
};

function pickStatusColor(status: string): string {
  const k = status.trim().toUpperCase();
  if (k.startsWith("DRAFT")) return "var(--uff-orange)";
  if (k.startsWith("PUBLISHED")) return "#4ADE80";
  // CREATE / NEW / UNSAVED / anything else falls back to lime.
  return "var(--uff-lime)";
}

export default function DashTopBar({
  crumbs = [],
  eyebrow,
  title,
  kicker,
  status,
  actions,
  showSearch = true,
  userInitials = "U",
  userAccent = "var(--uff-orange)",
}: Props) {
  const statusColor = status ? pickStatusColor(status) : null;
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
              color: "var(--uff-text)",
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
        {eyebrow && (
          <>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--uff-lime)",
                letterSpacing: ".1em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              {eyebrow}
            </span>
            <span style={{ color: "var(--uff-text)", fontSize: 12 }}>·</span>
          </>
        )}
        <strong
          style={{
            color: "var(--uff-orange)",
            fontFamily: "var(--font-mono)",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </strong>
        {status && statusColor && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              marginLeft: 4,
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: statusColor,
            }}
          >
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: statusColor,
                boxShadow: `0 0 0 1.5px color-mix(in srgb, ${statusColor} 22%, transparent)`,
              }}
            />
            {status}
          </span>
        )}
        {kicker && (
          <>
            <span style={{ color: "var(--uff-text)", fontSize: 12 }}>·</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--uff-text)",
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginLeft: showSearch ? undefined : "auto",
        }}
      >
        {actions}
        <button className="icon-btn" type="button" aria-label="Notifications">
          <DashIcon.bell size={16} />
          <span className="dot" />
        </button>
        <Link
          href="/settings"
          className="avatar"
          style={{ background: userAccent, textDecoration: "none" }}
          aria-label="Account settings"
          title="Account settings"
        >
          {userInitials}
        </Link>
      </div>
    </div>
  );
}
