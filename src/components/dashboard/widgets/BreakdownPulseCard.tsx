// One slot, one card, multi-position sparkline + legend. Branch 7.5c.
//
// A breakdown pulse fans out a single (drill, type) slot into multiple
// position-scoped sub-rows. Card layout:
//   - Header: drill name + type chip + "BY POSITION" chip
//   - Body:   one multi-line sparkline (per-position color)
//   - Legend: one row per position — colored dot, code, value, delta
//
// Replaces the bar-fill variant: sparkline shows trend (8-week window),
// legend shows current value + delta. Picks the type-aware Y normalization
// up from the source data so all positions render on the same Y scale.

import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import { positionColor } from "@/lib/positions";
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
  const inverse = type === "timed" || type === "drops";
  const good = inverse ? row.delta < 0 : row.delta > 0;
  return {
    text: `${sign}${formatted}${unit.length <= 1 ? unit : ""}`,
    good,
  };
}

type SparklineProps = {
  rows: BreakdownPulseRow[];
  width: number;
  height: number;
  inverse: boolean; // lower-is-better → invert the Y mapping
};

// Render N polylines on a shared SVG. Each position gets POSITION_COLOR
// for stroke. All series share one Y domain so values are comparable.
function MultiSparkline({ rows, width, height, inverse }: SparklineProps) {
  // Collect all sample values across all rows to pick a shared Y range.
  // Empty positions (no samples logged ever) contribute a flat zero
  // series so the others still render correctly.
  const allValues = rows.flatMap((r) => r.series.filter((v) => v > 0));
  if (allValues.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block" }}
      >
        <line
          x1={0}
          y1={height - 1}
          x2={width}
          y2={height - 1}
          stroke="var(--uff-line-soft)"
          strokeDasharray="2 3"
        />
        <text
          x={width / 2}
          y={height / 2 + 4}
          textAnchor="middle"
          fontSize={10}
          fill="var(--uff-text-mute)"
          fontFamily="var(--font-mono)"
          letterSpacing="0.10em"
        >
          NO DATA YET
        </text>
      </svg>
    );
  }
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = Math.max(0.0001, max - min);

  // Find longest series length so x mapping uses a stable denominator.
  const n = Math.max(...rows.map((r) => r.series.length), 1);
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const xAt = (i: number) => pad + (innerW * i) / Math.max(1, n - 1);
  const yAt = (v: number) => {
    const norm = (v - min) / span;
    return inverse ? pad + norm * innerH : pad + innerH - norm * innerH;
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      {/* Baseline grid hint */}
      <line
        x1={0}
        y1={height - 1}
        x2={width}
        y2={height - 1}
        stroke="var(--uff-line-soft)"
        strokeDasharray="2 4"
        opacity={0.5}
      />
      {rows.map((row) => {
        // Skip series with no data at all so we don't draw a flat line at 0.
        const hasData = row.series.some((v) => v > 0);
        if (!hasData) return null;
        const stroke = positionColor(row.position);
        const d = row.series
          .map(
            (v, i) =>
              `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`
          )
          .join(" ");
        // Highlight current value with a slightly larger dot.
        const lastIdx = row.series.length - 1;
        const cx = xAt(lastIdx);
        const cy = yAt(row.series[lastIdx]);
        return (
          <g key={row.position}>
            <path
              d={d}
              stroke={stroke}
              strokeWidth={1.8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
            />
            <circle cx={cx} cy={cy} r={2.6} fill={stroke} />
          </g>
        );
      })}
    </svg>
  );
}

export default function BreakdownPulseCard({
  pulse,
  drillsBase,
}: {
  pulse: BreakdownPulse;
  drillsBase: string;
}) {
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
            href={`${drillsBase}/${pulse.drillId}`}
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

      {/* Sparkline */}
      <MultiSparkline rows={pulse.rows} width={260} height={64} inverse={pulse.inverse} />

      {/* Legend rows */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginTop: 2,
        }}
      >
        {pulse.rows.map((row) => {
          const color = positionColor(row.position);
          const delta = fmtDelta(row, pulse.benchmarkType, pulse.unit);
          const noData = row.current == null;
          return (
            <div
              key={row.position}
              style={{
                display: "grid",
                gridTemplateColumns: "14px 40px 1fr 60px",
                gap: 8,
                alignItems: "center",
                fontSize: 11.5,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: noData ? "var(--uff-line)" : color,
                  display: "inline-block",
                  opacity: noData ? 0.5 : 1,
                }}
              />
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
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
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
                    : "var(--uff-text-mute)",
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
