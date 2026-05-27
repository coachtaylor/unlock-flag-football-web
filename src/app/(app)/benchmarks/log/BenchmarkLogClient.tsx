"use client";

// Multi-type benchmark capture. A drill can declare any combination of
// six types (timed / rated / reps / pct / flags / drops). For each player
// we render every supported type as its own widget on the same screen
// (per spec §6 risk mitigation: "per-set capture all-types-on-one-screen
// rather than sequencing them"). Save inserts one benchmark_results row
// per (player, type) for the current assessment date.

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  BENCH_BY_ID,
  type BenchKind,
} from "@/components/uff-web/drills/atoms";

// `target` is captured at drill-design time and shown on the widget as
// a hint. `better` overrides the type-default (drops defaults lower; pct
// can be either depending on what's being measured).
export type BenchConfigEntry = {
  target?: string;
  better?: "lower" | "higher";
};

type BenchConfig = Partial<Record<BenchKind, BenchConfigEntry>>;

type Drill = {
  id: string;
  name: string;
  types: BenchKind[];
  config: BenchConfig;
};

type Player = {
  id: string;
  name: string;
  positions: string[];
};

// One PerTypeValue lives per (player, type). The wire format depends on
// the type — only the fields the type uses are populated; the rest are
// ignored. Strings are used for numeric inputs so partial entry ("3.")
// doesn't get clobbered into 3.
type PerTypeValue = {
  // timed → seconds (numeric string)
  timeSeconds: string;
  // rated → 1-5
  rating: number | null;
  // reps / flags / drops → single count
  count: string;
  // pct → made / attempts
  made: string;
  attempts: string;
};

type PlayerResult = {
  perType: Record<BenchKind, PerTypeValue>;
  tags: Set<string>;
  notes: string;
};

type Props = {
  teamId: string;
  userId: string;
  drill: Drill;
  players: Player[];
};

const QUICK_TAGS = [
  "Good hands",
  "Quick feet",
  "Needs footwork help",
  "Sharp routes",
  "Slow reaction",
  "Strong arm",
  "Good vision",
];

const RATING_ANCHORS: Record<number, string> = {
  1: "Can't execute",
  2: "Struggles, needs significant work",
  3: "Gets it done but inconsistent",
  4: "Solid, minor refinements needed",
  5: "Reliable under pressure",
};

function emptyPerType(): PerTypeValue {
  return {
    timeSeconds: "",
    rating: null,
    count: "",
    made: "",
    attempts: "",
  };
}

function emptyResult(types: BenchKind[]): PlayerResult {
  const perType = {} as Record<BenchKind, PerTypeValue>;
  for (const t of types) perType[t] = emptyPerType();
  return { perType, tags: new Set(), notes: "" };
}

function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Resolve the lower-is-better flag for a given type. `drops` defaults
// inverse; `timed` is captured separately on the row (the column is
// numeric, not inverted), so for column purposes only drops + opted-in
// flags/pct rows store inverse=true.
function effectiveInverse(type: BenchKind, cfg?: BenchConfigEntry): boolean {
  if (cfg?.better === "lower") return true;
  if (cfg?.better === "higher") return false;
  return type === "drops";
}

// ── Widgets ────────────────────────────────────────────────────────────

function NumberField({
  label,
  unit,
  value,
  onChange,
  placeholder = "0",
  step = "1",
  inputMode = "numeric",
  target,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  step?: string;
  inputMode?: "numeric" | "decimal";
  target?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {label}{" "}
          <span style={{ color: "var(--color-text-muted)" }}>({unit})</span>
        </p>
        {target ? (
          <p
            className="text-caption"
            style={{ color: "var(--color-text-muted)" }}
          >
            Target {target}
            {unit !== "/5" ? unit : ""}
          </p>
        ) : null}
      </div>
      <input
        type="number"
        inputMode={inputMode}
        step={step}
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-sm rounded-lg text-heading font-medium tabular-nums text-center"
        style={{
          backgroundColor: "var(--color-surface-raised)",
          color: "var(--color-text-primary)",
          border: "1px solid var(--color-border-default)",
          padding: "14px 12px",
          outline: "none",
        }}
      />
    </div>
  );
}

