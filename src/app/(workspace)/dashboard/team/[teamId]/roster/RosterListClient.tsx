"use client";

// Roster list client — owns search input, status filter chips, position
// filter chips, and renders a table at md+ that collapses to stacked
// cards on phones. The server passes pre-shaped RosterPlayer rows.

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/uff/icons";
import { playerColorForIndex } from "@/components/uff/team-colors";
import { initialsFor } from "@/lib/format/initials";
import InjuryModal from "@/components/roster/InjuryModal";

export type RosterPlayer = {
  id: string;
  name: string;
  positions: string[];
  jerseyNumber: string | null;
  status: "active" | "inactive";
  isCaptain: boolean;
  isInjured: boolean;
  injuryNote: string | null;
  colorIndex: number;
  lastBench: {
    drillName: string;
    benchmarkType: string | null;
    value: string;
    when: string;
  } | null;
};

type StatusFilter = "all" | "active" | "inactive" | "injured";

const POSITION_OPTIONS = ["QB", "WR", "RB", "CB", "S", "LB", "C"];

export default function RosterListClient({
  teamId,
  teamName,
  players,
  canManage,
}: {
  teamId: string;
  teamName: string;
  players: RosterPlayer[];
  // View-only members (team_manager) get no Add-player button and a
  // non-interactive status pill — mirrors the write-side RLS.
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [positionFilter, setPositionFilter] = useState<string | null>(null);
  // Clicking a row's status pill targets that player here, which opens the
  // shared InjuryModal (one instance for the whole list). Closing nulls it.
  const [injuryTarget, setInjuryTarget] = useState<RosterPlayer | null>(null);

  const counts = useMemo(
    () => ({
      all: players.length,
      active: players.filter((p) => p.status === "active").length,
      inactive: players.filter((p) => p.status === "inactive").length,
      injured: players.filter((p) => p.isInjured).length,
    }),
    [players]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (statusFilter === "active" && p.status !== "active") return false;
      if (statusFilter === "inactive" && p.status !== "inactive") return false;
      if (statusFilter === "injured" && !p.isInjured) return false;
      if (positionFilter && !p.positions.includes(positionFilter)) return false;
      if (!q) return true;
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.jerseyNumber && p.jerseyNumber.toLowerCase().includes(q))
        return true;
      if (p.positions.some((pos) => pos.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [players, search, statusFilter, positionFilter]);

  const rosterBasePath = `/dashboard/team/${teamId}/roster`;

  if (players.length === 0) {
    return (
      <EmptyRoster
        teamName={teamName}
        newHref={`${rosterBasePath}/new`}
        canManage={canManage}
      />
    );
  }

  return (
    <>
      {/* Action row: search + Add player */}
      <div
        className="roster-action-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: "1 1 240px",
            maxWidth: 360,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--uff-surface-2)",
            border: "1px solid var(--uff-line-soft)",
            borderRadius: 10,
            padding: "0 12px",
            height: 38,
          }}
        >
          <span style={{ color: "var(--uff-text-mute)", display: "grid" }}>
            <Icon.search size={14} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, jersey, position…"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: 0,
              outline: "none",
              color: "var(--uff-text)",
              fontSize: 13,
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              style={{
                background: "transparent",
                border: 0,
                color: "var(--uff-text-mute)",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 4,
              }}
            >
              ×
            </button>
          )}
        </div>
        {canManage && (
          <Link
            href={`${rosterBasePath}/new`}
            className="wbtn primary"
            style={{ height: 38, marginLeft: "auto" }}
          >
            <Icon.plus size={13} /> Add player
          </Link>
        )}
      </div>

      {/* Filter row */}
      <div
        className="roster-filter-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={filterLabelStyle}>Status</span>
        {(
          [
            { id: "all", label: "All", count: counts.all },
            { id: "active", label: "Active", count: counts.active },
            { id: "inactive", label: "Inactive", count: counts.inactive },
            { id: "injured", label: "Injured", count: counts.injured },
          ] as { id: StatusFilter; label: string; count: number }[]
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setStatusFilter(opt.id)}
            aria-pressed={statusFilter === opt.id}
            className={`chip ${statusFilter === opt.id ? "on" : ""}`}
          >
            {opt.label} <span className="ct">{opt.count}</span>
          </button>
        ))}

        <span
          style={{
            width: 1,
            height: 22,
            background: "var(--uff-line-soft)",
            margin: "0 2px",
          }}
        />

        <span style={filterLabelStyle}>Position</span>
        {POSITION_OPTIONS.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() =>
              setPositionFilter((cur) => (cur === pos ? null : pos))
            }
            aria-pressed={positionFilter === pos}
            className={`chip ${positionFilter === pos ? "on" : ""}`}
          >
            {pos}
          </button>
        ))}

        <span
          style={{
            marginLeft: "auto",
            fontSize: 11.5,
            color: "var(--uff-text-mute)",
          }}
        >
          Showing{" "}
          <b style={{ color: "var(--uff-text)" }}>{filtered.length}</b> of{" "}
          {players.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div
          className="w-card subdued"
          style={{
            padding: 24,
            textAlign: "center",
            border: "1px dashed var(--uff-line)",
            background: "transparent",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)" }}>
            No players match these filters.
          </p>
        </div>
      ) : (
        <div
          className="roster-table w-card"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <div className="roster-row-grid roster-head">
            <span className="roster-identity">
              <span className="roster-jersey" style={{ fontWeight: 700 }}>
                #
              </span>
              {/* spacer matching the row avatar so "Player" sits over names */}
              <span style={{ width: 32, flexShrink: 0 }} />
              <span>Player</span>
            </span>
            <span>Positions</span>
            <span>Status</span>
            <span>Last benchmark</span>
            <span />
          </div>

          {filtered.map((p, i) => (
            <RosterRow
              key={p.id}
              p={p}
              href={`${rosterBasePath}/${p.id}`}
              stripe={i % 2 === 1}
              canManage={canManage}
              onRequestInjury={() => setInjuryTarget(p)}
            />
          ))}
        </div>
      )}

      {injuryTarget && (
        <InjuryModal
          playerId={injuryTarget.id}
          teamId={teamId}
          playerName={injuryTarget.name}
          currentlyInjured={injuryTarget.isInjured}
          currentNote={injuryTarget.injuryNote}
          open={true}
          onOpenChange={(next) => {
            if (!next) setInjuryTarget(null);
          }}
        />
      )}

      <style>{`
        .roster-row-grid {
          display: grid;
          /* Identity (# + avatar + name) is ONE cell with tight internal
             spacing — the only visually-close group. The remaining columns
             share even fluid widths; Status is max-content so the pill
             defines its own width instead of reserving a fixed column. */
          grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr) max-content minmax(0, 1.2fr) 28px;
          align-items: center;
          gap: 24px;
          padding: 12px 18px;
        }
        /* Tight internal rhythm for the identity cluster (#, avatar, name). */
        .roster-identity {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }
        .roster-jersey {
          width: 30px;
          text-align: center;
          flex-shrink: 0;
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 700;
        }
        .roster-head {
          padding: 10px 18px;
          border-bottom: 1px solid var(--uff-line-soft);
          background: rgba(255,255,255,0.015);
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--uff-text-mute);
        }
        .roster-row {
          border-bottom: 1px solid var(--uff-line-soft);
          cursor: pointer;
          color: inherit;
          text-decoration: none;
          transition: background 120ms ease;
        }
        .roster-row:last-child { border-bottom: 0; }
        .roster-row:hover { background: rgba(255,255,255,0.025); }
        .roster-row.stripe { background: rgba(255,255,255,0.012); }
        .roster-row.stripe:hover { background: rgba(255,255,255,0.03); }

        @media (max-width: 900px) {
          .roster-action-row > .wbtn { margin-left: 0 !important; }
        }
      `}</style>
    </>
  );
}

