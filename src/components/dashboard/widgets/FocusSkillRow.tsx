"use client";

// One weak skill, told as a complete story (Build 8.5 storytelling pass).
// Three beats, top to bottom:
//   1. GAP  — rank + name + score + an amber severity meter (the gap, made visible)
//   2. WHY  — evidence chain (who's dragging it / which drills / trend) behind an
//             expander so the card stays uncluttered
//   3. FIX  — always-visible prescription: the recommended drills to close the gap,
//             styled as real orange action rows (the CTA that was previously buried)
// Amber = the problem, orange = the action.

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import Spark from "./Spark";
import type { FocusSkill, FocusTrendPoint } from "@/lib/dashboard/team-home-data";

const pct = (s: number) => `${Math.round(s * 100)}%`;
const ordinal = (rank: number) =>
  rank === 1 ? "WEAKEST" : rank === 2 ? "2ND" : "3RD";

// Direction is the story: higher score = gap closing (good, lime); lower =
// widening (bad, red); within ±2 pts = holding. null when too few points.
type TrendInfo = {
  dir: "up" | "down" | "flat";
  deltaPts: number;
  weeks: number;
  color: string;
};
function trendInfo(trend: FocusTrendPoint[]): TrendInfo | null {
  if (trend.length < 2) return null;
  const delta = trend[trend.length - 1].score - trend[0].score;
  const weeks = trend.length - 1;
  if (Math.abs(delta) < 0.02) {
    return { dir: "flat", deltaPts: 0, weeks, color: "var(--uff-text-mute)" };
  }
  return delta > 0
    ? { dir: "up", deltaPts: Math.abs(Math.round(delta * 100)), weeks, color: "var(--uff-lime)" }
    : { dir: "down", deltaPts: Math.abs(Math.round(delta * 100)), weeks, color: "var(--uff-red)" };
}

