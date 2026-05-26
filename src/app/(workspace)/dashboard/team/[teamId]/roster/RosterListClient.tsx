"use client";

// Roster list client — owns search input, status filter chips, position
// filter chips, and renders a table at md+ that collapses to stacked
// cards on phones. The server passes pre-shaped RosterPlayer rows.

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/uff/icons";
import { playerColorForIndex } from "@/components/uff/team-colors";

export type RosterPlayer = {
  id: string;
  name: string;
  positions: string[];
  jerseyNumber: string | null;
  status: "active" | "inactive";
  isCaptain: boolean;
  isInjured: boolean;
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

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default function RosterListClient({
  teamId,
  teamName,
  players,
}: {
  teamId: string;
  teamName: string;
  players: RosterPlayer[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [positionFilter, setPositionFilter] = useState<string | null>(null);

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
    return <EmptyRoster teamName={teamName} newHref={`${rosterBasePath}/new`} />;
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
        <Link
          href={`${rosterBasePath}/new`}
          className="wbtn primary"
          style={{ height: 38, marginLeft: "auto" }}
        >
          <Icon.plus size={13} /> Add player
        </Link>
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
            <span />
            <span>Player</span>
            <span>Positions</span>
            <span style={{ textAlign: "center" }}>#</span>
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
            />
          ))}
        </div>
      )}

      <style>{`
        .roster-row-grid {
          display: grid;
          grid-template-columns: 44px 1.6fr 1.4fr 60px 110px 1.8fr 110px;
          align-items: center;
          gap: 14px;
          padding: 12px 18px;
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
}: {
  p: RosterPlayer;
  href: string;
  stripe: boolean;
}) {
  return (
    <Link href={href} className={`roster-row roster-row-grid ${stripe ? "stripe" : ""}`}>
      <Avatar player={p} size={32} fontSize={11} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {p.positions.map((pos) => (
          <PositionPill key={pos} pos={pos} />
        ))}
        {p.positions.length === 0 && (
          <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>—</span>
        )}
      </div>

      <span
        style={{
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          fontWeight: 700,
          color: p.jerseyNumber ? "var(--uff-text-dim)" : "var(--uff-text-mute)",
        }}
      >
        {p.jerseyNumber ? `#${p.jerseyNumber}` : "—"}
      </span>

      <StatusPill status={p.status} injured={p.isInjured} />

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
}: {
  status: "active" | "inactive";
  injured: boolean;
  compact?: boolean;
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
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: compact ? 10 : 10.5,
        fontWeight: 700,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        padding: compact ? "2px 7px" : "3px 9px",
        borderRadius: 999,
        background: bg,
        border,
        color,
        whiteSpace: "nowrap",
        flexShrink: 0,
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
    </span>
  );
}

function EmptyRoster({
  teamName,
  newHref,
}: {
  teamName: string;
  newHref: string;
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
