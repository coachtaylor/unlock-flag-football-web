"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useTeam } from "@/lib/team-context";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const PRIMARY: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Drills",
    href: "/drills",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
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
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M2 17c0-2.5 2.5-4.5 5-4.5s5 2 5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="14" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
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
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
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

const SECONDARY: NavItem[] = [
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-md no-underline transition-colors"
      style={{
        height: "40px",
        paddingInline: "12px",
        borderRadius: "10px",
        color: active
          ? "var(--color-orange-400)"
          : "var(--color-text-secondary)",
        backgroundColor: active ? "rgba(232, 148, 74, 0.10)" : "transparent",
      }}
    >
      <span className="flex items-center justify-center" style={{ width: 20 }}>
        {item.icon}
      </span>
      <span className="text-body font-medium">{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { teamName } = useTeam();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside
      className="hidden md:flex md:flex-col fixed left-0 top-0 bottom-0 z-30"
      style={{
        width: "240px",
        backgroundColor: "var(--color-surface-raised)",
        borderRight: "1px solid var(--color-border-subtle)",
      }}
    >
      <div
        className="flex flex-col"
        style={{ padding: "20px 16px 12px 16px" }}
      >
        <p
          className="label-micro"
          style={{ color: "var(--color-orange-300)" }}
        >
          Unlock FF
        </p>
        <p
          className="text-heading font-medium mt-xs truncate"
          style={{ color: "var(--color-text-primary)" }}
          title={teamName ?? "Your team"}
        >
          {teamName ?? "Your team"}
        </p>
      </div>

      <nav
        className="flex flex-col gap-xs"
        style={{ padding: "12px 8px" }}
      >
        {PRIMARY.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="flex-1" />

      <div
        className="flex flex-col gap-xs"
        style={{
          padding: "12px 8px 20px 8px",
          borderTop: "1px solid var(--color-border-subtle)",
        }}
      >
        {SECONDARY.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-md text-left transition-colors"
          style={{
            height: "40px",
            paddingInline: "12px",
            borderRadius: "10px",
            color: "var(--color-text-secondary)",
            backgroundColor: "transparent",
          }}
        >
          <span
            className="flex items-center justify-center"
            style={{ width: 20 }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M8 3H4.5A1.5 1.5 0 003 4.5v11A1.5 1.5 0 004.5 17H8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M13 6l4 4-4 4M17 10H8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-body font-medium">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
