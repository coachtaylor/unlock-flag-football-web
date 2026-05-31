"use client";

// Drill library — responsive client. Desktop renders a sortable table
// with a sticky filter rail on the left; mobile collapses to a single-
// column card stack with the filter chips moved to a horizontal scroller.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BENCH_BY_ID,
  BENCH_TYPES,
  BenchChipStack,
  BenchIcon,
  BenchIconRow,
  CatPillWeb,
  PHASE_CATS,
  Spark,
  StatusPill,
  TrendChip,
  WEB_CAT_DEFS,
  type BenchKind,
  type CatSlug,
  type DrillStatus,
} from "@/components/uff-web/drills/atoms";
import { SKILL_GROUP_META, skillGroupMeta } from "@/lib/drills/skill-groups";
import type { SkillGroup } from "@/lib/types/skills";

// Phase derivation — separate from pickPhaseCat (which falls back to any
// cat) because the row treatment specifically wants to call out missing
// phase as a nudge ("+ Add a phase").
function rowPhase(cats: CatSlug[]):
  | { slug: CatSlug; label: string; color: string; missing: false }
  | { slug: null; label: "ADD A PHASE"; color: string; missing: true } {
  const phase = cats.find((c) => WEB_CAT_DEFS[c]?.group === "phase");
  if (phase) {
    return {
      slug: phase,
      label: WEB_CAT_DEFS[phase].label.toUpperCase(),
      color: WEB_CAT_DEFS[phase].color,
      missing: false,
    };
  }
  return {
    slug: null,
    label: "ADD A PHASE",
    color: "var(--uff-text-mute)",
    missing: true,
  };
}

export type DrillRow = {
  id: string;
  name: string;
  status: DrillStatus;
  cats: CatSlug[];
  // Skill groups the drill develops (from the skill taxonomy), in canonical
  // radar order. Drives the skill-group filter — see DrillsFilterRail.
  skillGroups: SkillGroup[];
  types: BenchKind[];
  primaryType: BenchKind | null;
  duration: number | null;
  pinned: boolean;
  updatedAt: string;
  runs: number;
  lastRunAt: string | null;
  lastResult: number | null;
  samples: number[];
  trend: number | null;
  // Which team this drill belongs to. Rendered as a chip on each row when
  // the current user has access to drills from more than one team (league
  // admins, multi-team coaches). The page sets `showTeam` on the client to
  // toggle the chip; rows always carry the team data so the chip can be
  // shown without re-fetch.
  team: { id: string; name: string; color: string };
};

type SortKey =
  | "name"
  | "category"
  | "types"
  | "status"
  | "updated"
  | "last"
  | "trend";

const DEFAULT_STATUSES: DrillStatus[] = ["published", "draft"];

