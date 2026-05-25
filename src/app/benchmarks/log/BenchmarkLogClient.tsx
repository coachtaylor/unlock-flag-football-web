"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Drill = {
  id: string;
  name: string;
  benchmarkType: "timed" | "rated";
};

type Player = {
  id: string;
  name: string;
  positions: string[];
};

type PlayerResult = {
  timeSeconds: string;
  rating: number | null;
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

function emptyResult(): PlayerResult {
  return {
    timeSeconds: "",
    rating: null,
    tags: new Set(),
    notes: "",
  };
}

function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function BenchmarkLogClient({
  teamId,
  userId,
  drill,
  players,
}: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<PlayerResult[]>(() =>
    players.map(() => emptyResult())
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showNotes, setShowNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentPlayer = players[index];
  const currentResult = results[index];
  const isLast = index === players.length - 1;

  function updateCurrent(patch: Partial<PlayerResult>) {
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
    updateCurrent({ tags: next });
  }

  async function saveCurrent(): Promise<boolean> {
    setError(null);

    const payload: Record<string, unknown> = {
      team_id: teamId,
      drill_id: drill.id,
      player_id: currentPlayer.id,
      assessed_by: userId,
      assessment_date: todayString(),
      tags: Array.from(currentResult.tags),
      notes: currentResult.notes.trim() || null,
      time_seconds: null,
      rating: null,
    };

    if (drill.benchmarkType === "timed") {
      const trimmed = currentResult.timeSeconds.trim();
      if (!trimmed) {
        setError("Enter a time before continuing.");
        return false;
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Time must be a positive number.");
        return false;
      }
      payload.time_seconds = parsed;
    } else {
      if (!currentResult.rating) {
        setError("Pick a rating before continuing.");
        return false;
      }
      payload.rating = currentResult.rating;
    }

    setSubmitting(true);

    if (savedIds.has(currentPlayer.id)) {
      // Update the existing row (they came back via Previous and are advancing again)
      const { error: updateErr } = await supabase
        .from("benchmark_results")
        .update(payload)
        .eq("team_id", teamId)
        .eq("drill_id", drill.id)
        .eq("player_id", currentPlayer.id)
        .eq("assessment_date", payload.assessment_date as string)
        .eq("assessed_by", userId);
      if (updateErr) {
        setError(updateErr.message);
        setSubmitting(false);
        return false;
      }
    } else {
      const { error: insertErr } = await supabase
        .from("benchmark_results")
        .insert(payload);
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
    }

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
    <div className="pt-3xl pb-2xl">
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

      {/* Result input */}
      <div className="mt-3xl">
        {drill.benchmarkType === "timed" ? (
          <div>
            <p
              className="label-micro"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Time (seconds)
            </p>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={currentResult.timeSeconds}
              onChange={(e) => updateCurrent({ timeSeconds: e.target.value })}
              className="w-full mt-md rounded-lg text-display font-medium tabular-nums text-center"
              style={{
                backgroundColor: "var(--color-surface-raised)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
                padding: "20px 16px",
                outline: "none",
              }}
            />
          </div>
        ) : (
          <div>
            <p
              className="label-micro"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Rating
            </p>
            <div className="flex items-center justify-between gap-sm mt-md">
              {[1, 2, 3, 4, 5].map((r) => {
                const selected = currentResult.rating === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => updateCurrent({ rating: r })}
                    aria-pressed={selected}
                    className="text-heading font-medium tabular-nums transition-all"
                    style={{
                      flex: 1,
                      height: "56px",
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
              className="text-caption mt-md text-center"
              style={{
                color: currentResult.rating
                  ? "var(--color-text-primary)"
                  : "var(--color-text-muted)",
                minHeight: "20px",
              }}
            >
              {currentResult.rating
                ? RATING_ANCHORS[currentResult.rating]
                : "Tap a rating to see the anchor"}
            </p>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="mt-3xl">
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
              onChange={(e) => updateCurrent({ notes: e.target.value })}
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