function RosterRow({
  p,
  href,
  stripe,
  canManage,
  onRequestInjury,
}: {
  p: RosterPlayer;
  href: string;
  stripe: boolean;
  canManage: boolean;
  onRequestInjury: () => void;
}) {
  function handleToggleInjury(e: React.MouseEvent) {
    // Row is wrapped in a Link — without these guards the click would
    // also navigate to the player detail page. Opens the injury modal so
    // the user can add/keep a note rather than flipping the flag blindly.
    e.preventDefault();
    e.stopPropagation();
    onRequestInjury();
  }

  return (
    <Link href={href} className={`roster-row roster-row-grid ${stripe ? "stripe" : ""}`}>
      <span className="roster-identity">
        <span
          className="roster-jersey"
          style={{
            color: p.jerseyNumber ? "var(--uff-text-dim)" : "var(--uff-text-mute)",
          }}
        >
          {p.jerseyNumber ? `#${p.jerseyNumber}` : "—"}
        </span>
        <Avatar player={p} size={32} fontSize={11} />
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--uff-text)",
              letterSpacing: "-0.005em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.name}
          </span>
          {p.isCaptain && <CaptainPip />}
          {p.isInjured && <InjuredPip />}
        </span>
      </span>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {p.positions.map((pos) => (
          <PositionPill key={pos} pos={pos} />
        ))}
        {p.positions.length === 0 && (
          <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>—</span>
        )}
      </div>

      <StatusPill
        status={p.status}
        injured={p.isInjured}
        onToggle={canManage ? handleToggleInjury : undefined}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {p.lastBench ? (
          <>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--uff-text)",
                whiteSpace: "nowrap",
              }}
            >
              {p.lastBench.value}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--uff-text-mute)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {p.lastBench.drillName} · {p.lastBench.when}
            </span>
          </>
        ) : (
          <span
            style={{
              fontSize: 11.5,
              color: "var(--uff-text-mute)",
              fontStyle: "italic",
            }}
          >
            No benchmarks yet
          </span>
        )}
      </div>

      <div
        style={{ display: "flex", justifyContent: "flex-end", color: "var(--uff-text-mute)" }}
      >
        <Icon.chevR size={13} />
      </div>
    </Link>
  );
}

