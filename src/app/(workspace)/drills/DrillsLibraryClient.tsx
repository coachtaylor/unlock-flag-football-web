"use client";

// Drill library — responsive client. Mirrors the preset library
// (PresetLibraryClient): a counted search toolbar, a sticky filter rail on
// desktop (md/900px+), and a responsive card grid (1 → 2 → 3 columns) that
// is identical on mobile and desktop. The old desktop table treatment was
// retired so the team library and the preset library read as one product.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BENCH_BY_ID,
  BENCH_TYPES,
  BenchChipStack,
  BenchIcon,
  PHASE_CATS,
  Spark,
  StatusPill,
  TrendChip,
  WEB_CAT_DEFS,
  type BenchKind,
  type CatSlug,
  type DrillStatus,
} from "@/components/uff-web/drills/atoms";
import { SkillChip } from "@/components/uff-web/drills/SkillChip";
import { SKILL_GROUP_META } from "@/lib/drills/skill-groups";
import type { SkillGroup, TaggedSkill } from "@/lib/types/skills";

// Phase derivation — separate from pickPhaseCat (which falls back to any
// cat) because the card treatment specifically wants to call out a missing
// phase via a muted left border.
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
  description: string | null;
  status: DrillStatus;
  cats: CatSlug[];
  // Skill groups the drill develops (from the skill taxonomy), in canonical
  // radar order. Drives the skill-group filter — see DrillsFilterRail.
  skillGroups: SkillGroup[];
  // The drill's tagged skills (primaries first) — rendered as named chips on
  // the card, matching the preset library cards.
  skills: TaggedSkill[];
  types: BenchKind[];
  primaryType: BenchKind | null;
  duration: number | null;
  reps: number | null;
  pinned: boolean;
  updatedAt: string;
  runs: number;
  lastRunAt: string | null;
  lastResult: number | null;
  samples: number[];
  trend: number | null;
  // Which team this drill belongs to. Rendered as a chip on each card when
  // the current user has access to drills from more than one team (league
  // admins, multi-team coaches). The page sets `showTeam` on the client to
  // toggle the chip; cards always carry the team data so the chip can be
  // shown without re-fetch.
  team: { id: string; name: string; color: string };
};

const DEFAULT_STATUSES: DrillStatus[] = ["published", "draft"];

// Sort axes for the card grid. The table's click-to-sort column heads are
// gone; these are surfaced through the SortMenu in the toolbar instead.
type SortKey = "updated" | "name" | "last" | "trend" | "runs";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "updated", label: "Recently updated" },
  { key: "name", label: "Name" },
  { key: "last", label: "Latest result" },
  { key: "trend", label: "Trend" },
  { key: "runs", label: "Most runs" },
];
// The direction a freshly-selected key defaults to (before any toggle).
const SORT_DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  updated: "desc",
  name: "asc",
  last: "desc",
  trend: "desc",
  runs: "desc",
};