function RatingButtons({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <p
        className="label-micro"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Rating
      </p>
      <div className="flex items-center justify-between gap-sm mt-sm">
        {[1, 2, 3, 4, 5].map((r) => {
          const selected = value === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onChange(r)}
              aria-pressed={selected}
              className="text-heading font-medium tabular-nums transition-all"
              style={{
                flex: 1,
                height: "48px",
                borderRadius: "9999px",
                backgroundColor: selected
                  ? "var(--color-orange-500)"
                  : "var(--color-surface-raised)",
                color: selected ? "#FFFFFF" : "var(--color-text-secondary)",
                border: selected
                  ? "1px solid var(--color-orange-500)"
                  : "1px solid var(--color-border-subtle)",
              }}
            >
              {r}
            </button>
          );
        })}
      </div>
      <p
        className="text-caption mt-sm text-center"
        style={{
          color: value ? "var(--color-text-primary)" : "var(--color-text-muted)",
          minHeight: "18px",
        }}
      >
        {value ? RATING_ANCHORS[value] : "Tap a rating to see the anchor"}
      </p>
    </div>
  );
}

function PctField({
  made,
  attempts,
  onChange,
}: {
  made: string;
  attempts: string;
  onChange: (patch: { made?: string; attempts?: string }) => void;
}) {
  return (
    <div>
      <p
        className="label-micro"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Made ÷ Attempts
      </p>
      <div className="flex items-center gap-sm mt-sm">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          placeholder="Made"
          value={made}
          onChange={(e) => onChange({ made: e.target.value })}
          aria-label="Made"
          className="rounded-lg text-heading font-medium tabular-nums text-center"
          style={{
            flex: 1,
            backgroundColor: "var(--color-surface-raised)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-default)",
            padding: "14px 12px",
            outline: "none",
          }}
        />
        <span
          className="text-heading"
          style={{ color: "var(--color-text-muted)" }}
        >
          /
        </span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          placeholder="Attempts"
          value={attempts}
          onChange={(e) => onChange({ attempts: e.target.value })}
          aria-label="Attempts"
          className="rounded-lg text-heading font-medium tabular-nums text-center"
          style={{
            flex: 1,
            backgroundColor: "var(--color-surface-raised)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-default)",
            padding: "14px 12px",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

// ── Per-type card wrapper ──────────────────────────────────────────────

function TypeCard({
  kind,
  config,
  value,
  onChange,
}: {
  kind: BenchKind;
  config?: BenchConfigEntry;
  value: PerTypeValue;
  onChange: (patch: Partial<PerTypeValue>) => void;
}) {
  const meta = BENCH_BY_ID[kind];
  const target = config?.target;

  return (
    <div
      className="rounded-lg"
      style={{
        backgroundColor: "var(--color-surface-base)",
        border: "1px solid var(--color-border-subtle)",
        padding: "16px",
      }}
    >
      <div className="flex items-center justify-between mb-md">
        <span
          className="label-micro rounded-pill"
          style={{
            padding: "2px 10px",
            backgroundColor: meta.tint,
            color: meta.accent,
            border: `1px solid ${meta.border}`,
          }}
        >
          {meta.label}
        </span>
        <span
          className="text-caption"
          style={{ color: "var(--color-text-muted)" }}
        >
          {meta.better === "lower" ? "Lower is better" : "Higher is better"}
        </span>
      </div>

      {kind === "timed" ? (
        <NumberField
          label="Time"
          unit="s"
          value={value.timeSeconds}
          onChange={(v) => onChange({ timeSeconds: v })}
          placeholder="0.00"
          step="0.01"
          inputMode="decimal"
          target={target}
        />
      ) : kind === "rated" ? (
        <RatingButtons
          value={value.rating}
          onChange={(r) => onChange({ rating: r })}
        />
      ) : kind === "pct" ? (
        <PctField
          made={value.made}
          attempts={value.attempts}
          onChange={(p) => onChange(p)}
        />
      ) : (
        <NumberField
          label={meta.label}
          unit={meta.unit}
          value={value.count}
          onChange={(v) => onChange({ count: v })}
          target={target}
        />
      )}
    </div>
  );
}

// ── Main client ────────────────────────────────────────────────────────

export default function BenchmarkLogClient({
  teamId,
  userId,
  drill,
  players,
}: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<PlayerResult[]>(() =>
    players.map(() => emptyResult(drill.types))
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showNotes, setShowNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentPlayer = players[index];
  const currentResult = results[index];
  const isLast = index === players.length - 1;

  const assessmentDate = useMemo(todayString, []);

  function updatePerType(kind: BenchKind, patch: Partial<PerTypeValue>) {
    setResults((prev) => {
      const next = [...prev];
      const r = { ...next[index] };
      r.perType = {
        ...r.perType,
        [kind]: { ...r.perType[kind], ...patch },
      };
      next[index] = r;
      return next;
    });
  }

  function updateShared(patch: Partial<Pick<PlayerResult, "tags" | "notes">>) {
    setResults((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function toggleTag(tag: string) {
    const next = new Set(currentResult.tags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    updateShared({ tags: next });
  }

  // Per-type validation + payload builder. Returns one row per type with
  // the right column populated, or an error string if any required type
  // is missing input.
  function buildPayloads(): { rows: Record<string, unknown>[] } | { errorType: string } {
    const rows: Record<string, unknown>[] = [];
    const sharedTags = Array.from(currentResult.tags);
    const sharedNotes = currentResult.notes.trim() || null;

    for (const kind of drill.types) {
      const v = currentResult.perType[kind];
      const cfg = drill.config[kind];
      const inverse = effectiveInverse(kind, cfg);

      const base: Record<string, unknown> = {
        team_id: teamId,
        drill_id: drill.id,
        player_id: currentPlayer.id,
        assessed_by: userId,
        assessment_date: assessmentDate,
        tags: sharedTags,
        notes: sharedNotes,
        benchmark_type: kind,
        set_number: 1,
        inverse,
        captured_on: "desktop",
        time_seconds: null,
        rating: null,
        made_count: null,
        attempts_count: null,
      };

      if (kind === "timed") {
        const trimmed = v.timeSeconds.trim();
        if (!trimmed) return { errorType: "Time" };
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || parsed < 0) return { errorType: "Time" };
        base.time_seconds = parsed;
      } else if (kind === "rated") {
        if (!v.rating) return { errorType: "Rating" };
        base.rating = v.rating;
      } else if (kind === "pct") {
        const m = Number(v.made.trim());
        const a = Number(v.attempts.trim());
        if (
          !v.made.trim() ||
          !v.attempts.trim() ||
          !Number.isFinite(m) ||
          !Number.isFinite(a) ||
          m < 0 ||
          a <= 0 ||
          m > a
        ) {
          return { errorType: "Made ÷ Attempts" };
        }
        base.made_count = Math.floor(m);
        base.attempts_count = Math.floor(a);
      } else {
        // reps / flags / drops — single integer count
        const trimmed = v.count.trim();
        if (!trimmed) return { errorType: BENCH_BY_ID[kind].label };
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || parsed < 0)
          return { errorType: BENCH_BY_ID[kind].label };
        base.made_count = Math.floor(parsed);
      }

      rows.push(base);
    }

    return { rows };
  }

  async function saveCurrent(): Promise<boolean> {
    setError(null);
    const result = buildPayloads();
    if ("errorType" in result) {
      setError(`Enter a value for ${result.errorType} before continuing.`);
      return false;
    }

    setSubmitting(true);

    // Re-runs (player came back via Previous): wipe today's rows for this
    // (player, drill, assessor) and re-insert. Simpler than per-row upsert
    // and matches the existing single-type behavior.
    if (savedIds.has(currentPlayer.id)) {
      const { error: delErr } = await supabase
        .from("benchmark_results")
        .delete()
        .eq("team_id", teamId)
        .eq("drill_id", drill.id)
        .eq("player_id", currentPlayer.id)
        .eq("assessed_by", userId)
        .eq("assessment_date", assessmentDate);
      if (delErr) {
        setError(delErr.message);
        setSubmitting(false);
        return false;
      }
    }

    const { error: insertErr } = await supabase
      .from("benchmark_results")
      .insert(result.rows);
    if (insertErr) {
      setError(insertErr.message);
      setSubmitting(false);
      return false;
    }

    setSavedIds((prev) => {
      const next = new Set(prev);
      next.add(currentPlayer.id);
      return next;
    });
    setSubmitting(false);
    return true;
  }

  async function handleNext() {
    const ok = await saveCurrent();
    if (!ok) return;
    if (isLast) {
      router.push(
        `/benchmarks/complete?drill=${drill.id}&count=${players.length}`
      );
      return;
    }
    setIndex((i) => i + 1);
    setShowNotes(false);
  }

  function handlePrevious() {
    if (index === 0) return;
    setIndex((i) => i - 1);
    setShowNotes(false);
    setError(null);
  }

  return (
    <div className="pt-3xl pb-2xl" style={{ maxWidth: 640, margin: "0 auto" }}>
      <p
        className="text-caption"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Player {index + 1} of {players.length} · {drill.name}
      </p>

      <h1
        className="text-title font-medium mt-md"
        style={{ color: "var(--color-text-primary)" }}
      >
        {currentPlayer.name}
      </h1>

      {currentPlayer.positions.length > 0 && (
        <div className="flex items-center gap-xs mt-sm flex-wrap">
          {currentPlayer.positions.map((pos) => (
            <span
              key={pos}
              className="label-micro rounded-pill"
              style={{
                padding: "2px 8px",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {pos}
            </span>
          ))}
        </div>
      )}

      {/* Per-type widgets stacked, one card per type */}
      <div className="mt-2xl flex flex-col gap-md">
        {drill.types.map((kind) => (
          <TypeCard
            key={kind}
            kind={kind}
            config={drill.config[kind]}
            value={currentResult.perType[kind]}
            onChange={(patch) => updatePerType(kind, patch)}
          />
        ))}
      </div>

      {/* Tags */}
      <div className="mt-2xl">
        <p
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Quick tags
        </p>
        <div className="flex flex-wrap gap-sm mt-md">
          {QUICK_TAGS.map((tag) => {
            const selected = currentResult.tags.has(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={selected}
                className="rounded-pill text-caption font-medium transition-all"
                style={{
                  padding: "10px 14px",
                  minHeight: "44px",
                  backgroundColor: selected
                    ? "#5C3308"
                    : "rgba(255,255,255,0.04)",
                  color: selected ? "#F0B870" : "rgba(255,255,255,0.45)",
                  border: selected
                    ? "1px solid #D48A30"
                    : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="mt-2xl">
        {showNotes ? (
          <div>
            <p
              className="label-micro"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Notes
            </p>
            <textarea
              value={currentResult.notes}
              onChange={(e) => updateShared({ notes: e.target.value })}
              placeholder="Additional notes..."
              rows={3}
              className="w-full mt-md rounded-lg text-body"
              style={{
                backgroundColor: "var(--color-surface-raised)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
                padding: "12px",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-caption font-medium"
            style={{
              color: "var(--color-orange-400)",
              minHeight: "44px",
              padding: "0 4px",
            }}
          >
            + Add notes
          </button>
        )}
      </div>

      {error && (
        <p
          className="text-caption mt-xl"
          style={{ color: "var(--color-orange-400)" }}
        >
          {error}
        </p>
      )}

      <div className="mt-3xl">
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="w-full py-lg rounded-xl text-body font-medium tracking-wide"
          style={{
            backgroundColor: "var(--color-orange-500)",
            color: "#FFFFFF",
            letterSpacing: "0.3px",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting
            ? "Saving..."
            : isLast
            ? "Finish Assessment"
            : "Next Player →"}
        </button>

        {index > 0 && (
          <div className="mt-md text-center">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={submitting}
              className="text-caption font-medium"
              style={{
                color: "var(--color-text-secondary)",
                minHeight: "44px",
                padding: "0 8px",
              }}
            >
              ← Previous
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
