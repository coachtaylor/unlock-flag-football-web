// One slot, one card, multiple position rows. Branch 7.5c.
//
// A breakdown pulse fans out a single (drill, type) slot into rows for
// each position the captain selected. Lets a single dashboard slot
// answer "how is each position doing on this drill?" instead of burning
// 3-4 slots on per-position pins.

import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import type { BreakdownPulse, BreakdownPulseRow } from "@/lib/dashboard/team-home-data";

function fmtVal(v: number | null, type: BreakdownPulse["benchmarkType"]): string {
  if (v == null) return "—";
  switch (type) {
    case "timed":
      return v.toFixed(2);
    case "rated":
      return v.toFixed(1);
    case "pct":
      return Math.round(v).toString();
    default:
      return Math.round(v).toString();
  }
}

function fmtDelta(
  row: BreakdownPulseRow,
  type: BreakdownPulse["benchmarkType"],
  unit: string
): { text: string; good: boolean } | null {
  if (row.delta == null) return null;
  const abs = Math.abs(row.delta);
  const formatted =
    type === "timed" ? abs.toFixed(2) : abs.toFixed(type === "rated" ? 1 : 0);
  const sign = row.delta < 0 ? "−" : "+";
  // For lower-is-better (timed), negative delta is good.
  const inverse = type === "timed" || type === "drops";
  const good = inverse ? row.delta < 0 : row.delta > 0;
  return {
    text: `${sign}${formatted}${unit.length <= 1 ? unit : ""}`,
    good,
  };
}

// Normalize a value to a 0..1 fill ratio for the row bar. Reference
// scale depends on benchmark type — for pct it's a literal percentage,
// for rated it's /5, for timed we use the max value in this breakdown
// as the reference so the highest bar fills the row.
function fillRatio(
  current: number | null,
  type: BreakdownPulse["benchmarkType"],
  maxInBreakdown: number
): number {
  if (current == null) return 0;
  if (type === "pct") return Math.max(0, Math.min(1, current / 100));
  if (type === "rated") return Math.max(0, Math.min(1, current / 5));
  // timed: lower is better, so invert relative to the slowest in the set
  if (type === "timed") {
    if (maxInBreakdown <= 0) return 0;
    return Math.max(0.06, Math.min(1, 1 - current / (maxInBreakdown * 1.1)));
  }
  // reps / flags / drops: scale against the row max so the leader fills
  if (maxInBreakdown <= 0) return 0;
  return Math.max(0.06, Math.min(1, current / maxInBreakdown));
}

export default function BreakdownPulseCard({ pulse }: { pulse: BreakdownPulse }) {
  const measured = pulse.rows.filter((r) => r.current != null);
  const maxValue = measured.length
    ? Math.max(...measured.map((r) => r.current ?? 0))
    : 0;

  return (
    <div
      className="w-card td-stat-cell"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <Link
            href={`/drills/${pulse.drillId}`}
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--uff-text-mute)",
              textDecoration: "none",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {pulse.drillName}
          </Link>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,106,26,0.14)",
                color: "var(--uff-orange)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {pulse.benchmarkType}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.04)",
                color: "var(--uff-text-dim)",
                fontFamily: "var(--font-mono)",
              }}
            >
              by position
            </span>
          </div>
        </div>
        <Icon.pin size={13} />
      </div>

      {/* Rows */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginTop: 2,
        }}
      >
        {pulse.rows.map((row) => {
          const fill = fillRatio(row.current, pulse.benchmarkType, maxValue);
          const delta = fmtDelta(row, pulse.benchmarkType, pulse.unit);
          const noData = row.current == null;
          return (
            <div
              key={row.position}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 60px 44px",
                gap: 8,
                alignItems: "center",
                fontSize: 11.5,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  fontSize: 10.5,
                  letterSpacing: "0.08em",
                  color: noData ? "var(--uff-text-mute)" : "var(--uff-text-dim)",
                }}
              >
                {row.position}
              </span>
              <div
                style={{
                  height: 6,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${fill * 100}%`,
                    height: "100%",
                    background: pulse.color,
                    opacity: noData ? 0 : 0.85,
                    borderRadius: 3,
                    transition: "width 240ms ease",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: "right",
                  color: noData ? "var(--uff-text-mute)" : "var(--uff-text)",
                  letterSpacing: "-0.01em",
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
                  color: delta
                    ? delta.good
                      ? "var(--uff-lime)"
                      : "var(--uff-red)"
                    : "transparent",
                }}
              >
                {delta?.text ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
