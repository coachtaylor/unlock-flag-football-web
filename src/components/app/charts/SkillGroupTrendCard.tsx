"use client";

// Per-player skill-GROUP progression: one line per position-relevant skill
// group over the last ~12 weeks. Complements the snapshot skill profile card
// with trajectory. Multi-series merge + styling mirror BenchmarkTrendsCard so
// the player and dashboard charts stay in lockstep. Build 8.

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { chartTheme, formatDateShort } from "@/components/app/charts/chartTheme";
import SectionHead from "@/components/dashboard/widgets/SectionHead";
import type { SkillGroupTrend } from "@/lib/benchmarks/skill-group-trend";

export default function SkillGroupTrendCard({ trend }: { trend: SkillGroupTrend }) {
  return (
    <div className="w-card" style={{ padding: 16 }}>
      <SectionHead label="Skill-group progress" meta="12 WK" />
      {trend.hasSignal ? <TrendChart trend={trend} /> : <Locked />}
    </div>
  );
}

function TrendChart({ trend }: { trend: SkillGroupTrend }) {
  // Merge series by week into one row array; values rendered on the 1–5 scale.
  const merged = trend.weeks.map((w) => {
    const row: Record<string, number | string> = { week: formatDateShort(w) };
    for (const s of trend.series) {
      const p = s.points.find((x) => x.week === w);
      if (p) row[s.label] = Number((p.score * 5).toFixed(2));
    }
    return row;
  });

  return (
    <div style={{ width: "100%", height: 210 }}>
      <ResponsiveContainer>
        <LineChart data={merged} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid
            stroke={chartTheme.gridStroke}
            strokeDasharray={chartTheme.gridDash}
            vertical={false}
          />
          <XAxis
            dataKey="week"
            tick={{
              fill: chartTheme.tickFill,
              fontSize: chartTheme.tickFontSize,
              fontFamily: chartTheme.tickFontFamily,
            }}
            axisLine={false}
            tickLine={false}
            minTickGap={20}
          />
          <YAxis
            domain={[0, 5]}
            ticks={[0, 1, 2, 3, 4, 5]}
            tick={{
              fill: chartTheme.tickFill,
              fontSize: chartTheme.tickFontSize,
              fontFamily: chartTheme.tickFontFamily,
            }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={chartTheme.tooltip}
            cursor={{ stroke: chartTheme.cursorStroke, strokeWidth: 1 }}
            formatter={(value) => `${Number(value).toFixed(1)}/5`}
          />
          <Legend wrapperStyle={{ fontSize: 11.5, color: "#A0A0A8", paddingTop: 4 }} iconType="line" />
          {trend.series.map((s) => (
            <Line
              key={s.group}
              type="monotone"
              dataKey={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 2.8, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Locked() {
  return (
    <div
      style={{
        minHeight: 120,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        textAlign: "center",
        padding: "18px 16px",
        border: "1px dashed var(--uff-line)",
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: 12.5, color: "var(--uff-text-dim)", lineHeight: 1.5, maxWidth: 360 }}>
        Log rated or accuracy benchmarks over a few weeks to see skill-group progress.
      </div>
      <div style={{ fontSize: 11, color: "var(--uff-text-mute)", lineHeight: 1.5, maxWidth: 360 }}>
        Timed drills (sprints, shuttles) show their trend in the per-drill charts.
      </div>
    </div>
  );
}
