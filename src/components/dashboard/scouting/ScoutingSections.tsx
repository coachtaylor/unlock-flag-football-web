// Team Scouting Report — section components (Build 8.7).
//
// Presentational server components for §0–§3. They take already-aggregated props
// from lib/dashboard/team-scouting-data.ts; no data access here. POSITION-AWARE:
// players are graded only on the skill groups their position uses, and the team
// view is organized into position rooms. Player avatars are MUTED (mono initials
// on a faint identity-color ring) so the only "meaning" color in these zones is
// the heat grade.

import Link from "next/link";
import SectionHead from "@/components/dashboard/widgets/SectionHead";
import { gradeLabel, gradeColor, type Grade } from "@/lib/dashboard/heat-scale";
import type {
  ScoutingHeadline,
  RoomCell,
  MoverRow,
  PlayerReportCard,
  GroupScore,
} from "@/lib/dashboard/team-scouting-data";

function fmtDelta(delta: number, unit: string): string {
  const rounded = Math.abs(delta) >= 10 ? Math.round(delta) : Math.round(delta * 100) / 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${rounded}${unit}`;
}

// Muted avatar — mono initials, faint ring in the player's identity color.
function Avatar({ color, initials, size = 26 }: { color: string; initials: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 600,
        color: "var(--uff-text-dim)",
        background: "rgba(255,255,255,0.04)",
        border: `1.5px solid ${color}`,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

function GradeBadge({ grade, size = 30 }: { grade: Grade | null; size?: number }) {
  return (
    <span
      title={grade ? gradeLabel(grade) : "Not enough data"}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.5,
        fontWeight: 700,
        color: grade ? "#0B0F14" : "var(--uff-text-mute)",
        background: gradeColor(grade),
        flexShrink: 0,
      }}
    >
      {grade ?? "–"}
    </span>
  );
}

// Small skill-grade pill for a player's position-relevant group.
function GroupPill({ g }: { g: GroupScore }) {
  const has = g.score != null && g.grade != null;
  return (
    <span
      title={has ? `${g.label}: ${gradeLabel(g.grade as Grade)}` : `${g.label}: no data`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 7px",
        borderRadius: 6,
        fontSize: 11,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--uff-line-soft)",
        color: "var(--uff-text-mute)",
      }}
    >
      {g.label}
      <span
        style={{
          fontWeight: 700,
          color: has ? gradeColor(g.grade) : "var(--uff-text-mute)",
        }}
      >
        {g.grade ?? "–"}
      </span>
    </span>
  );
}

function PosBadge({ pos }: { pos: string | null }) {
  if (!pos) return null;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: "var(--uff-text-dim)",
        background: "rgba(255,255,255,0.05)",
        borderRadius: 5,
        padding: "1px 5px",
      }}
    >
      {pos}
    </span>
  );
}

/* ───────────────────────── §0 Headline answer-card ───────────────────────── */

export function ScoutingHeadlineCard({
  headline,
  teamId,
}: {
  headline: ScoutingHeadline;
  teamId: string;
}) {
  const plannerHref = headline.focusSkillId
    ? `/dashboard/team/${teamId}/practice/new?focusSkill=${headline.focusSkillId}`
    : `/dashboard/team/${teamId}/practice/new`;

  return (
    <div
      className="w-card"
      style={{ padding: 20, borderLeft: "3px solid var(--accent)", display: "flex", flexDirection: "column", gap: 12 }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
        }}
      >
        This week&rsquo;s read
      </span>

      <div style={{ fontSize: 20, lineHeight: 1.3, color: "var(--uff-text)" }}>
        {headline.weakestRoomLabel ? (
          <>
            Your <strong style={{ fontWeight: 600 }}>{headline.weakestRoomLabel}</strong> is your
            weakest room
            {headline.weakestRoomSkillLabel ? (
              <>
                {" "}
                — <span style={{ color: "var(--accent-soft)" }}>{headline.weakestRoomSkillLabel}</span> is the gap
              </>
            ) : null}
            {headline.corroboratingTag ? (
              <>
                {" "}
                · most-tagged note: &ldquo;{headline.corroboratingTag}&rdquo; ({headline.corroboratingTagCount}×).
              </>
            ) : (
              "."
            )}
          </>
        ) : (
          "Run benchmark assessments on a few players to surface your weakest position room."
        )}
      </div>

      {headline.biggestGain && (
        <div style={{ fontSize: 13, color: "var(--uff-text-dim)" }}>
          Biggest gain:{" "}
          <span style={{ color: "var(--uff-text)" }}>{headline.biggestGain.name}</span>
          {headline.biggestGain.primaryPosition ? ` (${headline.biggestGain.primaryPosition})` : ""} on{" "}
          {headline.biggestGain.drillName} ({fmtDelta(headline.biggestGain.delta, headline.biggestGain.unit)}).
        </div>
      )}

      <div>
        <Link href={plannerHref} className="wbtn" style={{ marginTop: 4 }}>
          {headline.ctaDrillName ? `Plan ${headline.ctaDrillName}` : "Plan a practice"} →
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────────── §1 Position rooms ───────────────────────── */

export function PositionRooms({ rooms }: { rooms: RoomCell[] }) {
  return (
    <div className="w-card" style={{ padding: 16 }}>
      <SectionHead label="Position rooms" meta="WHERE TO INVEST" />
      <div className="scout-rooms">
        {rooms.map((r) => (
          <div
            key={r.id}
            className="scout-room"
            style={{ opacity: r.locked ? 0.6 : 1 }}
            title={
              r.locked
                ? `${r.label} — no benchmarked players yet`
                : `${r.label}: ${r.grade ? gradeLabel(r.grade) : ""}`
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--uff-text)" }}>{r.label}</span>
              <GradeBadge grade={r.locked ? null : r.grade} size={28} />
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--uff-text-mute)" }}>
              {r.assessed}/{r.players} assessed
            </div>
            <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--uff-text-mute)" }}>
              {r.locked
                ? "Run a benchmark to unlock"
                : r.weakestSkillLabel
                  ? <>Weakest: <span style={{ color: "var(--uff-text-dim)" }}>{r.weakestSkillLabel}</span></>
                  : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── §2 Movement ───────────────────────── */

function MoverChips({ rows, empty }: { rows: MoverRow[]; empty: string }) {
  if (rows.length === 0) {
    return <div style={{ fontSize: 12.5, color: "var(--uff-text-mute)" }}>{empty}</div>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {rows.map((m, i) => (
        <div
          key={`${m.playerId}-${m.drillName}-${i}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 10px 5px 5px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--uff-line-soft)",
          }}
        >
          <Avatar color={m.color} initials={m.initials} size={22} />
          <span style={{ fontSize: 12.5, color: "var(--uff-text)" }}>{m.name}</span>
          <PosBadge pos={m.primaryPosition} />
          <span style={{ fontSize: 11.5, color: "var(--uff-text-mute)" }}>{m.drillName}</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color:
                m.kind === "riser" ? "#5BC07A" : m.kind === "regressed" ? "#E0796B" : "var(--uff-text-mute)",
            }}
          >
            {m.kind === "riser" ? "↑" : m.kind === "regressed" ? "↓" : "→"} {fmtDelta(m.delta, m.unit)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MovementStrips({ movers }: { movers: MoverRow[] }) {
  const regressed = movers.filter((m) => m.kind === "regressed").slice(0, 6);
  const stalled = movers.filter((m) => m.kind === "stalled").slice(0, 6);
  const risers = movers.filter((m) => m.kind === "riser").slice(0, 6);

  return (
    <div className="w-card" style={{ padding: 16 }}>
      <SectionHead label="Movement" meta="SINCE LAST ASSESSMENT" />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MoverGroupLabel text="Regressed" color="#E0796B" />
          <MoverChips rows={regressed} empty="Nothing regressed — nice." />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MoverGroupLabel text="Stalled" color="var(--uff-text-mute)" />
          <MoverChips rows={stalled} empty="No stalled benchmarks." />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MoverGroupLabel text="Improving" color="#5BC07A" />
          <MoverChips rows={risers} empty="Reassess players to show improvement here." />
        </div>
      </div>
    </div>
  );
}

function MoverGroupLabel({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color,
      }}
    >
      {text}
    </span>
  );
}

