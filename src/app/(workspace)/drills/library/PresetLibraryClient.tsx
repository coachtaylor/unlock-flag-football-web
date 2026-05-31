"use client";

// Preset drill library — browse + clone. Mirrors the DrillsLibraryClient
// layout: sticky filter rail on desktop (md+), full-width card grid on
// mobile with filter chips collapsed into the toolbar.

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  PresetDrillWithSkills,
  Skill,
  SkillGroup,
  TaggedSkill,
} from "@/lib/types/skills";
import { clonePresetDrill, removeClonedDrill } from "./actions";

// ── Constants ─────────────────────────────────────────────────────────

const SKILL_GROUPS: { id: SkillGroup; label: string; color: string }[] = [
  { id: "athletic", label: "Athletic",    color: "var(--uff-lime)" },
  { id: "offense",  label: "Offense",     color: "var(--uff-orange)" },
  { id: "qb",       label: "QB",          color: "#6EA8FF" },
  { id: "defense",  label: "Defense",     color: "#B89BFF" },
  { id: "iq",       label: "Football IQ", color: "#FFB347" },
];

const FORMATS = ["5v5", "7v7"] as const;
type Format = (typeof FORMATS)[number];

// Position vocabulary kept inline rather than imported from positions.ts
// because the preset library filters against `primary_for_positions[]`
// strings, which are intentionally human-typed in the seed (QB, WR, RB,
// Center, DB, Safety, Rusher). The full positions.ts catalog has more
// granularity than the seed uses today.
const POSITION_FILTERS = [
  "QB",
  "WR",
  "RB",
  "Center",
  "DB",
  "Safety",
  "Rusher",
] as const;
type PositionFilter = (typeof POSITION_FILTERS)[number];

// ── Component ─────────────────────────────────────────────────────────

