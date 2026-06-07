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
  DrillLeaderboard,
  RelativeStanding,
  TeamDecision,
} from "@/lib/dashboard/team-scouting-data";
import { planFromScoutingHref } from "@/lib/dashboard/team-scouting-data";

// Direction-of-signal colors (good ↑ / attention ↓). Distinct from the heat
// grade scale (heat-scale.ts) — that's an absolute data encoding; these mark
// movement direction (§2) and within-room standing (§3). One source so the two
// surfaces never drift.
const SIGNAL_GOOD = "#5BC07A";
const SIGNAL_BAD = "#E0796B";

export function fmtDelta(delta: number, unit: string): string {
  const rounded = Math.abs(delta) >= 10 ? Math.round(delta) : Math.round(delta * 100) / 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${rounded}${unit}`;
}

// §3 role-relative line — "Bottom of the Receivers · 5th of 5 assessed". The
// qualitative position is tinted by signal (low in room = attention, high =
// good); the rank detail stays muted. Shared by the card face and the side
// sheet so the two never phrase standing differently. Renders nothing when the
// cohort was too thin to rank (loader passes null).
export function RelativeStandingLine({ standing }: { standing: RelativeStanding | null }) {
  if (!standing) return null;
  const tintColor =
    standing.tier === "bottom" || standing.tier === "lower"
      ? SIGNAL_BAD
      : standing.tier === "top" || standing.tier === "upper"
        ? SIGNAL_GOOD
        : "var(--uff-text-dim)";
  return (
    <span style={{ fontSize: 11.5, color: "var(--uff-text-mute)" }}>
      <span style={{ color: tintColor }}>{standing.line}</span> · {standing.detail}
    </span>
  );
}

// Muted avatar — mono initials, faint ring in the player's identity color.
export function Avatar({ color, initials, size = 26 }: { color: string; initials: string; size?: number }) {
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

export function GradeBadge({ grade, size = 30 }: { grade: Grade | null; size?: number }) {
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
export function GroupPill({ g }: { g: GroupScore }) {
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

export function PosBadge({ pos }: { pos: string | null }) {
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
  decisions,
  headline,
  teamId,
  canManage,
}: {
  decisions: TeamDecision[];
  headline: ScoutingHeadline;
  teamId: string;
  canManage: boolean;
}) {
  const plannerHref = (focusSkillId: string | null) => planFromScoutingHref(teamId, focusSkillId);

  return (
    <div
      className="w-card"
      style={{ padding: 20, borderLeft: "3px solid var(--accent)", display: "flex", flexDirection: "column", gap: 14 }}
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

      {decisions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {decisions.map((d, i) => (
            <DecisionRow
              key={d.id}
              d={d}
              lead={i === 0}
              href={plannerHref(d.focusSkillId)}
              canManage={canManage}
            />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 17, lineHeight: 1.3, color: "var(--uff-text)" }}>
          Run benchmark assessments on a few players to surface your weakest position room.
        </div>
      )}

      {headline.biggestGain && (
        <div
          style={{
            fontSize: 13,
            color: "var(--uff-text-dim)",
            borderTop: "1px solid var(--uff-line-soft)",
            paddingTop: 12,
          }}
        >
          Biggest gain:{" "}
          <span style={{ color: "var(--uff-text)" }}>{headline.biggestGain.name}</span>
          {headline.biggestGain.primaryPosition ? ` (${headline.biggestGain.primaryPosition})` : ""} on{" "}
          {headline.biggestGain.drillName} ({fmtDelta(headline.biggestGain.delta, headline.biggestGain.unit)}).
        </div>
      )}
    </div>
  );
}

// One team decision, Claim → Evidence → Action. The lead decision gets a full
// CTA button; secondary decisions divide with a hairline + a text-link action so
// the eye lands on the primary call without three competing buttons.
function DecisionRow({
  d,
  lead,
  href,
  canManage,
}: {
  d: TeamDecision;
  lead: boolean;
  href: string;
  canManage: boolean;
}) {
  const toneColor = d.tone === "attention" ? SIGNAL_BAD : "var(--uff-text-mute)";
  const INDENT = 16;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        paddingTop: lead ? 0 : 12,
        marginTop: lead ? 0 : 12,
        borderTop: lead ? undefined : "1px solid var(--uff-line-soft)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: toneColor,
            flexShrink: 0,
            transform: "translateY(-1px)",
          }}
        />
        <span style={{ fontSize: lead ? 18 : 15, lineHeight: 1.3, color: "var(--uff-text)" }}>
          {d.claim}
        </span>
      </div>
      <span style={{ fontSize: 13, color: "var(--uff-text-dim)", paddingLeft: INDENT, lineHeight: 1.45 }}>
        {d.evidence}
      </span>
      {canManage &&
        (lead ? (
          <div style={{ paddingLeft: INDENT, marginTop: 4 }}>
            <Link href={href} className="wbtn">
              {d.actionLabel} →
            </Link>
          </div>
        ) : (
          <Link
            href={href}
            style={{ paddingLeft: INDENT, marginTop: 2, fontSize: 13, color: "var(--accent)" }}
          >
            {d.actionLabel} →
          </Link>
        ))}
    </div>
  );
}

/* ───────────────────────── §1 Position rooms ───────────────────────── */

export function PositionRooms({
  rooms,
  teamId,
  canManage,
}: {
  rooms: RoomCell[];
  teamId: string;
  canManage: boolean;
}) {
  return (
    <div className="w-card" style={{ padding: 16 }}>
      <SectionHead label="Position rooms" meta="WHERE TO INVEST" />
      <div className="scout-rooms">
        {rooms.map((r) => (
          <RoomCard key={r.id} r={r} teamId={teamId} canManage={canManage} />
        ))}
      </div>
    </div>
  );
}

// One room as a micro-story: Claim (room + grade) → Evidence (who's assessed,
// provisional if thin) → the weakest skill area → Action (plan it). The grade
// shows from the first assessment; 1–2 players just tag it provisional.
function RoomCard({ r, teamId, canManage }: { r: RoomCell; teamId: string; canManage: boolean }) {
  const graded = !r.locked && r.grade != null;
  const provisional = graded && !r.gradeReliable;
  const plannerHref = planFromScoutingHref(teamId, r.ctaFocusSkillId);
  return (
    <div
      className="scout-room"
      style={{ opacity: r.locked ? 0.6 : 1, display: "flex", flexDirection: "column", gap: 8 }}
      title={
        r.locked
          ? `${r.label} — no benchmarked players yet`
          : `${r.label}: ${r.grade ? gradeLabel(r.grade) : ""}${provisional ? " (provisional — 1–2 players)" : ""}`
      }
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--uff-text)" }}>{r.label}</span>
        <GradeBadge grade={graded ? r.grade : null} size={28} />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--uff-text-mute)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span>
          {r.assessed}/{r.players} assessed
        </span>
        {provisional && <ProvisionalTag />}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--uff-text-mute)" }}>
        {r.locked ? (
          "Run a benchmark to unlock"
        ) : r.weakestSkillLabel ? (
          <>Weakest: <span style={{ color: "var(--uff-text-dim)" }}>{r.weakestSkillLabel}</span></>
        ) : (
          "—"
        )}
      </div>
      {graded && canManage && r.weakestSkillLabel && (
        <Link href={plannerHref} style={{ fontSize: 12, color: "var(--accent)", marginTop: 2 }}>
          Plan {r.weakestSkillLabel} →
        </Link>
      )}
    </div>
  );
}

// Subtle "this grade rests on 1–2 players" marker — keeps the number honest
// without hiding it (§12.2a: show the number, qualify the claim).
function ProvisionalTag() {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--uff-text-mute)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 4,
        padding: "0 5px",
      }}
    >
      provisional
    </span>
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
                m.kind === "riser" ? SIGNAL_GOOD : m.kind === "regressed" ? SIGNAL_BAD : "var(--uff-text-mute)",
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
          <MoverGroupLabel text="Regressed" color={SIGNAL_BAD} />
          <MoverChips rows={regressed} empty="Nothing regressed — nice." />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MoverGroupLabel text="Stalled" color="var(--uff-text-mute)" />
          <MoverChips rows={stalled} empty="No stalled benchmarks." />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MoverGroupLabel text="Improving" color={SIGNAL_GOOD} />
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

/* ───────────────────────── §2b Per-drill standings ───────────────────────── */

// The practice-1 payoff: even one session lets a coach rank everyone on a drill.
// Pure measurement (latest value per player), no verdict — honest and useful
// from the very first benchmark, and still handy at high volume as the quick
// "who leads this drill" read.
export function DrillLeaderboards({ boards }: { boards: DrillLeaderboard[] }) {
  return (
    <div className="w-card" style={{ padding: 16 }}>
      <SectionHead label="Per-drill standings" meta="WHAT YOU'VE MEASURED" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))",
          gap: 12,
        }}
      >
        {boards.map((b) => (
          <DrillBoard key={b.drillId} board={b} />
        ))}
      </div>
    </div>
  );
}

function DrillBoard({ board }: { board: DrillLeaderboard }) {
  const shown = board.rows.slice(0, 6);
  const extra = board.rows.length - shown.length;
  return (
    <div
      style={{
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 10,
        padding: 12,
        background: "rgba(255,255,255,0.015)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--uff-text)",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {board.drillName}
        </span>
        {board.benchmarkType && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--uff-text-mute)",
            }}
          >
            {board.benchmarkType}
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: "var(--uff-text-mute)", marginBottom: 8 }}>
        {board.better === "lower" ? "Lower is better" : "Higher is better"} ·{" "}
        {board.playersAssessed} assessed
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {shown.map((r, i) => (
          <div key={r.playerId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 16,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                color: i === 0 ? "var(--accent)" : "var(--uff-text-mute)",
                textAlign: "right",
              }}
            >
              {i + 1}
            </span>
            <Avatar color={r.color} initials={r.initials} size={20} />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12,
                color: "var(--uff-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {r.name}
            </span>
            <PosBadge pos={r.primaryPosition} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                fontWeight: i === 0 ? 700 : 400,
                color: i === 0 ? "var(--uff-text)" : "var(--uff-text-dim)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.label}
              {r.unit}
            </span>
          </div>
        ))}
        {extra > 0 && (
          <div style={{ fontSize: 11, color: "var(--uff-text-mute)", paddingLeft: 24 }}>
            +{extra} more
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── §3 Player report cards ───────────────────────── */

// The inner face of a report card — header (muted avatar, name, positions,
// overall grade) + position-relevant group pills + summary line. Presentational
// only; the interactive grid (ScoutingPlayers) wraps this in a tappable card and
// the side sheet reuses the same atoms for its header. A faint "View →" cue
// signals the card opens the sheet without adding a competing button.
export function PlayerCardFace({ c }: { c: PlayerReportCard }) {
  const assessed = c.benchmarkCount > 0 && c.overallGrade != null;
  return (
    <>
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
          {c.relativeStanding && (
            <div style={{ marginTop: 4 }}>
              <RelativeStandingLine standing={c.relativeStanding} />
            </div>
          )}
        </>
      ) : (
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--uff-text-mute)" }}>
          Not assessed yet
        </div>
      )}
    </>
  );
}
