"use client";

// Recharts line chart for the top 1-2 pinned drills' weekly averages.
// Plan calls Recharts out for Build 8, but the user opted-in to add it
// here for the dashboard's trend widget. Lazy-loaded via "use client"
// so the bundle hit lands on this widget only.

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

type Series = {
  drillId: string;
  label: string;
  color: string;
  data: { week: string; value: number }[];
};

export default function BenchmarkTrendsCard({ series }: { series: Series[] }) {
  if (!series.length) {
    return (
      <div
        style={{
          height: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--uff-text-mute)",
          fontSize: 12.5,
          border: "1px dashed var(--uff-line)",
          borderRadius: 10,
        }}
      >
        Pin 1-2 drills and log benchmarks weekly to unlock the trend chart.
      </div>
    );
  }

  // Merge by week
  const weeks = Array.from(
    new Set(series.flatMap((s) => s.data.map((d) => d.week)))
  );
  const merged = weeks.map((w) => {
    const row: Record<string, number | string> = { week: w };
    for (const s of series) {
      const d = s.data.find((x) => x.week === w);
      if (d) row[s.label] = Number(d.value.toFixed(3));
    }
    return row;
  });

  return (
    <div style={{ width: "100%", height: 230 }}>
      <ResponsiveContainer>
        <LineChart data={merged} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="#26262C" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: "#7A7A82", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#7A7A82", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "#141417",
              border: "1px solid #26262C",
              borderRadius: 8,
              fontSize: 12,
              color: "#F4F4F2",
            }}
            cursor={{ stroke: "#26262C", strokeWidth: 1 }}
          />
          <Legend
            wrapperStyle={{
              fontSize: 11.5,
              color: "#A0A0A8",
              paddingTop: 4,
            }}
            iconType="line"
          />
          {series.map((s) => (
            <Line
              key={s.drillId}
              type="monotone"
              dataKey={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 2.8, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
