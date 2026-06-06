// One slot, one card: a (drill, type) pulse fanned out by position.
//
// Build 8.5 (data-story pass): the old multi-line sparkline was unreadable —
// overlapping polylines you couldn't map to a position or compare. Replaced
// with one row per position: a colored scale bar (level, instantly comparable)
// + current value + trend delta. For trend-only types with no absolute ceiling
// (timed), the row falls back to a per-position sparkline.

import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import Spark from "./Spark";
import { ScaleBar, scaleMaxFor } from "./pulse-bits";
import UnpinPulseButton from "./UnpinPulseButton";
import { positionColor } from "@/lib/positions";
import type { BreakdownPulse, BreakdownPulseRow } from "@/lib/dashboard/team-home-data";

function fmtVal(v: number | null, type: BreakdownPulse["benchmarkType"]): string {
  if (v == null) return "—";
  if (type === "timed") return v.toFixed(2);
  if (type === "rated") return v.toFixed(1);
  return Math.round(v).toString();
}

function fmtDelta(
  row: BreakdownPulseRow,
  type: BreakdownPulse["benchmarkType"],
  unit: string
): { text: string; good: boolean } | null {
  if (row.delta == null || row.delta === 0) return null;
  const abs = Math.abs(row.delta);
  const formatted = type === "timed" ? abs.toFixed(2) : abs.toFixed(type === "rated" ? 1 : 0);
  const inverse = type === "timed" || type === "drops";
  const good = inverse ? row.delta < 0 : row.delta > 0;
  return {
    text: `${row.delta < 0 ? "▼" : "▲"}${formatted}${unit.length <= 1 ? unit : ""}`,
    good,
  };
}

export default function BreakdownPulseCard({
  pulse,
  teamId,
  canPin,
}: {
  pulse: BreakdownPulse;
  teamId: string;
  canPin: boolean;
}) {
  const scaleMax = scaleMaxFor(pulse.benchmarkType);
  // Strongest first so the comparison reads top-down; nulls sink to the bottom.
  const rows = [...pulse.rows].sort((a, b) => {
    if (a.current == null) return 1;
    if (b.current == null) return -1;
    return pulse.inverse ? a.current - b.current : b.current - a.current;
  });

  return (
    <div
      className="w-card td-stat-cell"
      style={{ position: "relative", padding: 16, display: "flex", flexDirection: "column" }}
    >
      {canPin ? (
        <UnpinPulseButton pinId={pulse.pinId} drillId={pulse.drillId} teamId={teamId} />
      ) : (
        <span className="pulse-unpin" style={{ pointerEvents: "none" }}>
          <Icon.pin size={13} />
        </span>
      )}

      <Link
        href={`/dashboard/team/${teamId}/drills/${pulse.drillId}`}
        style={{ display: "flex", flexDirection: "column", gap: 12, textDecoration: "none", color: "inherit" }}
      >
        {/* header: drill name (title) + scope line */}
        <div style={{ minWidth: 0, paddingRight: 26 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--uff-text)",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {pulse.drillName}
          </span>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--uff-text-mute)",
              marginTop: 3,
            }}
          >
            {pulse.benchmarkType} · by position
          </div>
        </div>

        {/* per-position rows: dot · code · bar/trend · value · delta */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map((row) => {
          const color = positionColor(row.position);
          const delta = fmtDelta(row, pulse.benchmarkType, pulse.unit);
          const noData = row.current == null;
          return (
            <div
              key={row.position}
              style={{
                display: "grid",
                gridTemplateColumns: "34px 1fr 52px 46px",
                gap: 8,
                alignItems: "center",
                fontSize: 11.5,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  fontSize: 10.5,
                  letterSpacing: "0.06em",
                  color: noData ? "var(--uff-text-mute)" : "var(--uff-text-dim)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: noData ? "var(--uff-line)" : color,
                    flex: "none",
                  }}
                />
                {row.position}
              </span>

              {scaleMax != null ? (
                <ScaleBar value={row.current} max={scaleMax} color={noData ? "var(--uff-line)" : color} />
              ) : (
                <Spark data={row.series} color={noData ? "var(--uff-line-soft)" : color} w={120} h={20} fill={false} />
              )}

              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: noData ? "var(--uff-text-mute)" : "var(--uff-text)",
                  letterSpacing: "-0.01em",
                  textAlign: "right",
                }}
              >
                {fmtVal(row.current, pulse.benchmarkType)}
                {!noData && pulse.unit && (
                  <span style={{ fontSize: 9.5, color: "var(--uff-text-dim)", marginLeft: 1 }}>
                    {pulse.unit}
                  </span>
                )}
              </span>

              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  textAlign: "right",
                  color: delta ? (delta.good ? "var(--uff-lime)" : "var(--uff-red)") : "var(--uff-text-mute)",
                }}
              >
                {delta?.text ?? "—"}
              </span>
            </div>
          );
        })}
        </div>
      </Link>
    </div>
  );
}
