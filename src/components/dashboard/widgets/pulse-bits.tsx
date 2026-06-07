// Shared bits for pinned-pulse cards (Build 8.5 data-story pass).
// A pulse number is meaningless without a scale — these give the value an
// absolute reference so "how good" reads at a glance. Used by both the single
// pulse card and the by-position breakdown card (DRY).

import type { ReactNode } from "react";
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

// Trend pill: literal direction arrow, colored by good/bad (set `inverse` for
// lower-is-better metrics like timed drills). Honest about sparse data — a metric
// needs ≥2 readings to claim a trend. Shared by the pinned-pulse cards and the
// per-player skill-group card (DRY — one delta pill, not two).
export function TrendDelta({
  delta,
  points,
  inverse = false,
  formatMag,
  unit,
  suffix,
}: {
  delta: number | null;
  points: number;
  inverse?: boolean;
  formatMag: (mag: number) => string;
  unit?: string;
  suffix?: ReactNode;
}) {
  const muted = {
    fontSize: 10.5,
    color: "var(--uff-text-mute)",
    fontFamily: "var(--font-mono)",
  } as const;
  if (points === 0) return <span style={muted}>No readings in scope</span>;
  if (points === 1) return <span style={muted}>1 reading · log again to trend</span>;
  if (delta == null || delta === 0) {
    return (
      <span style={muted}>
        — flat{suffix != null ? <> {suffix}</> : null}
      </span>
    );
  }
  const good = inverse ? delta < 0 : delta > 0;
  const color = good ? "var(--uff-lime)" : "var(--uff-red)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        alignSelf: "flex-start",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        fontWeight: 700,
        color,
        background: good ? "rgba(194,255,61,0.12)" : "rgba(255,77,77,0.12)",
        padding: "2px 7px",
        borderRadius: 6,
      }}
    >
      {delta < 0 ? "▼" : "▲"}
      {formatMag(Math.abs(delta))}
      {unit}
      {suffix != null && (
        <span style={{ color: "var(--uff-text-mute)", fontWeight: 500 }}>{suffix}</span>
      )}
    </span>
  );
}
