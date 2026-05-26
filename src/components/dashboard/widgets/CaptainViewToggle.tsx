"use client";

// Captain View Toggle: visible only when the logged-in user is a captain
// of this team (team_players.is_captain + matching user_id). Toggles
// between Coach view (default, team-wide data) and Player view (Pinned
// Pulses + Attendance filter to this captain's own data).
//
// Build 7 plan locks the toggle's scope to those two widgets — other
// widgets stay team-wide on purpose. We use a URL search-param so the
// state survives navigation and is shareable.

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function CaptainViewToggle({
  isCaptain,
}: {
  isCaptain: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("view") === "player" ? "player" : "coach";

  if (!isCaptain) return null;

  function setView(view: "coach" | "player") {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (view === "coach") next.delete("view");
    else next.set("view", "player");
    const qs = next.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <div
      role="tablist"
      aria-label="View mode"
      style={{
        display: "inline-flex",
        padding: 3,
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 999,
        gap: 2,
      }}
    >
      {(["coach", "player"] as const).map((v) => {
        const on = v === current;
        return (
          <button
            key={v}
            role="tab"
            aria-selected={on}
            onClick={() => setView(v)}
            style={{
              border: 0,
              background: on ? "var(--uff-orange)" : "transparent",
              color: on ? "#1a0f08" : "var(--uff-text-dim)",
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              padding: "5px 14px",
              borderRadius: 999,
              cursor: "pointer",
              transition: "background 0.12s, color 0.12s",
            }}
          >
            {v === "coach" ? "Coach view" : "Player view"}
          </button>
        );
      })}
    </div>
  );
}
