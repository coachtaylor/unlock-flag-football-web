// Past-due nudge that sits above the hero on /practice/[id]. Shown
// whenever practice_date < today (server-local) AND status != completed.
// Variant copy + CTAs depend on status:
//   draft     → never finalized; can't be logged
//   scheduled → most common case — practice happened, log it
//   live      → captain started it, never closed it
//
// Copy reviewed via /ux-copy on 2026-05-27.

import Link from "next/link";
import type { PlanStatus } from "@/lib/practice/plan-data";

type Variant = {
  tone: "muted" | "primary";
  headline: string;
  sub: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

function variantFor(status: PlanStatus, planId: string, base: string): Variant | null {
  if (status === "completed") return null;
  if (status === "draft") {
    return {
      tone: "muted",
      headline: "This draft never got finalized — and the date's passed.",
      sub: "Drafts can't be logged. Finalize the plan to keep it, or push the date out.",
      primaryLabel: "Finalize plan",
      primaryHref: `${base}/${planId}/edit`,
      secondaryLabel: "Move the date",
      secondaryHref: `${base}/${planId}/edit`,
    };
  }
  if (status === "scheduled") {
    return {
      tone: "primary",
      headline: "Your scheduled practice is in the rearview — log it before it fades.",
      sub: "Mark drills done or skipped, capture observations, and set attendance while it's still fresh.",
      primaryLabel: "Log practice",
      primaryHref: `${base}/${planId}/log`,
      secondaryLabel: "Reschedule",
      secondaryHref: `${base}/${planId}/edit`,
    };
  }
  // live
  return {
    tone: "primary",
    headline: "This practice is still marked live — wrap it up.",
    sub: "You started it on the field but never logged the end. Close it out to clear it.",
    primaryLabel: "Wrap it up",
    primaryHref: `${base}/${planId}/log`,
    secondaryLabel: "Reschedule",
    secondaryHref: `${base}/${planId}/edit`,
  };
}

export default function PastDueBanner({
  status,
  planId,
  base,
  isPastDue,
  showDraftBlockedNotice,
}: {
  status: PlanStatus;
  planId: string;
  // Team-scoped practice base path (`/dashboard/team/[teamId]/practice`).
  base: string;
  isPastDue: boolean;
  // True when the user just got redirected here from the log page
  // because their plan is still a draft. Renders an inline notice above
  // the banner regardless of past-due state.
  showDraftBlockedNotice?: boolean;
}) {
  const variant = isPastDue ? variantFor(status, planId, base) : null;
  if (!variant && !showDraftBlockedNotice) return null;

  const accent =
    variant?.tone === "primary"
      ? "var(--uff-orange)"
      : "var(--uff-line)";
  const bg =
    variant?.tone === "primary"
      ? "rgba(255,106,26,0.06)"
      : "rgba(255,255,255,0.03)";
  const border =
    variant?.tone === "primary"
      ? "rgba(255,106,26,0.32)"
      : "var(--uff-line)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {showDraftBlockedNotice && (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            border: "1px solid var(--uff-line)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 10,
            fontSize: 13,
            color: "var(--uff-text-dim)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: "var(--uff-orange)",
              flexShrink: 0,
            }}
          />
          Drafts can&apos;t be logged. Finalize the plan first, then log what
          happened at practice.
        </div>
      )}

      {variant && (
        <div
          role="region"
          aria-label="Past-due practice"
          style={{
            position: "relative",
            padding: "16px 18px 18px",
            border: `1px solid ${border}`,
            background: bg,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              background: accent,
            }}
          />
          <div
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10.5,
              color: "var(--uff-text-mute)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Past due
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--uff-text)",
              lineHeight: 1.3,
              letterSpacing: "-0.005em",
            }}
          >
            {variant.headline}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: "var(--uff-text-dim)",
              lineHeight: 1.5,
            }}
          >
            {variant.sub}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={variant.primaryHref} className="wbtn primary">
              {variant.primaryLabel}
            </Link>
            <Link href={variant.secondaryHref} className="wbtn">
              {variant.secondaryLabel}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// A scheduled/live practice is "past due" once its scheduled start slipped
// more than this long ago. Matches the mobile list (lib practice index).
export const PAST_DUE_GRACE_MS = 6 * 60 * 60 * 1000;

// Past-due check: now is >6h past the practice's scheduled start
// (practice_date + start_time, or end-of-day when no time is set).
// Completed practices are never past due.
export function isPlanPastDue(
  practiceDate: string,
  startTime: string | null,
  status: PlanStatus,
): boolean {
  if (status === "completed") return false;
  if (!practiceDate) return false;
  const [y, m, d] = practiceDate.split("-").map(Number);
  if (!y || !m || !d) return false;
  let dueMs: number;
  if (startTime) {
    const [hh = 0, mm = 0] = startTime.split(":").map(Number);
    dueMs = new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
  } else {
    // No start time — anchor to end of that day so we don't flag it early.
    dueMs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  }
  return Date.now() - dueMs > PAST_DUE_GRACE_MS;
}

// Inline label used alongside the status pill on list cards. Plain red
// bold text — no pill/background — so it reads as an urgent signal next
// to the status pill rather than another chip.
export function PastDueChip() {
  return (
    <span
      style={{
        color: "var(--uff-red, #ff4d4d)",
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      Past due
    </span>
  );
}
