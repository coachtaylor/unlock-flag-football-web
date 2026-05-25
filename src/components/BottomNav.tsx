"use client";

// Bottom navigation bar — always visible at the bottom of every screen
// except auth and team setup screens.
//
// Coach MVP tabs: Dashboard, Drills, Roster, Practice.
// Active tab is determined by the current URL path.
// Uses orange-400 for the active tab, muted white for inactive.

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    // Grid/dashboard icon
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" />
        <rect
          x="11"
          y="11"
          width="7"
          height="7"
          rx="1.5"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    label: "Drills",
    href: "/drills",
    // Whistle icon
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M13 7.5a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M13 6l5-2.5v8L13 9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8.5" cy="7.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Roster",
    href: "/roster",
    // People icon
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M2 17c0-2.5 2.5-4.5 5-4.5s5 2 5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle
          cx="14"
          cy="8"
          r="2.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M13 13c2.5 0 5 1.5 5 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "Practice",
    href: "/practice",
    // Clipboard/calendar icon
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect
          x="3.5"
          y="4"
          width="13"
          height="14"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M7 2v3M13 2v3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M3.5 8.5h13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

const HIDDEN_PATHS = ["/team-setup"];

export default function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.includes(pathname)) return null;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="fixed left-0 right-0 bottom-0 z-50 md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        backgroundColor: "rgba(13, 17, 23, 0.85)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderTop: "1px solid var(--color-border-subtle)",
      }}
    >
      <div
        className="flex items-stretch justify-around"
        style={{ height: "64px", paddingInline: "8px" }}
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-[4px] flex-1 no-underline transition-all"
              style={{
                color: active
                  ? "var(--color-orange-400)"
                  : "rgba(255, 255, 255, 0.5)",
                minHeight: "44px",
              }}
            >
              <span
                className="flex items-center justify-center transition-all"
                style={{
                  width: "40px",
                  height: "26px",
                  borderRadius: "13px",
                  backgroundColor: active
                    ? "rgba(232, 148, 74, 0.14)"
                    : "transparent",
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  lineHeight: 1,
                  letterSpacing: "0.2px",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