function Avatar({
  player,
  size,
  fontSize,
}: {
  player: RosterPlayer;
  size: number;
  fontSize: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: playerColorForIndex(player.colorIndex),
        color: "#1a0f08",
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-mono)",
        fontSize,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        flexShrink: 0,
        opacity: player.status === "inactive" ? 0.5 : 1,
      }}
    >
      {initialsFor(player.name)}
    </div>
  );
}

function CaptainPip() {
  return (
    <span
      title="Captain"
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: "#FFB347",
        padding: "1px 5px",
        borderRadius: 3,
        background: "rgba(255,179,71,0.12)",
      }}
    >
      C
    </span>
  );
}

function InjuredPip() {
  return (
    <span
      title="Injured"
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: "var(--uff-red)",
        padding: "1px 5px",
        borderRadius: 3,
        background: "rgba(255,77,77,0.12)",
      }}
    >
      INJ
    </span>
  );
}

function PositionPill({ pos }: { pos: string }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        padding: "2px 7px",
        borderRadius: 4,
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line-soft)",
        color: "var(--uff-text-dim)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {pos}
    </span>
  );
}

function StatusPill({
  status,
  injured,
  compact,
  onToggle,
}: {
  status: "active" | "inactive";
  injured: boolean;
  compact?: boolean;
  // When provided, the pill becomes a button that opens the injury modal:
  // a click on "Active"/"Inactive" starts marking the player injured, a
  // click on "Injured" starts marking them healthy again.
  onToggle?: (e: React.MouseEvent) => void;
}) {
  const isActive = status === "active";
  const label = injured ? "Injured" : isActive ? "Active" : "Inactive";
  const color = injured
    ? "var(--uff-red)"
    : isActive
      ? "var(--uff-lime)"
      : "var(--uff-text-mute)";
  const bg = injured
    ? "rgba(255,77,77,0.10)"
    : isActive
      ? "rgba(194,255,61,0.10)"
      : "rgba(255,255,255,0.04)";
  const border = injured
    ? "1px solid rgba(255,77,77,0.30)"
    : isActive
      ? "1px solid rgba(194,255,61,0.30)"
      : "1px solid var(--uff-line-soft)";
  const interactive = typeof onToggle === "function";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!interactive}
      title={injured ? "Mark healthy" : "Mark injured"}
      aria-label={injured ? "Mark healthy" : "Mark injured"}
      onMouseEnter={(e) => {
        if (interactive) e.currentTarget.style.filter = "brightness(1.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = "none";
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "inherit",
        fontSize: compact ? 10 : 10.5,
        fontWeight: 700,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        lineHeight: 1,
        margin: 0,
        padding: compact ? "4px 8px" : "5px 10px",
        borderRadius: 999,
        background: bg,
        border,
        color,
        whiteSpace: "nowrap",
        flexShrink: 0,
        cursor: interactive ? "pointer" : "default",
        transition: "filter 120ms ease",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
        }}
      />
      {label}
    </button>
  );
}

function EmptyRoster({
  teamName,
  newHref,
  canManage,
}: {
  teamName: string;
  newHref: string;
  canManage: boolean;
}) {
  return (
    <div
      className="w-card"
      style={{
        padding: "32px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
        background:
          "linear-gradient(180deg, rgba(255,106,26,0.05) 0%, transparent 50%), var(--uff-surface)",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "var(--uff-orange)",
        }}
      >
        GET STARTED
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--uff-text)",
          maxWidth: 520,
        }}
      >
        Build the {teamName} roster.
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--uff-text-dim)",
          lineHeight: 1.5,
          maxWidth: 460,
        }}
      >
        Add players to start benchmarking and planning practices. Each player
        gets a color, a status, and a benchmark history that shows up here as
        you log assessments.
      </p>
      {canManage ? (
        <Link
          href={newHref}
          className="wbtn primary"
          style={{
            marginTop: 4,
            height: 44,
            fontSize: 14,
            padding: "0 22px",
          }}
        >
          Add players <Icon.arrowRight size={14} />
        </Link>
      ) : (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--uff-text-mute)" }}>
          Only coaches and captains can add players.
        </p>
      )}
    </div>
  );
}

const filterLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.14em",
  color: "var(--uff-text-mute)",
  textTransform: "uppercase",
  marginRight: 2,
};
