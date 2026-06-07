"use client";

// Per-drill benchmark history for one player. Owns the time-range chip
// state (30d / 90d / season) and renders a HistoryCard per (drill, type)
// with a Recharts progress chart. Build 8 swaps the previous hand-rolled
// sparkline for BenchmarkProgressChart and adds a locked-insight tail
// for benchmark types a drill supports but the player hasn't been
// measured on yet.

import { useMemo, useState } from "react";
import BenchmarkProgressChart from "@/components/app/charts/BenchmarkProgressChart";
import LockedBenchmarkChart from "@/components/app/charts/LockedBenchmarkChart";

// Canonical history shapes live in the shared transform; imported for local
// use and re-exported so existing call sites
// (`import { PlayerHistoryDrill } from "./PlayerHistory"`) keep working.
import type {
  PlayerHistoryDrill,
  PlayerHistoryLocked,
} from "@/lib/benchmarks/player-history";
export type { PlayerHistoryDrill, PlayerHistoryLocked };

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
  locked = [],
}: {
  drills: PlayerHistoryDrill[];
  locked?: PlayerHistoryLocked[];
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

      {locked.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--uff-text-mute)",
              marginTop: 4,
            }}
          >
            Locked insights · {locked.length}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 10,
            }}
          >
            {locked.map((l) => (
              <LockedBenchmarkChart
                key={l.key}
                drillName={l.drillName}
                type={l.benchmarkType}
                accent={l.accent}
                height={92}
              />
            ))}
          </div>
        </div>
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
        <BenchmarkProgressChart
          samples={d.samples}
          color={d.accent}
          better={d.better}
          type={d.benchmarkType}
          height={120}
        />
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