export default function DrillsLibraryClient({ drills }: { drills: DrillRow[] }) {
  // Show a per-row team chip only when the user has drills across more than
  // one team. Single-team users (the common case) get a clean list.
  const showTeam = useMemo(
    () => new Set(drills.map((d) => d.team.id)).size > 1,
    [drills],
  );
  const [search, setSearch] = useState("");
  // Phase filter (structural axis) and skill-group filter (taxonomy axis) are
  // independent — a drill matches when it satisfies both active sets.
  const [activeCats, setActiveCats] = useState<Set<CatSlug>>(new Set());
  const [activeSkillGroups, setActiveSkillGroups] = useState<Set<SkillGroup>>(
    new Set()
  );
  const [activeTypes, setActiveTypes] = useState<Set<BenchKind>>(new Set());
  const [statuses, setStatuses] = useState<Set<DrillStatus>>(
    new Set(DEFAULT_STATUSES)
  );
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // "/" keyboard shortcut — focus search unless an input is already focused.
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows = useMemo(() => {
    let xs = drills.slice();
    const q = search.trim().toLowerCase();
    if (q) xs = xs.filter((d) => d.name.toLowerCase().includes(q));
    if (activeCats.size > 0)
      xs = xs.filter((d) => d.cats.some((c) => activeCats.has(c)));
    if (activeSkillGroups.size > 0)
      xs = xs.filter((d) => d.skillGroups.some((g) => activeSkillGroups.has(g)));
    if (activeTypes.size > 0)
      xs = xs.filter((d) => d.types.some((t) => activeTypes.has(t)));
    if (statuses.size > 0) xs = xs.filter((d) => statuses.has(d.status));

    const dir = sortDir === "asc" ? 1 : -1;
    // Null sentinel pushes empty values to the bottom regardless of dir.
    const nullsLast = (v: number | null) =>
      v == null ? Number.POSITIVE_INFINITY : v;
    xs.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "category":
          return (a.cats[0] ?? "").localeCompare(b.cats[0] ?? "") * dir;
        case "types":
          return (a.types.length - b.types.length) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "last": {
          const av = nullsLast(a.lastResult);
          const bv = nullsLast(b.lastResult);
          return (av - bv) * dir;
        }
        case "trend": {
          const av = nullsLast(a.trend);
          const bv = nullsLast(b.trend);
          return (av - bv) * dir;
        }
        case "updated":
        default: {
          const at = new Date(a.updatedAt).getTime();
          const bt = new Date(b.updatedAt).getTime();
          return (bt - at) * dir;
        }
      }
    });
    return xs;
  }, [
    drills,
    search,
    activeCats,
    activeSkillGroups,
    activeTypes,
    statuses,
    sortKey,
    sortDir,
  ]);

  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  }

  function clickSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "updated" ? "desc" : "asc");
    }
  }

  return (
    <div className="drill-lib">
      <DrillsToolbar
        search={search}
        setSearch={setSearch}
        searchRef={searchRef}
      />

      <div className="drill-lib-grid">
        <DrillsFilterRail
          activeCats={activeCats}
          onToggleCat={(v) => toggle(activeCats, v, setActiveCats)}
          activeSkillGroups={activeSkillGroups}
          onToggleSkillGroup={(v) =>
            toggle(activeSkillGroups, v, setActiveSkillGroups)
          }
          activeTypes={activeTypes}
          onToggleType={(v) => toggle(activeTypes, v, setActiveTypes)}
          statuses={statuses}
          onToggleStatus={(v) => toggle(statuses, v, setStatuses)}
          drills={drills}
          onClear={() => {
            setActiveCats(new Set());
            setActiveSkillGroups(new Set());
            setActiveTypes(new Set());
            setStatuses(new Set(DEFAULT_STATUSES));
          }}
        />

        <div className="drill-lib-table-wrap">
          <DrillsTable
            rows={rows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={clickSort}
            showTeam={showTeam}
          />
        </div>

        <div className="drill-lib-cards-wrap">
          <DrillsCardList rows={rows} showTeam={showTeam} />
        </div>
      </div>

      <style>{`
        .drill-lib {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .drill-lib-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
        }
        /* Show cards by default, table from md+. */
        .drill-lib-table-wrap { display: none; }
        .drill-lib-cards-wrap { display: block; }
        @media (min-width: 900px) {
          .drill-lib-grid {
            grid-template-columns: 188px minmax(0, 1fr);
          }
          .drill-lib-table-wrap { display: block; }
          .drill-lib-cards-wrap { display: none; }
        }
        .drill-row {
          transition: background 120ms ease;
        }
        .drill-row:hover {
          background: color-mix(in srgb, var(--phase) 6%, transparent);
        }
      `}</style>
    </div>
  );
}