/* ───────────────────────── §3 Player report cards ───────────────────────── */

export function PlayerReportGrid({ cards }: { cards: PlayerReportCard[] }) {
  return (
    <div className="w-card" style={{ padding: 16 }}>
      <SectionHead label="Player report cards" meta={`${cards.length} PLAYERS`} />
      <div className="scout-players">
        {cards.map((c) => {
          const assessed = c.benchmarkCount > 0 && c.overallGrade != null;
          return (
            <div key={c.playerId} className="scout-player-card">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar color={c.color} initials={c.initials} size={30} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      color: "var(--uff-text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.name}
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                    {c.positions.length ? (
                      c.positions.map((p, i) => <PosBadge key={p} pos={i === 0 ? `${p}★` : p} />)
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>no position</span>
                    )}
                  </div>
                </div>
                <GradeBadge grade={assessed ? c.overallGrade : null} />
              </div>

              {assessed ? (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                    {c.groupScores.map((g) => (
                      <GroupPill key={g.group} g={g} />
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--uff-text-mute)" }}>
                    Weakest: <span style={{ color: "var(--uff-text-dim)" }}>{c.weakestGroupLabel ?? "—"}</span>
                    {" · "}
                    {c.benchmarkCount} benchmark{c.benchmarkCount === 1 ? "" : "s"}
                    {c.noteCount > 0 ? ` · ${c.noteCount} note${c.noteCount === 1 ? "" : "s"}` : ""}
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--uff-text-mute)" }}>
                  Not assessed yet
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
