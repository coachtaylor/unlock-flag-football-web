// Build 7 marquee widget: up to 4 pinned pulses shown as KPI cards with a
// current value, delta vs prior window, and an 8-week sparkline.
//
// Branch 2 (Build 7.5b): pulses are now backed by `team_dashboard_pins`,
// one row per (drill, benchmark_type, position) slice. A single drill
// can appear multiple times in the strip with different type/position
// scopes. Each card surfaces a TYPE kicker line and a POSITION chip so
// the scope is unambiguous.

import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import Spark from "./Spark";
import type { PinnedPulse, PulseSlot } from "@/lib/dashboard/team-home-data";
import BreakdownPulseCard from "./BreakdownPulseCard";

function fmtVal(p: PinnedPulse) {
  if (p.current == null) return "—";
  if (p.benchmarkType === "timed") return p.current.toFixed(2);
  if (p.benchmarkType === "rated") return p.current.toFixed(1);
  if (p.benchmarkType === "pct") return Math.round(p.current).toString();
  return Math.round(p.current).toString();
}

function fmtDelta(p: PinnedPulse) {
  if (p.delta == null) return null;
  const v = Math.abs(p.delta);
  const formatted =
    p.benchmarkType === "timed" ? v.toFixed(2) : v.toFixed(p.benchmarkType === "rated" ? 1 : 0);
  const sign = p.delta < 0 ? "−" : "+";
  return `${sign}${formatted}${p.unit}`;
}

function isGood(p: PinnedPulse): boolean {
  if (p.delta == null) return false;
  return p.inverse ? p.delta < 0 : p.delta > 0;
}

function EmptyPulse() {
  return (
    <div
      className="w-card"
      style={{
        padding: 18,
        border: "1px dashed var(--uff-line)",
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 116,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
        }}
      >
        Empty pulse slot
      </span>
      <span style={{ fontSize: 12, color: "var(--uff-text-dim)", lineHeight: 1.5 }}>
        Pin a (drill, type) pulse from any drill&apos;s detail page.
      </span>
      <Link href="/drills" className="wbtn ghost" style={{ height: 30, alignSelf: "flex-start" }}>
        Browse drills <Icon.chevR size={12} />
      </Link>
    </div>
  );
}

export default function PinnedPulsesStrip({
  pulses,
}: {
  pulses: PulseSlot[];
}) {
  const slots: (PulseSlot | null)[] = [...pulses];
  while (slots.length < 4) slots.push(null);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      {slots.map((p, i) => {
        if (!p) return <EmptyPulse key={`empty-${i}`} />;
        if (p.kind === "breakdown") {
          return <BreakdownPulseCard key={p.pinId} pulse={p} />;
        }
        return <SinglePulseCard key={p.pinId} pulse={p} />;
      })}
    </div>
  );
}

function SinglePulseCard({ pulse: p }: { pulse: PinnedPulse }) {
  return (
    <div className="w-card td-stat-cell" style={{ padding: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8,
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <Link
                  href={`/drills/${p.drillId}`}
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
                  {p.drillName}
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
                    {p.benchmarkType}
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
                    {p.position ?? "ALL"}
                  </span>
                </div>
              </div>
              <Icon.pin size={13} />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: "var(--uff-text)",
                    display: "flex",
                    alignItems: "baseline",
                    gap: 4,
                  }}
                >
                  {fmtVal(p)}
                  <span style={{ fontSize: 12, color: "var(--uff-text-dim)" }}>{p.unit}</span>
                </div>
                {fmtDelta(p) && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 700,
                      color: isGood(p) ? "var(--uff-lime)" : "var(--uff-red)",
                    }}
                  >
                    {fmtDelta(p)} vs prior
                  </span>
                )}
              </div>
              <Spark data={p.series} color={p.color} w={88} h={36} />
            </div>
    </div>
  );
}
