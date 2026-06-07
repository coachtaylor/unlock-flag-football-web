"use client";

// Per-player skill-GROUP progression. A clustered multi-series line chart over a
// short window can't show insight — the lines overlap and the change is invisible.
// So the card is rows only: a one-line headline ("what moved"), then a per-group
// stat row (its OWN micro-sparkline + current level + the change). No shared axis,
// so nothing overlaps. Reuses the dashboard's Spark + TrendDelta + heat color so
// this card speaks the same visual language as the rating bars above it. Build 9.

import SectionHead from "@/components/dashboard/widgets/SectionHead";
import Spark from "@/components/dashboard/widgets/Spark";
import { TrendDelta } from "@/components/dashboard/widgets/pulse-bits";
import { scoreToHeatColor } from "@/lib/dashboard/heat-scale";
import {
  WEEKS_WINDOW,
  summarizeSkillGroupTrend,
  type SkillGroupTrend,
  type SkillGroupHeadline,
  type SkillGroupRowStat,
} from "@/lib/benchmarks/skill-group-trend";

export default function SkillGroupTrendCard({
  trend,
  bare = false,
}: {
  trend: SkillGroupTrend;
  // Content only (no card / no SectionHead) — for CollapsibleSection.
  bare?: boolean;
}) {
  const summary = trend.hasSignal ? summarizeSkillGroupTrend(trend) : null;
  const body = summary ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Headline headline={summary.headline} />
      <Rows rows={summary.rows} />
    </div>
  ) : (
    <Locked />
  );

  if (bare) return body;

  return (
    <div className="w-card" style={{ padding: 16 }}>
      <SectionHead label="Skill-group progress" meta={`${WEEKS_WINDOW} WK`} />
      {body}
    </div>
  );
}

// Signed delta on the displayed /5 scale (input is on the 0..1 scale).
function fmtDelta(d: number): string {
  const v = d * 5;
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
}

function MoverName({ label, color }: { label: string; color: string }) {
  return <span style={{ color, fontWeight: 500 }}>{label}</span>;
}

function Headline({ headline }: { headline: SkillGroupHeadline }) {
  if (headline.kind === "none") return null;
  const base = { fontSize: 12.5, lineHeight: 1.5, color: "var(--uff-text-dim)" } as const;
  const up = { color: "var(--uff-lime)", fontWeight: 700 } as const;
  const down = { color: "var(--uff-red)", fontWeight: 700 } as const;

  if (headline.kind === "steady") {
    return <div style={base}>Holding steady across groups this month.</div>;
  }
  if (headline.kind === "watch") {
    const w = headline.watch;
    return (
      <div style={base}>
        <MoverName label={w.label} color={w.color} /> slipping{" "}
        <span style={down}>{fmtDelta(w.delta)}</span> · rest holding.
      </div>
    );
  }
  // gain (with optional watch)
  const r = headline.riser;
  return (
    <div style={base}>
      <MoverName label={r.label} color={r.color} /> climbing fastest{" "}
      <span style={up}>{fmtDelta(r.delta)}</span>
      {headline.watch ? (
        <>
          {" "}
          · watch <MoverName label={headline.watch.label} color={headline.watch.color} />{" "}
          <span style={down}>{fmtDelta(headline.watch.delta)}</span>.
        </>
      ) : (
        <> over {WEEKS_WINDOW} weeks.</>
      )}
    </div>
  );
}

function Rows({ rows }: { rows: SkillGroupRowStat[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => (
        <div
          key={r.group}
          style={{
            display: "grid",
            gridTemplateColumns: "10px 1fr 110px 44px auto",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{ width: 10, height: 10, borderRadius: 3, background: r.color }}
            aria-hidden
          />
          <span
            style={{
              fontSize: 12.5,
              color: "var(--uff-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.label}
          </span>
          <Spark data={r.spark} color={r.color} w={110} h={26} fill={false} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 700,
              textAlign: "right",
              color: r.latest == null ? "var(--uff-text-mute)" : scoreToHeatColor(r.latest),
            }}
          >
            {r.latest == null ? "—" : (r.latest * 5).toFixed(1)}
          </span>
          <TrendDelta delta={r.delta} points={r.points} formatMag={(m) => (m * 5).toFixed(1)} />
        </div>
      ))}
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
