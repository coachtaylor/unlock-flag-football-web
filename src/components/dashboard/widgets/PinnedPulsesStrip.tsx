// Build 7 marquee widget: 4 pinned drills shown as KPI cards with a
// current value, delta vs prior window, and an 8-week sparkline. Pin
// state lives in `team_drills.is_dashboard_pinned`; toggle via the
// PinButton on drill detail (Build 4).

import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import Spark from "./Spark";
import type { PinnedPulse } from "@/lib/dashboard/team-home-data";

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
        Pin a drill from its detail page to track it here.
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
  pulses: PinnedPulse[];
}) {
  const slots: (PinnedPulse | null)[] = [...pulses];
  while (slots.length < 4) slots.push(null);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      {slots.map((p, i) =>
        p ? (
          <div className="w-card td-stat-cell" key={p.drillId} style={{ padding: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8,
              }}
            >
              <Link
                href={`/drills/${p.drillId}`}
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--uff-text-mute)",
                  textDecoration: "none",
                  maxWidth: "70%",
                }}
              >
                {p.drillName}
              </Link>
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
        ) : (
          <EmptyPulse key={`empty-${i}`} />
        )
      )}
    </div>
  );
}
