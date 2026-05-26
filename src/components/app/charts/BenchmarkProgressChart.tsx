"use client";

// Per-drill benchmark progress chart. Replaces the hand-rolled sparkline
// in PlayerHistory with a real Recharts LineChart: axes, tooltip, PR
// markers (white-ringed dots on samples that beat all prior values for
// the drill).
//
// Build 8. Self-contained — owns its own empty + single-sample states so
// the parent can render unconditionally.

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  chartTheme,
  formatDateShort,
  formatValue,
} from "./chartTheme";

export type ProgressSample = {
  date: string; // ISO yyyy-mm-dd
  value: number;
};

type Props = {
  samples: ProgressSample[];
  /** UFF accent color for the line (per benchmark type). */
  color: string;
  /** Lower-is-better drills (timed, drops) need the PR comparison flipped. */
  better: "higher" | "lower";
  /** Benchmark type controls tooltip / Y-axis formatting. */
  type: string | null;
  /** Inline-friendly height. Default sized for the history card right pane. */
  height?: number;
};

type ChartPoint = {
  date: string;
  value: number;
  isPR: boolean;
  index: number;
};

function annotatePRs(samples: ProgressSample[], better: "higher" | "lower"): ChartPoint[] {
  const out: ChartPoint[] = [];
  let best = better === "lower" ? Infinity : -Infinity;
  samples.forEach((s, i) => {
    const beats = better === "lower" ? s.value < best : s.value > best;
    // First sample is the seed best but is NOT a PR (nothing to beat).
    const isPR = i > 0 && beats;
    if (beats) best = s.value;
    out.push({ date: s.date, value: s.value, isPR, index: i });
  });
  return out;
}

export default function BenchmarkProgressChart({
  samples,
  color,
  better,
  type,
  height = 110,
}: Props) {
  if (samples.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed var(--uff-line)",
          borderRadius: 8,
          fontSize: 11.5,
          color: "var(--uff-text-mute)",
        }}
      >
        No samples in range
      </div>
    );
  }
  if (samples.length === 1) {
    // A single point can't show a trend — show the value as a calm marker
    // so the section doesn't look broken, with a nudge to log another.
    return (
      <div
        style={{
          height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          border: "1px dashed var(--uff-line)",
          borderRadius: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 18,
            fontWeight: 700,
            color,
            letterSpacing: "-0.02em",
          }}
        >
          {formatValue(samples[0].value, type)}
        </span>
        <span style={{ fontSize: 10.5, color: "var(--uff-text-mute)" }}>
          Log 1+ more to see a trend
        </span>
      </div>
    );
  }

  const data = annotatePRs(samples, better);
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Pad the Y domain so the line never sits flush against the axes.
  const pad = Math.max((max - min) * 0.15, max === min ? Math.max(1, Math.abs(max) * 0.1) : 0);
  // Lower-is-better charts read more naturally inverted so the "best" line
  // hugs the top of the chart, matching how athletes mentally track times.
  const yDomain: [number, number] =
    better === "lower" ? [max + pad, Math.max(0, min - pad)] : [Math.max(0, min - pad), max + pad];

  // Compute the all-time best across the whole series for the ReferenceLine.
  const best = better === "lower" ? min : max;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -16 }}>
          <CartesianGrid
            stroke={chartTheme.gridStroke}
            strokeDasharray={chartTheme.gridDash}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            tick={{
              fill: chartTheme.tickFill,
              fontSize: chartTheme.tickFontSize,
              fontFamily: chartTheme.tickFontFamily,
            }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={yDomain}
            tick={{
              fill: chartTheme.tickFill,
              fontSize: chartTheme.tickFontSize,
              fontFamily: chartTheme.tickFontFamily,
            }}
            tickFormatter={(v: number) => formatValue(v, type)}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            cursor={{ stroke: chartTheme.cursorStroke, strokeWidth: 1 }}
            contentStyle={chartTheme.tooltip}
            labelFormatter={(label) =>
              typeof label === "string" ? formatDateShort(label) : ""
            }
            formatter={(value, _name, item) => {
              const point = item?.payload as ChartPoint | undefined;
              const label = point?.isPR ? "Personal best" : "Value";
              const numeric = typeof value === "number" ? value : Number(value);
              return [formatValue(numeric, type), label];
            }}
          />
          <ReferenceLine
            y={best}
            stroke={color}
            strokeDasharray="3 3"
            strokeOpacity={0.45}
            ifOverflow="extendDomain"
            label={{
              value: "PB",
              position: "right",
              fill: color,
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props) => {
              // Recharts passes ChartPoint as `payload` to each dot.
              const { cx, cy, payload, index } = props as {
                cx: number;
                cy: number;
                payload: ChartPoint;
                index: number;
              };
              if (cx == null || cy == null) {
                return <g key={`d-${index}`} />;
              }
              if (payload.isPR) {
                return (
                  <g key={`d-${index}`}>
                    <circle cx={cx} cy={cy} r={5.5} fill={color} />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={5.5}
                      fill="none"
                      stroke={chartTheme.prRingStroke}
                      strokeWidth={1.5}
                    />
                  </g>
                );
              }
              return (
                <circle
                  key={`d-${index}`}
                  cx={cx}
                  cy={cy}
                  r={2.8}
                  fill={color}
                />
              );
            }}
            activeDot={{ r: 5, fill: color, stroke: "#FFFFFF", strokeWidth: 1.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
