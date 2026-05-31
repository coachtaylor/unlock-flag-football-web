"use client";

// Team Skill Radar (Build 12) — first visible consumer of
// v_player_skill_profile. One spoke per skill group, plotting the team's
// average composite (on the 1–5 rating scale) with a per-group legend
// that carries sample size + a 4w-vs-prior-4w trend arrow.
//
// Locked spokes (< 3 contributing players) are greyed on the axis and
// shown as a locked-insight row in the legend rather than trusted as a
// real edge of the polygon — see WEB_BUILD_PLAN.md Build 12 risk note
// ("ghost radar shaped by 1–2 outliers").

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { chartTheme } from "@/components/app/charts/chartTheme";
import SectionHead from "./SectionHead";
import type { SkillRadarData, SkillRadarSpoke } from "@/lib/dashboard/team-home-data";

const RADAR_FILL = "#FF6A1A";

export default function TeamSkillRadarCard({ data }: { data: SkillRadarData }) {
  if (!data.anyData) {
    return (
      <div className="w-card">
        <SectionHead label="Team skill radar" meta="SKILL GROUPS" />
        <div
          style={{
            border: "1px dashed var(--uff-line)",
            borderRadius: 10,
            padding: 22,
            textAlign: "center",
            color: "var(--uff-text-dim)",
            fontSize: 12.5,
            lineHeight: 1.6,
          }}
        >
          Tag drills with skills, then log rated benchmarks for{" "}
          <strong style={{ color: "var(--uff-text)" }}>3+ players</strong> to unlock the team skill
          radar. Each rated drill feeds the skills it&apos;s tagged with.
        </div>
      </div>
    );
  }

  // Plot composite on the 1–5 scale. Locked spokes still plot (so the
  // shape is complete) but the axis label + legend mark them low-confidence.
  const chartData = data.spokes.map((s) => ({
    label: s.label,
    value: s.composite != null ? Number((s.composite * 5).toFixed(2)) : 0,
  }));
  const byLabel = new Map(data.spokes.map((s) => [s.label, s]));

  return (
    <div className="w-card">
      <SectionHead label="Team skill radar" meta="AVG · /5" />

      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <RadarChart data={chartData} margin={{ top: 8, right: 18, bottom: 8, left: 18 }}>
            <PolarGrid stroke={chartTheme.gridStroke} />
            <PolarAngleAxis
              dataKey="label"
              // Recharts' tick render-prop is loosely typed; the fields we
              // read (payload.value, x, y, textAnchor) are stable at runtime.
              tick={(props) => <SpokeTick tick={props} byLabel={byLabel} />}
            />
            <PolarRadiusAxis
              domain={[0, 5]}
              tickCount={6}
              tick={{
                fill: chartTheme.tickFill,
                fontSize: 9.5,
                fontFamily: chartTheme.tickFontFamily,
              }}
              axisLine={false}
              stroke={chartTheme.gridStroke}
            />
            <Radar
              dataKey="value"
              stroke={RADAR_FILL}
              strokeWidth={2}
              fill={RADAR_FILL}
              fillOpacity={0.18}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 6 }}>
        {data.spokes.map((s) => (
          <LegendRow key={s.group} spoke={s} />
        ))}
      </div>
    </div>
  );
}

/* ── Custom polar-axis tick: greys locked spokes, tints the rest ── */

type TickRenderProps = {
  payload?: { value?: string | number };
  x?: number | string;
  y?: number | string;
  textAnchor?: string;
};

function SpokeTick({
  tick,
  byLabel,
}: {
  tick: TickRenderProps;
  byLabel: Map<string, SkillRadarSpoke>;
}) {
  const label = tick.payload?.value != null ? String(tick.payload.value) : "";
  const spoke = byLabel.get(label);
  const locked = spoke?.locked ?? true;
  return (
    <text
      x={tick.x}
      y={tick.y}
      textAnchor={(tick.textAnchor as "start" | "middle" | "end" | "inherit") ?? "middle"}
      dominantBaseline="central"
      fill={locked ? "#5A5A62" : spoke?.color ?? chartTheme.tickFill}
      fontSize={11.5}
      fontFamily="var(--font-mono)"
      fontWeight={locked ? 400 : 600}
    >
      {label}
    </text>
  );
}

/* ── Legend row: composite + sample size + trend, or locked insight ── */

function LegendRow({ spoke }: { spoke: SkillRadarSpoke }) {
  const dot = (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 2,
        background: spoke.locked ? "#3A3A40" : spoke.color,
        flexShrink: 0,
      }}
    />
  );

  if (spoke.locked) {
    const need = 3 - spoke.contributingPlayers;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        {dot}
        <span style={{ flex: 1, color: "var(--uff-text-mute)" }}>{spoke.label}</span>
        <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>
          {spoke.contributingPlayers === 0
            ? "No signal yet"
            : `${need} more player${need === 1 ? "" : "s"} to unlock`}
        </span>
      </div>
    );
  }

  const score = spoke.composite != null ? (spoke.composite * 5).toFixed(1) : "—";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      {dot}
      <span style={{ flex: 1, color: "var(--uff-text-dim)" }}>{spoke.label}</span>
      <Trend delta={spoke.trendDelta} />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          color: "var(--uff-text)",
          minWidth: 34,
          textAlign: "right",
        }}
      >
        {score}
        <span style={{ fontSize: 9.5, color: "var(--uff-text-mute)" }}>/5</span>
      </span>
      <span
        style={{
          fontSize: 10,
          color: "var(--uff-text-mute)",
          minWidth: 24,
          textAlign: "right",
        }}
      >
        n{spoke.contributingPlayers}
      </span>
    </div>
  );
}

function Trend({ delta }: { delta: number | null }) {
  // delta is in composite (0..1) units; show movement on the 5-scale.
  const pts = delta == null ? null : delta * 5;
  if (pts == null || Math.abs(pts) < 0.05) {
    return (
      <span
        style={{
          fontSize: 10.5,
          color: "var(--uff-text-mute)",
          fontFamily: "var(--font-mono)",
          minWidth: 46,
          textAlign: "right",
        }}
        title="No change vs prior 4 weeks"
      >
        —
      </span>
    );
  }
  const up = pts > 0;
  return (
    <span
      style={{
        fontSize: 10.5,
        color: up ? "#7BE06B" : "#FF6A6A",
        fontFamily: "var(--font-mono)",
        minWidth: 46,
        textAlign: "right",
      }}
      title="vs prior 4 weeks"
    >
      {up ? "▲" : "▼"} {Math.abs(pts).toFixed(1)}
    </span>
  );
}
