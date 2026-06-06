// Shared bits for pinned-pulse cards (Build 8.5 data-story pass).
// A pulse number is meaningless without a scale — these give the value an
// absolute reference so "how good" reads at a glance. Used by both the single
// pulse card and the by-position breakdown card (DRY).

import type { PulseBenchmarkType } from "@/lib/dashboard/team-home-data";

// Absolute ceiling for the scale bar. Timed/reps/flags/drops have no fixed
// ceiling (they're trend-only), so they return null and skip the bar.
export function scaleMaxFor(type: PulseBenchmarkType): number | null {
  if (type === "pct") return 100;
  if (type === "rated") return 5;
  return null;
}

export function ScaleBar({
  value,
  max,
  color,
  height = 5,
}: {
  value: number | null;
  max: number;
  color: string;
  height?: number;
}) {
  const frac = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div
      style={{
        height,
        borderRadius: 999,
        background: "var(--uff-line-soft)",
        overflow: "hidden",
      }}
      aria-hidden
    >
      <div
        style={{
          width: `${Math.max(2, frac * 100)}%`,
          height: "100%",
          borderRadius: 999,
          background: color,
        }}
      />
    </div>
  );
}