export default function FocusSkillRow({
  skill,
  teamId,
  rosterSize,
  totalMeasured,
  emphasis,
}: {
  skill: FocusSkill;
  teamId: string;
  rosterSize: number;
  totalMeasured: number;
  emphasis: boolean;
}) {
  // Default-collapsed so the three columns start at an even height; the
  // weakest still reads as priority via the rank badge + heavier accent edge.
  const [open, setOpen] = useState(false);
  const ti = trendInfo(skill.trend);

  const topDrill = skill.evidenceDrills[0];
  // Confident only when a real share of the roster has been rated.
  const confident =
    rosterSize > 0 &&
    skill.playersWithSignal >= 5 &&
    skill.playersWithSignal >= Math.ceil(rosterSize * 0.6);

  const coverage = rosterSize
    ? `${skill.playersWithSignal} of ${rosterSize} rated`
    : `${skill.playersWithSignal} rated`;

  // The one-line "why" — always visible.
  const whyBits = [
    totalMeasured > 1 ? `Lowest of ${totalMeasured} skills` : "Only measured skill",
    coverage,
  ];
  if (topDrill) whyBits.push(`weakest drill: ${topDrill.drillName} (${pct(topDrill.avgScore)})`);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        padding: "13px 14px",
        borderRadius: 10,
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line-soft)",
        // gap = caution (never green); weakest gets a heavier accent edge
        borderLeft: `${emphasis ? 3 : 2}px solid #FFB347`,
      }}
    >
      {/* ── 1. GAP ───────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "#FFB347",
            background: "rgba(255,179,71,0.12)",
            borderRadius: 5,
            padding: "2px 6px",
            whiteSpace: "nowrap",
          }}
        >
          {ordinal(skill.rank)}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--uff-text)",
          }}
        >
          {skill.skillName}
        </span>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
          {ti && ti.dir !== "flat" && (
            <span
              title={`${ti.deltaPts} pts over ${ti.weeks} wk${ti.weeks > 1 ? "s" : ""}`}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                fontWeight: 700,
                color: ti.color,
              }}
            >
              {ti.dir === "up" ? "▲" : "▼"}
              {ti.deltaPts}
            </span>
          )}
          <span
            className="tabular-nums"
            style={{ fontSize: 13, fontWeight: 600, color: "#FFB347" }}
          >
            {pct(skill.avgScore)}
          </span>
        </span>
      </div>

      {/* severity meter — the gap, made visible */}
      <div className="focus-meter" style={{ marginTop: 9 }} aria-hidden>
        <i style={{ width: `${Math.max(4, Math.round(skill.avgScore * 100))}%` }} />
      </div>

      {/* why one-liner */}
      <div style={{ fontSize: 11.5, color: "var(--uff-text-dim)", marginTop: 8, lineHeight: 1.45 }}>
        {whyBits.join(" · ")}
        {!confident && <span style={{ color: "#FFB347" }}> · low confidence</span>}
      </div>

      {/* ── 2. WHY (evidence, collapsed) ─────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          marginTop: 8,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--uff-text-mute)",
          fontSize: 11.5,
          fontWeight: 500,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
        aria-expanded={open}
      >
        {open ? "Hide the evidence" : "See the evidence"}
        <span style={{ transform: open ? "rotate(90deg)" : "none", display: "inline-flex" }}>
          <Icon.chevR size={12} />
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* who's dragging it */}
          {skill.lowPlayers.length > 0 && (
            <Evidence label="Who's dragging it">
              {skill.lowPlayers.map((p) => (
                <Link
                  key={p.playerId}
                  href={`/dashboard/team/${teamId}/roster/${p.playerId}`}
                  style={rowStyle}
                >
                  <span style={{ flex: 1, minWidth: 0, color: "var(--uff-text)" }}>{p.name}</span>
                  <span className="tabular-nums" style={{ color: "var(--uff-text-mute)" }}>
                    {pct(p.score)}
                  </span>
                </Link>
              ))}
            </Evidence>
          )}

          {/* which drills prove it */}
          {skill.evidenceDrills.length > 0 && (
            <Evidence label="Measured on">
              {skill.evidenceDrills.map((d) => (
                <div key={d.drillName} style={rowStyle}>
                  <span style={{ flex: 1, minWidth: 0, color: "var(--uff-text)" }}>{d.drillName}</span>
                  <span className="tabular-nums" style={{ color: "var(--uff-text-mute)" }}>
                    {pct(d.avgScore)} · {d.players}p
                  </span>
                </div>
              ))}
            </Evidence>
          )}

          {/* trend — real sparkline once ≥2 weekly points exist */}
          <Evidence label="Trend">
            {ti ? (
              <div style={{ ...rowStyle, gap: 12 }}>
                <Spark
                  data={skill.trend.map((t) => t.score)}
                  color={ti.color}
                  w={96}
                  h={28}
                  fill={false}
                />
                <span style={{ flex: 1, minWidth: 0, color: "var(--uff-text-dim)" }}>
                  {ti.dir === "up"
                    ? `Up ${ti.deltaPts} pts over ${ti.weeks} wk${ti.weeks > 1 ? "s" : ""} — gap closing`
                    : ti.dir === "down"
                      ? `Down ${ti.deltaPts} pts over ${ti.weeks} wk${ti.weeks > 1 ? "s" : ""} — gap widening`
                      : `Holding steady over ${ti.weeks} wk${ti.weeks > 1 ? "s" : ""}`}
                </span>
              </div>
            ) : (
              <div style={{ ...rowStyle, color: "var(--uff-text-dim)", fontStyle: "italic" }}>
                Re-assess this skill over the coming weeks to unlock the trend line.
              </div>
            )}
          </Evidence>
        </div>
      )}

      {/* ── 3. FIX (the CTA — always visible, pinned to bottom) ── */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 12,
          borderTop: "1px solid var(--uff-line-soft)",
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--uff-orange)",
            marginBottom: 8,
          }}
        >
          The fix · drills to close this gap
        </div>

        {skill.drills.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {skill.drills.map((d) => (
              <Link
                key={d.drillId}
                href={`/dashboard/team/${teamId}/drills/${d.drillId}`}
                className="focus-fix"
              >
                <span className="ic" aria-hidden>
                  <Icon.plus size={13} />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500 }}>
                  {d.drillName}
                </span>
                <span className="arrow" aria-hidden>
                  <Icon.chevR size={14} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: "var(--uff-text-dim)", lineHeight: 1.5 }}>
            No published drill trains this skill yet.{" "}
            <Link
              href={`/dashboard/team/${teamId}/drills`}
              style={{ color: "var(--uff-orange)", fontWeight: 500 }}
            >
              Tag a drill
            </Link>{" "}
            to get a recommendation here.
          </div>
        )}
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 8,
  background: "var(--uff-surface)",
  border: "1px solid var(--uff-line)",
  textDecoration: "none",
};

function Evidence({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}
