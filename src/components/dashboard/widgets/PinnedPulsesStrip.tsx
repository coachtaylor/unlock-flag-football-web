// Build 7 marquee widget: up to 4 pinned pulses shown as KPI cards with a
// current value, trend delta, and an 8-week sparkline.
//
// Build 8.5 (data-story pass): cleaner card hierarchy — the drill name is the
// title, scope is a quiet mono line, the metric + trend pill are the hero.
// Empty slots are no longer dead: they suggest pinning a drill that closes one
// of the team's top gaps (reusing the "This week's focus" recommendations).

import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import Spark from "./Spark";
import { ScaleBar, scaleMaxFor, TrendDelta } from "./pulse-bits";
import UnpinPulseButton from "./UnpinPulseButton";
import type { PinnedPulse, PulseSlot, PulseSuggestion } from "@/lib/dashboard/team-home-data";
import BreakdownPulseCard from "./BreakdownPulseCard";

const CARD_MIN_H = 128;

function fmtVal(p: PinnedPulse) {
  if (p.current == null) return "—";
  if (p.benchmarkType === "timed") return p.current.toFixed(2);
  if (p.benchmarkType === "rated") return p.current.toFixed(1);
  return Math.round(p.current).toString();
}

// Trend pill: thin wrapper over the shared TrendDelta atom (DRY). Maps a
// PinnedPulse onto primitive props, preserving the per-benchmarkType formatting,
// inverse (lower-is-better) handling, unit, and "vs prior" suffix.
function DeltaPill({ p }: { p: PinnedPulse }) {
  const fmt = (mag: number) =>
    p.benchmarkType === "timed"
      ? mag.toFixed(2)
      : p.benchmarkType === "rated"
        ? mag.toFixed(1)
        : Math.round(mag).toString();
  return (
    <TrendDelta
      delta={p.delta}
      points={p.points}
      inverse={p.inverse}
      formatMag={fmt}
      unit={p.unit}
      suffix="vs prior"
    />
  );
}

function SuggestedPulse({ s, teamId }: { s: PulseSuggestion; teamId: string }) {
  return (
    <div
      className="w-card"
      style={{
        padding: 16,
        border: "1px dashed rgba(255,106,26,0.30)",
        background: "rgba(255,106,26,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: CARD_MIN_H,
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--uff-orange)",
          fontFamily: "var(--font-mono)",
        }}
      >
        Suggested pin
      </span>
      <div style={{ fontSize: 12.5, color: "var(--uff-text-dim)", lineHeight: 1.45, flex: 1 }}>
        Track{" "}
        <span style={{ color: "var(--uff-text)", fontWeight: 500 }}>{s.skillName}</span>
        {" — "}
        {s.skillRank === 1 ? "your weakest skill" : "a top team gap"}.
      </div>
      <Link
        href={`/dashboard/team/${teamId}/drills/${s.drillId}`}
        className="wbtn ghost"
        style={{ height: 30, alignSelf: "flex-start", maxWidth: "100%" }}
      >
        <Icon.pin size={12} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Pin {s.drillName}
        </span>
      </Link>
    </div>
  );
}

function EmptyPulse() {
  return (
    <div
      className="w-card"
      style={{
        padding: 16,
        border: "1px dashed var(--uff-line)",
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: CARD_MIN_H,
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
          fontFamily: "var(--font-mono)",
        }}
      >
        Empty pulse slot
      </span>
      <span style={{ fontSize: 12, color: "var(--uff-text-dim)", lineHeight: 1.5, flex: 1 }}>
        Pin a drill from its detail page to watch a metric here.
      </span>
      <Link href="/drills" className="wbtn ghost" style={{ height: 30, alignSelf: "flex-start" }}>
        Browse drills <Icon.chevR size={12} />
      </Link>
    </div>
  );
}

export default function PinnedPulsesStrip({
  pulses,
  suggestions = [],
  teamId,
  canPin = false,
}: {
  pulses: PulseSlot[];
  suggestions?: PulseSuggestion[];
  teamId: string;
  canPin?: boolean;
}) {
  const emptyCount = Math.max(0, 4 - pulses.length);
  // Fill empty slots with suggestions first, then generic empties.
  const fillers = Array.from({ length: emptyCount }, (_, i) => suggestions[i] ?? null);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      {pulses.map((p) =>
        p.kind === "breakdown" ? (
          <BreakdownPulseCard key={p.pinId} pulse={p} teamId={teamId} canPin={canPin} />
        ) : (
          <SinglePulseCard key={p.pinId} pulse={p} teamId={teamId} canPin={canPin} />
        )
      )}
      {fillers.map((s, i) =>
        s ? (
          <SuggestedPulse key={`sug-${s.drillId}`} s={s} teamId={teamId} />
        ) : (
          <EmptyPulse key={`empty-${i}`} />
        )
      )}
    </div>
  );
}

function SinglePulseCard({
  pulse: p,
  teamId,
  canPin,
}: {
  pulse: PinnedPulse;
  teamId: string;
  canPin: boolean;
}) {
  const scaleMax = scaleMaxFor(p.benchmarkType);
  return (
    <div
      className="w-card td-stat-cell"
      style={{ position: "relative", padding: 16, display: "flex", flexDirection: "column", minHeight: CARD_MIN_H }}
    >
      {canPin ? (
        <UnpinPulseButton pinId={p.pinId} drillId={p.drillId} teamId={teamId} />
      ) : (
        <span className="pulse-unpin" style={{ pointerEvents: "none" }}>
          <Icon.pin size={13} />
        </span>
      )}

      <Link
        href={`/dashboard/team/${teamId}/drills/${p.drillId}`}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flex: 1,
          textDecoration: "none",
          color: "inherit",
        }}
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
            {p.drillName}
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
            {p.benchmarkType} · {p.position ?? "ALL"}
          </div>
        </div>

        {/* metric + sparkline */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 10,
            marginTop: "auto",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--uff-text)",
              lineHeight: 1,
              display: "flex",
              alignItems: "baseline",
              gap: 4,
            }}
          >
            {fmtVal(p)}
            <span style={{ fontSize: 12, color: "var(--uff-text-dim)" }}>{p.unit}</span>
          </div>
          <Spark data={p.series} color={p.color} w={84} h={34} />
        </div>

        {/* absolute scale — makes the number legible at a glance (pct /100, rated /5) */}
        {scaleMax != null && <ScaleBar value={p.current} max={scaleMax} color={p.color} />}

        {/* trend */}
        <DeltaPill p={p} />
      </Link>
    </div>
  );
}