// ── Toolbar — search only (benchmark-type filters live in the left rail) ──
function DrillsToolbar({
  search,
  setSearch,
  searchRef,
}: {
  search: string;
  setSearch: (v: string) => void;
  searchRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      style={{
        height: 40,
        background: "var(--uff-surface)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 12px",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--uff-text-mute)" }}
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        ref={searchRef}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search drills, equipment, cues…"
        style={{
          flex: 1,
          background: "transparent",
          border: 0,
          outline: 0,
          color: "var(--uff-text)",
          fontFamily: "inherit",
          fontSize: 13.5,
        }}
      />
      <kbd
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--uff-line-soft)",
          borderRadius: 4,
          padding: "1px 5px",
          color: "var(--uff-text-dim)",
        }}
      >
        /
      </kbd>
    </div>
  );
}

// ── Left filter rail (desktop only) ────────────────────────────────────
function DrillsFilterRail({
  activeCats,
  onToggleCat,
  activeSkillGroups,
  onToggleSkillGroup,
  activeTypes,
  onToggleType,
  statuses,
  onToggleStatus,
  drills,
  onClear,
}: {
  activeCats: Set<CatSlug>;
  onToggleCat: (v: CatSlug) => void;
  activeSkillGroups: Set<SkillGroup>;
  onToggleSkillGroup: (v: SkillGroup) => void;
  activeTypes: Set<BenchKind>;
  onToggleType: (v: BenchKind) => void;
  statuses: Set<DrillStatus>;
  onToggleStatus: (v: DrillStatus) => void;
  drills: DrillRow[];
  onClear: () => void;
}) {
  const countByCat = useMemo(() => {
    const out: Partial<Record<CatSlug, number>> = {};
    drills.forEach((d) => {
      d.cats.forEach((c) => {
        out[c] = (out[c] ?? 0) + 1;
      });
    });
    return out;
  }, [drills]);

  const countBySkillGroup = useMemo(() => {
    const out: Partial<Record<SkillGroup, number>> = {};
    drills.forEach((d) => {
      d.skillGroups.forEach((g) => {
        out[g] = (out[g] ?? 0) + 1;
      });
    });
    return out;
  }, [drills]);

  const countByType = useMemo(() => {
    const out: Partial<Record<BenchKind, number>> = {};
    drills.forEach((d) => {
      d.types.forEach((t) => {
        out[t] = (out[t] ?? 0) + 1;
      });
    });
    return out;
  }, [drills]);

  return (
    <aside
      className="drill-filter-rail"
      style={{
        position: "sticky",
        top: 84,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: "4px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--uff-text)",
            letterSpacing: "-0.005em",
          }}
        >
          Filters
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onClear}
          style={{
            background: "transparent",
            border: 0,
            color: "var(--uff-text-mute)",
            fontFamily: "inherit",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Clear all
        </button>
      </div>

      <FilterGroup label="Phase">
        {PHASE_CATS.map((c) => (
          <FilterRow
            key={c}
            on={activeCats.has(c)}
            onClick={() => onToggleCat(c)}
            label={WEB_CAT_DEFS[c].label}
            swatch={WEB_CAT_DEFS[c].color}
            count={countByCat[c] ?? 0}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Skill group">
        {SKILL_GROUP_META.map((g) => (
          <FilterRow
            key={g.id}
            on={activeSkillGroups.has(g.id)}
            onClick={() => onToggleSkillGroup(g.id)}
            label={g.label}
            swatch={g.color}
            count={countBySkillGroup[g.id] ?? 0}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Benchmark type">
        {BENCH_TYPES.map((t) => (
          <FilterRow
            key={t.id}
            on={activeTypes.has(t.id)}
            onClick={() => onToggleType(t.id)}
            label={t.label}
            icon={<BenchIcon kind={t.id} size={12} color={t.accent} />}
            count={countByType[t.id] ?? 0}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Status">
        {(["published", "draft", "archived"] as DrillStatus[]).map((s) => (
          <FilterRow
            key={s}
            on={statuses.has(s)}
            onClick={() => onToggleStatus(s)}
            label={s[0].toUpperCase() + s.slice(1)}
            statusDot={s}
          />
        ))}
      </FilterGroup>

      <style>{`
        .drill-filter-rail { display: none; }
        @media (min-width: 900px) {
          .drill-filter-rail { display: flex; }
        }
      `}</style>
    </aside>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: ".18em",
          color: "var(--uff-text-mute)",
          textTransform: "uppercase",
          marginBottom: 4,
          paddingLeft: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function FilterRow({
  on,
  onClick,
  label,
  swatch,
  icon,
  count,
  statusDot,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  swatch?: string;
  icon?: React.ReactNode;
  count?: number;
  statusDot?: DrillStatus;
}) {
  const dotColor =
    statusDot === "published"
      ? "var(--uff-lime)"
      : statusDot === "draft"
      ? "var(--uff-text-mute)"
      : statusDot === "archived"
      ? "#FF4D4D"
      : null;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 6px",
        borderRadius: 6,
        background: on ? "rgba(255,106,26,0.10)" : "transparent",
        border: 0,
        color: on ? "var(--uff-orange)" : "var(--uff-text-dim)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 500,
        textAlign: "left",
        transition: "background 120ms ease, color 120ms ease",
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          background: on ? "var(--uff-orange)" : "transparent",
          border: on ? "none" : "1.5px solid var(--uff-line)",
          display: "grid",
          placeItems: "center",
          color: "#0a0a0d",
          flexShrink: 0,
        }}
      >
        {on && (
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12l5 5L20 6" />
          </svg>
        )}
      </div>
      {swatch && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: swatch,
            flexShrink: 0,
          }}
        />
      )}
      {icon}
      {dotColor && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {count != null && (
        <span
          style={{
            fontSize: 10.5,
            color: on ? "var(--uff-orange)" : "var(--uff-text-mute)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ── Desktop table ──────────────────────────────────────────────────────
function DrillsTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  showTeam,
}: {
  rows: DrillRow[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  showTeam: boolean;
}) {
  return (
    <div className="w-card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1.7fr) minmax(0, 1.3fr) minmax(0, 0.9fr) 96px 124px",
          columnGap: 24,
          gap: 0,
          padding: "12px 18px",
          borderBottom: "1px solid var(--uff-line)",
          background: "rgba(255,255,255,0.015)",
          alignItems: "center",
        }}
      >
        <SortHead label="Drill" k="name" sortKey={sortKey} sortDir={sortDir} onClick={onSort} />
        <div style={{ paddingLeft: 16 }}>
          <SortHead label="Categories" k="category" sortKey={sortKey} sortDir={sortDir} onClick={onSort} />
        </div>
        <div style={{ paddingLeft: 16 }}>
          <SortHead label="Benchmarks" k="types" sortKey={sortKey} sortDir={sortDir} onClick={onSort} />
        </div>
        <div style={{ marginLeft: -12 }}>
          <SortHead label="Latest" k="last" sortKey={sortKey} sortDir={sortDir} onClick={onSort} />
        </div>
        <SortHead label="Trend" k="trend" sortKey={sortKey} sortDir={sortDir} onClick={onSort} />
      </div>

      {rows.map((d, i) => (
        <DrillTableRow
          key={d.id}
          d={d}
          last={i === rows.length - 1}
          showTeam={showTeam}
        />
      ))}

      {rows.length === 0 && (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--uff-text-mute)",
          }}
        >
          No drills match the current filters. Try clearing some — or{" "}
          <Link
            href="/drills/new"
            style={{
              color: "var(--uff-orange)",
              textDecoration: "none",
            }}
          >
            create a new drill
          </Link>
          .
        </div>
      )}
    </div>
  );
}

function SortHead({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  align?: "right" | "center";
}) {
  const active = sortKey === k;
  const justify =
    align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start";
  return (
    <button
      type="button"
      onClick={() => onClick(k)}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        gap: 5,
        justifyContent: justify,
        background: "transparent",
        border: 0,
        color: active ? "var(--uff-text)" : "var(--uff-text-mute)",
        fontFamily: "inherit",
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: ".18em",
        lineHeight: 1.2,
        textTransform: "uppercase",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        minWidth: 0,
        cursor: "pointer",
        padding: 0,
        textAlign: align === "right" ? "right" : align === "center" ? "center" : "left",
      }}
    >
      {label}
      {active && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {sortDir === "asc" ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
        </svg>
      )}
    </button>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const day = 86_400_000;
  if (diff < day) return "today";
  const days = Math.floor(diff / day);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

// Subline beneath drill name: duration · runs · last run. Falls back
// gracefully when fields are missing so brand-new drills don't show "·· ·".
function drillSubline(d: DrillRow): string {
  const parts: string[] = [];
  if (d.duration) parts.push(`${d.duration}m`);
  if (d.runs > 0) parts.push(`${d.runs} run${d.runs === 1 ? "" : "s"}`);
  if (d.lastRunAt) parts.push(`last ${relativeTime(d.lastRunAt)} ago`);
  if (parts.length === 0) return "no benchmark history";
  return parts.join(" · ");
}

// Render a single benchmark value with type-appropriate precision.
function formatBenchValue(v: number, kind: BenchKind): string {
  switch (kind) {
    case "timed":
      return v.toFixed(2);
    case "rated":
      return v.toFixed(1);
    case "pct":
      return String(Math.round(v));
    default:
      return String(v);
  }
}

function TeamChip({
  team,
}: {
  team: { name: string; color: string };
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 7px 1px 5px",
        borderRadius: 4,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--uff-line-soft)",
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: ".08em",
        color: "var(--uff-text-mute)",
        textTransform: "uppercase",
        flexShrink: 0,
        lineHeight: 1.4,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 2,
          background: team.color,
          flexShrink: 0,
        }}
      />
      {team.name}
    </span>
  );
}

// Compact skill-group chip — dot + short group label, colored by the
// taxonomy palette. Mirrors the skill-group treatment on the drill detail
// page so the list and detail views read as the same product.
function SkillGroupChip({ group }: { group: SkillGroup }) {
  const meta = skillGroupMeta(group);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 7px 1px 5px",
        borderRadius: 4,
        background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${meta.color} 38%, transparent)`,
        fontSize: 10.5,
        fontWeight: 500,
        color: "var(--uff-text-dim)",
        lineHeight: 1.4,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 2,
          background: meta.color,
          flexShrink: 0,
        }}
      />
      {meta.label}
    </span>
  );
}

function DrillTableRow({
  d,
  last,
  showTeam,
}: {
  d: DrillRow;
  last: boolean;
  showTeam: boolean;
}) {
  const phase = rowPhase(d.cats);
  const primary = d.primaryType ? BENCH_BY_ID[d.primaryType] : null;
  return (
    <Link
      href={`/drills/${d.id}`}
      className="drill-row"
      style={
        {
          position: "relative",
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1.7fr) minmax(0, 1.3fr) minmax(0, 0.9fr) 96px 124px",
          columnGap: 24,
          gap: 0,
          padding: "14px 18px",
          borderBottom: last ? "none" : "1px solid var(--uff-line-soft)",
          alignItems: "start",
          textDecoration: "none",
          color: "inherit",
          ["--phase" as string]: phase.missing ? "var(--uff-text)" : phase.color,
        } as React.CSSProperties
      }
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 6,
          top: 14,
          bottom: 14,
          width: 3,
          borderRadius: 2,
          background: phase.missing ? "var(--uff-line)" : phase.color,
        }}
      />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: "var(--uff-text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                }}
              >
                {d.name}
              </span>
              {d.pinned && (
                <span title="Pinned to dashboard" style={{ color: "var(--uff-orange)", flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 4l6 6-4 1-3 6-2-2-5 5-1-1 5-5-2-2 6-3z" />
                  </svg>
                </span>
              )}
              {d.status !== "published" && (
                <span style={{ flexShrink: 0 }}>
                  <StatusPill status={d.status} />
                </span>
              )}
              {showTeam && <TeamChip team={d.team} />}
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--uff-text-mute)",
                letterSpacing: ".04em",
              }}
            >
              {drillSubline(d)}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            paddingTop: 2,
            paddingLeft: 16,
            gap: 5,
            minWidth: 0,
          }}
        >
          {/* Phase pill(s) — the structural axis. */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {d.cats
              .filter((c) => WEB_CAT_DEFS[c]?.group === "phase")
              .map((c) => (
                <CatPillWeb key={c} slug={c} mini />
              ))}
          </div>
          {/* Skill groups — the taxonomy axis (capped at 3 + overflow). */}
          {d.skillGroups.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {d.skillGroups.slice(0, 3).map((g) => (
                <SkillGroupChip key={g} group={g} />
              ))}
              {d.skillGroups.length > 3 && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--uff-text-mute)",
                    alignSelf: "center",
                  }}
                >
                  +{d.skillGroups.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            minWidth: 0,
            display: "flex",
            justifyContent: "flex-start",
            paddingLeft: 16,
          }}
        >
          <BenchIconRow types={d.types} />
        </div>

        {/* Last result */}
        <div style={{ textAlign: "left", marginLeft: -12 }}>
          {d.lastResult != null && primary && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--uff-text)",
                letterSpacing: "-0.01em",
              }}
            >
              {formatBenchValue(d.lastResult, primary.id)}
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: "var(--uff-text-mute)",
                  marginLeft: 2,
                }}
              >
                {primary.unit}
              </span>
            </span>
          )}
        </div>

        {/* Trend (sparkline + delta) */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            gap: 8,
          }}
        >
          {d.samples.length >= 2 && primary && (
            <>
              <Spark
                data={d.samples}
                color={primary.accent}
                w={42}
                h={16}
              />
              <TrendChip delta={d.trend} better={primary.better} mini />
            </>
          )}
        </div>

    </Link>
  );
}

// ── Mobile card list ───────────────────────────────────────────────────
function DrillsCardList({
  rows,
  showTeam,
}: {
  rows: DrillRow[];
  showTeam: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div
        className="w-card"
        style={{
          padding: 32,
          textAlign: "center",
          color: "var(--uff-text-mute)",
        }}
      >
        No drills match the current filters.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((d) => {
        const phase = rowPhase(d.cats);
        return (
        <Link
          key={d.id}
          href={`/drills/${d.id}`}
          className="w-card"
          style={{
            padding: "14px 14px 14px 13px",
            textDecoration: "none",
            color: "inherit",
            display: "block",
            borderLeft: `3px solid ${phase.missing ? "var(--uff-line)" : phase.color}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: "var(--uff-text)",
                  }}
                >
                  {d.name}
                </span>
                {d.pinned && (
                  <span style={{ color: "var(--uff-orange)" }}>
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M14 4l6 6-4 1-3 6-2-2-5 5-1-1 5-5-2-2 6-3z" />
                    </svg>
                  </span>
                )}
                {showTeam && <TeamChip team={d.team} />}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--uff-text-mute)",
                }}
              >
                {drillSubline(d)}
              </div>
            </div>
            <StatusPill status={d.status} />
          </div>
          {(d.cats.some((c) => WEB_CAT_DEFS[c]?.group === "phase") ||
            d.skillGroups.length > 0) && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                marginBottom: 8,
              }}
            >
              {d.cats
                .filter((c) => WEB_CAT_DEFS[c]?.group === "phase")
                .map((c) => (
                  <CatPillWeb key={c} slug={c} mini />
                ))}
              {d.skillGroups.map((g) => (
                <SkillGroupChip key={g} group={g} />
              ))}
            </div>
          )}
          <BenchChipStack types={d.types} max={6} mini />
        </Link>
        );
      })}
    </div>
  );
}
