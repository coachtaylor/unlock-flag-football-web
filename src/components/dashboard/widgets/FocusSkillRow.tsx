"use client";

// One weak skill, told as a story (Build 8.5 storytelling pass).
// Summary line is always visible (rank + coverage + top driver); the full
// evidence chain — who's dragging it, which drills prove it, trend — lives
// behind a "Why" expander so the card stays uncluttered.

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import type { FocusSkill } from "@/lib/dashboard/team-home-data";

const pct = (s: number) => `${Math.round(s * 100)}%`;
const ordinal = (rank: number) =>
  rank === 1 ? "WEAKEST" : rank === 2 ? "2ND WEAKEST" : "3RD WEAKEST";

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
  const [open, setOpen] = useState(emphasis);

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
        padding: emphasis ? "14px" : "12px 14px",
        borderRadius: 10,
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line-soft)",
        borderLeft: "3px solid #FFB347", // focus = caution, never green
      }}
    >
      {/* header */}
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
            fontSize: emphasis ? 15 : 13.5,
            fontWeight: 500,
            color: "var(--uff-text)",
          }}
        >
          {skill.skillName}
        </span>
        <span className="tabular-nums" style={{ fontSize: 12, color: "var(--uff-text-mute)" }}>
          {pct(skill.avgScore)}
        </span>
      </div>

      {/* why one-liner */}
      <div style={{ fontSize: 11.5, color: "var(--uff-text-dim)", marginTop: 5, lineHeight: 1.45 }}>
        {whyBits.join(" · ")}
        {!confident && (
          <span style={{ color: "#FFB347" }}> · low confidence</span>
        )}
      </div>

      {/* expander */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          marginTop: 8,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--uff-accent, #D48A30)",
          fontSize: 11.5,
          fontWeight: 500,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
        aria-expanded={open}
      >
        {open ? "Hide why" : "Why this is the gap"}
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

          {/* trend — locked until repeat assessments exist */}
          <Evidence label="Trend">
            <div style={{ ...rowStyle, color: "var(--uff-text-dim)", fontStyle: "italic" }}>
              Re-assess this skill over the coming weeks to unlock the trend line.
            </div>
          </Evidence>
        </div>
      )}

      {/* prescription */}
      {skill.drills.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {skill.drills.map((d) => (
            <Link
              key={d.drillId}
              href={`/dashboard/team/${teamId}/drills/${d.drillId}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 8,
                background: "var(--uff-surface)",
                border: "1px solid var(--uff-line)",
                color: "var(--uff-text)",
                fontSize: 12,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              <Icon.plus size={11} /> {d.drillName}
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "var(--uff-text-dim)", marginTop: 12 }}>
          No published drill is tagged with this skill yet — tag one to get a fix here.
        </div>
      )}
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
