"use client";

// Per-drill benchmark history for one player. Owns the time-range chip
// state (30d / 90d / season) and renders a HistoryCard with a sparkline
// for each drill.

import { useMemo, useState } from "react";

type Sample = { date: string; value: number; label: string };

export type PlayerHistoryDrill = {
  key: string;
  drillName: string;
  benchmarkType: string | null;
  unit: string;
  better: "higher" | "lower";
  accent: string;
  samples: Sample[]; // chronological (oldest → newest)
};

type Range = "30d" | "90d" | "season";
const RANGE_DAYS: Record<Range, number | null> = {
  "30d": 30,
  "90d": 90,
  season: null,
};

function inRange(iso: string, days: number | null): boolean {
  if (days == null) return true;
  const d = new Date(iso);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return d.getTime() >= cutoff;
}

export default function PlayerHistory({
  drills,
}: {
  drills: PlayerHistoryDrill[];
}) {
  const [range, setRange] = useState<Range>("season");

  const filteredDrills = useMemo(() => {
    const days = RANGE_DAYS[range];
    return drills
      .map((d) => ({
        ...d,
        samples: d.samples.filter((s) => inRange(s.date, days)),
      }))
      .filter((d) => d.samples.length > 0);
  }, [drills, range]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div
        className="w-card"
        style={{
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--uff-text)" }}>
          Benchmark history
        </span>
        <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>
          · {filteredDrills.length}{" "}
          {filteredDrills.length === 1 ? "drill" : "drills"}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {(
            [
              { id: "30d", label: "Last 30d" },
              { id: "90d", label: "Last 90d" },
              { id: "season", label: "Season" },
            ] as { id: Range; label: string }[]
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`chip ${range === r.id ? "on" : ""}`}
              style={{ height: 26, fontSize: 11.5 }}
            >
              {r.label}
            </button>
          ))}
        </span>
      </div>

      {drills.length === 0 ? (
        <div
          className="w-card subdued"
          style={{
            padding: 24,
            border: "1px dashed var(--uff-line)",
            background: "transparent",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)" }}>
            No benchmark data yet. Run a benchmark to see history here.
          </p>
        </div>
      ) : filteredDrills.length === 0 ? (
        <div
          className="w-card subdued"
          style={{
            padding: 18,
            border: "1px dashed var(--uff-line)",
            background: "transparent",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)" }}>
            No assessments in this range. Try widening the time filter.
          </p>
        </div>
      ) : (
        filteredDrills.map((d) => <HistoryCard key={d.key} d={d} />)
      )}
    </div>
  );
}

function HistoryCard({ d }: { d: PlayerHistoryDrill }) {
  const first = d.samples[0];
  const last = d.samples[d.samples.length - 1];
  const delta = last.value - first.value;
  const pb = d.samples.reduce(
    (best, s) => (d.better === "lower" ? Math.min(best, s.value) : Math.max(best, s.value)),
    d.better === "lower" ? Infinity : -Infinity
  );
  const goodDelta =
    d.better === "higher" ? delta > 0 : delta < 0;

  return (
    <div
      className="w-card history-card"
      style={{
        padding: 16,
        display: "grid",
        gridTemplateColumns: "1fr 380px",
        gap: 18,
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--uff-text)" }}>
            {d.drillName}
          </span>
          {d.benchmarkType && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                padding: "2px 7px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.04)",
                color: "var(--uff-text-dim)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {d.benchmarkType}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 32,
              fontWeight: 700,
              color: d.accent,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {last.label}
            {d.unit && (
              <span style={{ fontSize: 16, color: "var(--uff-text-dim)", marginLeft: 2 }}>
                {d.unit}
              </span>
            )}
          </span>
          {d.samples.length > 1 && (
            <>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 700,
                  color: goodDelta ? "var(--uff-lime)" : "var(--uff-red)",
                }}
              >
                {delta > 0 ? "+" : ""}
                {Math.abs(delta) < 10 ? delta.toFixed(2) : delta.toFixed(1)}
                {d.unit && d.unit.length <= 1 ? d.unit : ""}
              </span>
              <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>
                vs first session
              </span>
            </>
          )}
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 12,
            fontSize: 11,
            color: "var(--uff-text-mute)",
            flexWrap: "wrap",
          }}
        >
          <span>
            <b style={{ color: "var(--uff-text)" }}>{d.samples.length}</b>{" "}
            {d.samples.length === 1 ? "session" : "sessions"}
          </span>
          {pb !== Infinity && pb !== -Infinity && (
            <span>
              PB{" "}
              <b style={{ color: d.accent, fontFamily: "var(--font-mono)" }}>
                {Math.abs(pb) < 10 ? pb.toFixed(2) : pb.toFixed(1)}
                {d.unit}
              </b>
            </span>
          )}
          <span>
            Better:{" "}
            <b style={{ color: "var(--uff-text-dim)" }}>{d.better}</b>
          </span>
        </div>
      </div>

      <div className="history-chart">
        <HistoryLine samples={d.samples} color={d.accent} better={d.better} />
      </div>

      <style>{`
        @media (max-width: 760px) {
          .history-card {
            grid-template-columns: 1fr !important;
          }
          .history-chart {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

function HistoryLine({
  samples,
  color,
  better,
}: {
  samples: Sample[];
  color: string;
  better: "higher" | "lower";
}) {
  const w = 380;
  const h = 92;
  if (samples.length === 1) {
    // Single point: render a centered dot so the section doesn't look broken.
    return (
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
        <circle cx={w / 2} cy={h / 2} r={4} fill={color} />
      </svg>
    );
  }

  const values = samples.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.001, max - min);
  const padX = 6;
  const padY = 12;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const xAt = (i: number) =>
    padX + (innerW * i) / Math.max(1, samples.length - 1);
  const yAt = (v: number) =>
    better === "higher"
      ? padY + innerH - ((v - min) / span) * innerH
      : padY + ((v - min) / span) * innerH;

  const pts = samples
    .map((s, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(s.value).toFixed(1)}`)
    .join(" ");
  const area = `${pts} L${xAt(samples.length - 1)},${h - padY} L${xAt(0)},${h - padY} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <path d={area} fill={color} opacity="0.08" />
      <path
        d={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {samples.map((s, i) => (
        <circle
          key={i}
          cx={xAt(i)}
          cy={yAt(s.value)}
          r={i === samples.length - 1 ? 3.5 : 2.2}
          fill={i === samples.length - 1 ? color : "var(--uff-surface)"}
          stroke={color}
          strokeWidth={i === samples.length - 1 ? 0 : 1.5}
        />
      ))}
    </svg>
  );
}
