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

function variantFor(status: PlanStatus, planId: string): Variant | null {
  if (status === "completed") return null;
  if (status === "draft") {
    return {
      tone: "muted",
      headline: "This draft never got finalized — and the date's passed.",
      sub: "Drafts can't be logged. Finalize the plan to keep it, or push the date out.",
      primaryLabel: "Finalize plan",
      primaryHref: `/practice/${planId}/edit`,
      secondaryLabel: "Move the date",
      secondaryHref: `/practice/${planId}/edit`,
    };
  }
  if (status === "scheduled") {
    return {
      tone: "primary",
      headline: "Your scheduled practice is in the rearview — log it before it fades.",
      sub: "Mark drills done or skipped, capture observations, and set attendance while it's still fresh.",
      primaryLabel: "Log practice",
      primaryHref: `/practice/${planId}/log`,
      secondaryLabel: "Reschedule",
      secondaryHref: `/practice/${planId}/edit`,
    };
  }
  // live
  return {
    tone: "primary",
    headline: "This practice is still marked live — wrap it up.",
    sub: "You started it on the field but never logged the end. Close it out to clear it.",
    primaryLabel: "Wrap it up",
    primaryHref: `/practice/${planId}/log`,
    secondaryLabel: "Reschedule",
    secondaryHref: `/practice/${planId}/edit`,
  };
}

export default function PastDueBanner({
  status,
  planId,
  isPastDue,
  showDraftBlockedNotice,
}: {
  status: PlanStatus;
  planId: string;
  isPastDue: boolean;
  // True when the user just got redirected here from /practice/[id]/log
  // because their plan is still a draft. Renders an inline notice above
  // the banner regardless of past-due state.
  showDraftBlockedNotice?: boolean;
}) {
  const variant = isPastDue ? variantFor(status, planId) : null;
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

// Convenience: server-side past-due check. Uses ISO YYYY-MM-DD compare
// against `new Date()` in the server's timezone. Good enough for the
// banner — a captain in California seeing a "past due" 8 hours early
// for a UTC-vs-PT delta is not a real problem.
export function isPlanPastDue(
  practiceDate: string,
  status: PlanStatus,
): boolean {
  if (status === "completed") return false;
  const today = new Date().toISOString().slice(0, 10);
  return practiceDate < today;
}

// Inline chip used alongside the status pill on list cards. Same accent
// as the banner so the visual language reads as one signal.
export function PastDueChip() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(255,106,26,0.12)",
        color: "var(--uff-orange)",
        border: "1px solid rgba(255,106,26,0.32)",
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: 9.5,
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
