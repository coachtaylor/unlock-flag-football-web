// Canonical relative/absolute timestamp formatting (Build 14.5).
//
// ONE source of truth for every coach-attribution byline and the activity
// feed. The locked rule: show a relative age within the last 7 days, then an
// absolute calendar date once it's a week or older. The mobile app mirrors
// this exactly in lib/date.ts (keep the two in sync).
//
// (Two older, divergent `relativeTime()` helpers exist — one in
// team-home-data.ts for the feed, one in DrillsLibraryClient.tsx for the
// compact "last run" badge. The feed one is replaced by this; the drills
// badge keeps its own compact w/mo/y contract on purpose.)

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Format an ISO timestamp for an attribution byline / activity row.
 *  < 1 min   -> "just now"
 *  < 1 hour  -> "Nm ago"
 *  < 1 day   -> "Nh ago"
 *  < 7 days  -> "Nd ago"  (1 -> "yesterday")
 *  >= 7 days -> "Jun 1"   (+ ", 2025" when not the current year)
 * Returns "" for a missing/invalid input so callers can render nothing.
 */
export function formatActorTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso);
  const t = then.getTime();
  if (Number.isNaN(t)) return "";

  const now = Date.now();
  const diff = now - t;

  if (diff < SEVEN_DAYS_MS) {
    if (diff < 60_000) return "just now";
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? "yesterday" : `${d}d ago`;
  }

  const label = `${MONTHS[then.getMonth()]} ${then.getDate()}`;
  const thisYear = new Date(now).getFullYear();
  return then.getFullYear() === thisYear ? label : `${label}, ${then.getFullYear()}`;
}