export default function PresetLibraryClient({
  presets,
  skills,
  teamId,
}: {
  presets: PresetDrillWithSkills[];
  skills: Skill[];
  teamId: string;
}) {
  void skills; // reserved for future skill-name filter chip; keeps the
  //           server data shape stable when we add it without an
  //           import-churn commit.

  const router = useRouter();

  const [search, setSearch] = useState("");
  const [activeGroups, setActiveGroups] = useState<Set<SkillGroup>>(new Set());
  const [activeFormats, setActiveFormats] = useState<Set<Format>>(new Set());
  const [activePositions, setActivePositions] = useState<Set<PositionFilter>>(
    new Set(),
  );
  const [hideCloned, setHideCloned] = useState(false);

  // "/" focuses search unless already in an input.
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
    let xs = presets.slice();
    const q = search.trim().toLowerCase();
    if (q) {
      xs = xs.filter(
        (p) =>
          p.drill_name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      );
    }
    if (activeGroups.size > 0) {
      xs = xs.filter((p) =>
        p.skills.some((s) => activeGroups.has(s.skill_group)),
      );
    }
    if (activeFormats.size > 0) {
      xs = xs.filter((p) => p.formats.some((f) => activeFormats.has(f as Format)));
    }
    if (activePositions.size > 0) {
      xs = xs.filter((p) => {
        // Empty primary_for_positions means "all positions" — those drills
        // always pass the position filter.
        if (p.primary_for_positions.length === 0) return true;
        return p.primary_for_positions.some((pos) =>
          activePositions.has(pos as PositionFilter),
        );
      });
    }
    if (hideCloned) {
      xs = xs.filter((p) => !p.alreadyCloned);
    }
    return xs;
  }, [presets, search, activeGroups, activeFormats, activePositions, hideCloned]);

  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  }

  const clearAll = () => {
    setActiveGroups(new Set());
    setActiveFormats(new Set());
    setActivePositions(new Set());
    setHideCloned(false);
  };

  return (
    <div className="preset-lib">
      <Toolbar
        search={search}
        setSearch={setSearch}
        searchRef={searchRef}
        total={presets.length}
        showing={rows.length}
      />

      <div className="preset-lib-grid">
        <FilterRail
          presets={presets}
          activeGroups={activeGroups}
          onToggleGroup={(v) => toggle(activeGroups, v, setActiveGroups)}
          activeFormats={activeFormats}
          onToggleFormat={(v) => toggle(activeFormats, v, setActiveFormats)}
          activePositions={activePositions}
          onTogglePosition={(v) => toggle(activePositions, v, setActivePositions)}
          hideCloned={hideCloned}
          setHideCloned={setHideCloned}
          onClear={clearAll}
        />

        <div className="preset-lib-cards">
          {rows.length === 0 ? (
            <EmptyState onClear={clearAll} />
          ) : (
            <div className="preset-card-grid">
              {rows.map((p) => (
                <PresetCard
                  key={p.id}
                  preset={p}
                  teamId={teamId}
                  onCloned={(drillId) => router.push(`/drills/${drillId}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .preset-lib { display: flex; flex-direction: column; gap: 16px; }
        .preset-lib-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (min-width: 900px) {
          .preset-lib-grid {
            grid-template-columns: 200px minmax(0, 1fr);
          }
        }
        .preset-card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 700px) {
          .preset-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1240px) {
          .preset-card-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────

function Toolbar({
  search,
  setSearch,
  searchRef,
  total,
  showing,
}: {
  search: string;
  setSearch: (v: string) => void;
  searchRef: React.MutableRefObject<HTMLInputElement | null>;
  total: number;
  showing: number;
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
          placeholder="Search presets by name or description…"
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

// ── Filter rail ───────────────────────────────────────────────────────

function FilterRail({
  presets,
  activeGroups,
  onToggleGroup,
  activeFormats,
  onToggleFormat,
  activePositions,
  onTogglePosition,
  hideCloned,
  setHideCloned,
  onClear,
}: {
  presets: PresetDrillWithSkills[];
  activeGroups: Set<SkillGroup>;
  onToggleGroup: (v: SkillGroup) => void;
  activeFormats: Set<Format>;
  onToggleFormat: (v: Format) => void;
  activePositions: Set<PositionFilter>;
  onTogglePosition: (v: PositionFilter) => void;
  hideCloned: boolean;
  setHideCloned: (v: boolean) => void;
  onClear: () => void;
}) {
  const countByGroup = useMemo(() => {
    const out: Partial<Record<SkillGroup, number>> = {};
    presets.forEach((p) => {
      const groups = new Set(p.skills.map((s) => s.skill_group));
      groups.forEach((g) => {
        out[g] = (out[g] ?? 0) + 1;
      });
    });
    return out;
  }, [presets]);

  const countByFormat = useMemo(() => {
    const out: Partial<Record<Format, number>> = {};
    presets.forEach((p) => {
      p.formats.forEach((f) => {
        const fmt = f as Format;
        out[fmt] = (out[fmt] ?? 0) + 1;
      });
    });
    return out;
  }, [presets]);

  const countByPosition = useMemo(() => {
    const out: Partial<Record<PositionFilter, number>> = {};
    presets.forEach((p) => {
      // A preset with empty primary_for_positions[] counts toward EVERY
      // position filter (it's universally applicable). Coaches expect
      // "filter to QB" to also show drills that work for QBs even when
      // they aren't QB-exclusive.
      const positions =
        p.primary_for_positions.length === 0
          ? POSITION_FILTERS
          : (p.primary_for_positions.filter((pos) =>
              (POSITION_FILTERS as readonly string[]).includes(pos),
            ) as readonly PositionFilter[]);
      positions.forEach((pos) => {
        out[pos] = (out[pos] ?? 0) + 1;
      });
    });
    return out;
  }, [presets]);

  const clonedCount = useMemo(
    () => presets.filter((p) => p.alreadyCloned).length,
    [presets],
  );

  return (
    <aside
      className="preset-filter-rail"
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

      <FilterGroup label="Skill group">
        {SKILL_GROUPS.map((g) => (
          <FilterRow
            key={g.id}
            on={activeGroups.has(g.id)}
            onClick={() => onToggleGroup(g.id)}
            label={g.label}
            swatch={g.color}
            count={countByGroup[g.id] ?? 0}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Format">
        {FORMATS.map((f) => (
          <FilterRow
            key={f}
            on={activeFormats.has(f)}
            onClick={() => onToggleFormat(f)}
            label={f}
            count={countByFormat[f] ?? 0}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Position">
        {POSITION_FILTERS.map((p) => (
          <FilterRow
            key={p}
            on={activePositions.has(p)}
            onClick={() => onTogglePosition(p)}
            label={p}
            count={countByPosition[p] ?? 0}
          />
        ))}
      </FilterGroup>

      {clonedCount > 0 && (
        <FilterGroup label="Library status">
          <FilterRow
            on={hideCloned}
            onClick={() => setHideCloned(!hideCloned)}
            label="Hide already added"
            count={clonedCount}
          />
        </FilterGroup>
      )}

      <style>{`
        .preset-filter-rail { display: none; }
        @media (min-width: 900px) {
          .preset-filter-rail { display: flex; }
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
  count,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  swatch?: string;
  count?: number;
}) {
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

// ── Preset card ───────────────────────────────────────────────────────

function PresetCard({
  preset,
  teamId,
  onCloned,
}: {
  preset: PresetDrillWithSkills;
  teamId: string;
  onCloned: (drillId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Remove-clone flow (only relevant once cloned). Separate transition from
  // the clone so the two buttons' pending states don't interfere.
  const [removing, startRemoveTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const primaryGroup = preset.skills[0]?.skill_group ?? null;
  const groupColor = primaryGroup
    ? SKILL_GROUPS.find((g) => g.id === primaryGroup)?.color ?? "var(--uff-line)"
    : "var(--uff-line)";

  function handleClone() {
    setError(null);
    startTransition(async () => {
      const result = await clonePresetDrill(preset.id, teamId);
      if (result.ok) onCloned(result.drillId);
      else setError(result.error);
    });
  }

  function handleRemove() {
    if (!preset.clonedDrillId) return;
    setRemoveError(null);
    startRemoveTransition(async () => {
      const result = await removeClonedDrill(preset.clonedDrillId!);
      // On success the server action revalidates /drills/library, so the
      // refreshed props flip this card back to "Add to team".
      if (result.ok) setConfirmOpen(false);
      else setRemoveError(result.error);
    });
  }

  return (
    <div
      className="w-card"
      style={{
        padding: "14px 14px 12px",
        borderLeft: `3px solid ${groupColor}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 220,
      }}
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
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--uff-text)",
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            {preset.drill_name}
          </div>
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
            {preset.category_type}
            {preset.default_duration_min ? ` · ${preset.default_duration_min}m` : ""}
            {preset.default_reps ? ` · ${preset.default_reps} reps` : ""}
          </div>
        </div>
        {/* No benchmark badge — benchmark designation is a captain opt-in after
            cloning (see clone_preset_drill_to_team), not a property of presets.
            Top-right trash removes the team's clone; only shown once cloned. */}
        {preset.alreadyCloned && preset.clonedDrillId && (
          <button
            type="button"
            onClick={() => {
              setRemoveError(null);
              setConfirmOpen(true);
            }}
            title="Remove from library"
            aria-label="Remove from library"
            style={{
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "transparent",
              border: 0,
              color: "var(--uff-red)",
              cursor: "pointer",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        )}
      </div>

      {/* Description */}
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
        {preset.description}
      </div>

      {/* Skill chips — primaries highlighted, secondaries muted */}
      {preset.skills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {preset.skills.map((s) => (
            <SkillChip key={s.id} skill={s} />
          ))}
        </div>
      )}

      {/* Meta row — formats + positions + action */}
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
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", minWidth: 0 }}>
          {preset.formats.map((f) => (
            <MetaPill key={f} label={f} />
          ))}
          {preset.primary_for_positions.length > 0 ? (
            preset.primary_for_positions.map((p) => (
              <MetaPill key={p} label={p} dim />
            ))
          ) : (
            <MetaPill label="all positions" dim />
          )}
        </div>
        <CloneButton
          preset={preset}
          isPending={isPending}
          onClick={handleClone}
        />
      </div>

      {error && (
        <div
          style={{
            fontSize: 11,
            color: "#FF6B6B",
            marginTop: 4,
            fontFamily: "var(--font-mono)",
          }}
        >
          {error}
        </div>
      )}

      {confirmOpen && (
        <RemoveConfirm
          drillName={preset.drill_name}
          removing={removing}
          error={removeError}
          onCancel={() => {
            if (!removing) setConfirmOpen(false);
          }}
          onConfirm={handleRemove}
        />
      )}
    </div>
  );
}

// Centered confirm overlay for removing a cloned preset. Mirrors the mobile
// ConfirmDialog: scrim, card, destructive red confirm. The global preset is
// never deleted — only the team's copy.
function RemoveConfirm({
  drillName,
  removing,
  error,
  onCancel,
  onConfirm,
}: {
  drillName: string;
  removing: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-card"
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--uff-text)" }}>
          Remove from library?
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--uff-text-dim)" }}>
          &quot;{drillName}&quot; will be removed from your team library. The
          preset stays available to add again.
        </div>
        {error && (
          <div
            style={{
              fontSize: 12,
              color: "var(--uff-red)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={removing}
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--uff-line)",
              color: "var(--uff-text-dim)",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: removing ? "default" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={removing}
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: 8,
              background: removing ? "var(--uff-text-mute)" : "var(--uff-red)",
              border: 0,
              color: "#0a0a0d",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: removing ? "wait" : "pointer",
            }}
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillChip({ skill }: { skill: TaggedSkill }) {
  const isPrimary = skill.weight === 1.0;
  const group = SKILL_GROUPS.find((g) => g.id === skill.skill_group);
  const color = group?.color ?? "var(--uff-text-mute)";
  return (
    <span
      title={`${skill.skill_name}${isPrimary ? " · primary" : " · secondary"}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: 10.5,
        fontWeight: isPrimary ? 600 : 500,
        fontFamily: "inherit",
        letterSpacing: ".01em",
        background: isPrimary
          ? `color-mix(in srgb, ${color} 16%, transparent)`
          : "rgba(255,255,255,0.03)",
        color: isPrimary ? "var(--uff-text)" : "var(--uff-text-mute)",
        border: isPrimary
          ? `1px solid color-mix(in srgb, ${color} 40%, transparent)`
          : "1px solid var(--uff-line-soft)",
        lineHeight: 1.4,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          opacity: isPrimary ? 1 : 0.6,
        }}
      />
      {skill.skill_name}
    </span>
  );
}

function MetaPill({ label, dim }: { label: string; dim?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 6px",
        borderRadius: 4,
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--uff-line-soft)",
        color: dim ? "var(--uff-text-mute)" : "var(--uff-text-dim)",
        lineHeight: 1.5,
      }}
    >
      {label}
    </span>
  );
}

function CloneButton({
  preset,
  isPending,
  onClick,
}: {
  preset: PresetDrillWithSkills;
  isPending: boolean;
  onClick: () => void;
}) {
  if (preset.alreadyCloned && preset.clonedDrillId) {
    return (
      <Link
        href={`/drills/${preset.clonedDrillId}`}
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--uff-lime)",
          textDecoration: "none",
          padding: "6px 10px",
          border: "1px solid color-mix(in srgb, var(--uff-lime) 35%, transparent)",
          borderRadius: 6,
          background: "transparent",
          whiteSpace: "nowrap",
        }}
      >
        In library →
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: "#0a0a0d",
        background: isPending ? "var(--uff-text-mute)" : "var(--uff-orange)",
        border: 0,
        borderRadius: 6,
        padding: "6px 12px",
        cursor: isPending ? "wait" : "pointer",
        fontFamily: "inherit",
        letterSpacing: ".02em",
        whiteSpace: "nowrap",
      }}
    >
      {isPending ? "Adding…" : "+ Add to team"}
    </button>
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
        No presets match the current filters.
      </div>
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
    </div>
  );
}