export default function DrillsLibraryClient({ drills }: { drills: DrillRow[] }) {
  // Show a per-card team chip only when the user has drills across more than
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

    // Comparators are written ascending; `dir` flips them for desc. Null
    // numeric values sort to the bottom regardless of direction so empty
    // drills never crowd the top.
    const dir = sortDir === "asc" ? 1 : -1;
    const cmpNum = (a: number | null, b: number | null) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1; // a after b (nulls last) — independent of dir
      if (b == null) return -1;
      return (a - b) * dir;
    };
    xs.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "last":
          return cmpNum(a.lastResult, b.lastResult);
        case "trend":
          return cmpNum(a.trend, b.trend);
        case "runs":
          return (a.runs - b.runs) * dir;
        case "updated":
        default:
          return (
            (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) *
            dir
          );
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

  // Select a sort axis; re-selecting the active axis flips direction.
  function selectSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(SORT_DEFAULT_DIR[k]);
    }
  }

  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  }

  const clearAll = () => {
    setActiveCats(new Set());
    setActiveSkillGroups(new Set());
    setActiveTypes(new Set());
    setStatuses(new Set(DEFAULT_STATUSES));
  };

  return (
    <div className="drill-lib">
      <DrillsToolbar
        search={search}
        setSearch={setSearch}
        searchRef={searchRef}
        total={drills.length}
        showing={rows.length}
        sortKey={sortKey}
        sortDir={sortDir}
        onSelectSort={selectSort}
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
          onClear={clearAll}
        />

        <div className="drill-lib-cards">
          {rows.length === 0 ? (
            <EmptyState onClear={clearAll} />
          ) : (
            <div className="drill-card-grid">
              {rows.map((d) => (
                <DrillCard key={d.id} d={d} showTeam={showTeam} />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .drill-lib { display: flex; flex-direction: column; gap: 16px; }
        .drill-lib-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (min-width: 900px) {
          .drill-lib-grid {
            grid-template-columns: 200px minmax(0, 1fr);
          }
        }
        .drill-card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 700px) {
          .drill-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1240px) {
          .drill-card-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .drill-card { transition: background 120ms ease, border-color 120ms ease; }
        .drill-card:hover {
          background: color-mix(in srgb, var(--phase) 5%, var(--uff-surface-raised, transparent));
        }
      `}</style>
    </div>
  );
}

// ── Toolbar — search + sort + showing/total count ──────────────────────
function DrillsToolbar({
  search,
  setSearch,
  searchRef,
  total,
  showing,
  sortKey,
  sortDir,
  onSelectSort,
}: {
  search: string;
  setSearch: (v: string) => void;
  searchRef: React.MutableRefObject<HTMLInputElement | null>;
  total: number;
  showing: number;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSelectSort: (k: SortKey) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 240,
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
      <SortMenu sortKey={sortKey} sortDir={sortDir} onSelect={onSelectSort} />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--uff-text-mute)",
          letterSpacing: ".04em",
        }}
      >
        {showing} / {total}
      </span>
    </div>
  );
}

// ── Sort menu — card-grid replacement for the table's column-head sort ──
function SortMenu({
  sortKey,
  sortDir,
  onSelect,
}: {
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSelect: (k: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const activeLabel =
    SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Sort";

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          height: 40,
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "0 12px",
          background: "var(--uff-surface)",
          border: "1px solid var(--uff-line-soft)",
          borderRadius: 10,
          color: "var(--uff-text-dim)",
          fontFamily: "inherit",
          fontSize: 12.5,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--uff-text-mute)" }}
        >
          <path d="M3 6h13M3 12h9M3 18h5" />
          <path d="M18 9l3 3-3 3" />
        </svg>
        <span style={{ color: "var(--uff-text)" }}>{activeLabel}</span>
        <span
          style={{
            fontSize: 11,
            color: "var(--uff-text-mute)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: 46,
            right: 0,
            zIndex: 30,
            minWidth: 200,
            background: "var(--uff-surface-raised, var(--uff-surface))",
            border: "1px solid var(--uff-line)",
            borderRadius: 10,
            padding: 5,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          }}
        >
          {SORT_OPTIONS.map((o) => {
            const active = o.key === sortKey;
            return (
              <button
                key={o.key}
                type="button"
                role="menuitem"
                onClick={() => onSelect(o.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  width: "100%",
                  padding: "7px 9px",
                  borderRadius: 6,
                  background: active ? "rgba(255,106,26,0.10)" : "transparent",
                  border: 0,
                  color: active ? "var(--uff-orange)" : "var(--uff-text-dim)",
                  fontFamily: "inherit",
                  fontSize: 12.5,
                  fontWeight: active ? 600 : 500,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span>{o.label}</span>
                {active && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    {sortDir === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
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

// ── Helpers ────────────────────────────────────────────────────────────

// Subline beneath the drill name, mirroring the preset card: category/phase
// · duration · reps. Missing parts are dropped so brand-new drills don't
// show stray separators.
function metaLine(catLabel: string | null, d: DrillRow): string {
  const parts: string[] = [];
  if (catLabel) parts.push(catLabel);
  if (d.duration) parts.push(`${d.duration}m`);
  if (d.reps) parts.push(`${d.reps} reps`);
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

function TeamChip({ team }: { team: { name: string; color: string } }) {
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

// ── Drill card ─────────────────────────────────────────────────────────
// Mirrors the preset library card so the team library and the preset
// library read as one product: w-card with a phase-colored left border,
// title + category/duration/reps subline, a description, named skill chips,
// and a bottom meta row. The bottom row carries the team-drill payload that
// presets don't have — benchmark types on the left, latest result + trend
// on the right (presets put their clone action there instead).
function DrillCard({ d, showTeam }: { d: DrillRow; showTeam: boolean }) {
  const phase = rowPhase(d.cats);
  const primary = d.primaryType ? BENCH_BY_ID[d.primaryType] : null;
  // Category label for the subline — the phase if tagged, else the first
  // category, mirroring the single category_type on the preset card.
  const catSlug = phase.missing ? d.cats[0] ?? null : phase.slug;
  const catLabel = catSlug ? WEB_CAT_DEFS[catSlug]?.label ?? null : null;
  const sub = metaLine(catLabel, d);

  return (
    <Link
      href={`/drills/${d.id}`}
      className="w-card drill-card"
      style={
        {
          padding: "14px 14px 12px",
          borderLeft: `3px solid ${phase.missing ? "var(--uff-line)" : phase.color}`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 220,
          textDecoration: "none",
          color: "inherit",
          ["--phase" as string]: phase.missing ? "var(--uff-text)" : phase.color,
        } as React.CSSProperties
      }
    >
      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--uff-text)",
                letterSpacing: "-0.01em",
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {d.name}
            </span>
            {d.pinned && (
              <span
                title="Pinned to dashboard"
                style={{ color: "var(--uff-orange)", flexShrink: 0 }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 4l6 6-4 1-3 6-2-2-5 5-1-1 5-5-2-2 6-3z" />
                </svg>
              </span>
            )}
          </div>
          {sub && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--uff-text-mute)",
                marginTop: 3,
                letterSpacing: ".04em",
                textTransform: "uppercase",
              }}
            >
              {sub}
            </div>
          )}
        </div>
        {/* Status pill top-right — only when not published, to keep the
            common case clean (mirrors the table treatment). */}
        {d.status !== "published" && (
          <span style={{ flexShrink: 0 }}>
            <StatusPill status={d.status} />
          </span>
        )}
      </div>

      {/* Description — 3-line clamp, matching the preset card. */}
      {d.description && (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--uff-text-dim)",
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {d.description}
        </div>
      )}

      {/* Named skill chips — primaries highlighted, secondaries muted. */}
      {d.skills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {d.skills.map((s) => (
            <SkillChip key={s.id} skill={s} />
          ))}
        </div>
      )}

      {/* Bottom meta row — benchmark types (+ team chip) left, latest result
          + trend right. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: "auto",
          paddingTop: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
          <BenchChipStack types={d.types} max={3} mini />
          {showTeam && <TeamChip team={d.team} />}
        </div>
        {d.lastResult != null && primary && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {d.samples.length >= 2 && (
              <Spark data={d.samples} color={primary.accent} w={42} h={16} />
            )}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--uff-text)",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
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
            {d.samples.length >= 2 && (
              <TrendChip delta={d.trend} better={primary.better} mini />
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Empty state ───────────────────────────────────────────────────────
function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div
      className="w-card"
      style={{
        padding: 32,
        textAlign: "center",
        color: "var(--uff-text-mute)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: 14, color: "var(--uff-text-dim)" }}>
        No drills match the current filters.
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <button
          type="button"
          onClick={onClear}
          style={{
            background: "transparent",
            border: 0,
            color: "var(--uff-orange)",
            fontFamily: "inherit",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Clear filters
        </button>
        <Link
          href="/drills/new"
          style={{
            color: "var(--uff-orange)",
            textDecoration: "none",
            fontSize: 12,
          }}
        >
          Create a new drill →
        </Link>
      </div>
    </div>
  );
}
