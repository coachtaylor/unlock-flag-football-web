"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type PlanDrill = {
  id: string;
  drillId: string;
  drillName: string;
  durationMinutes: number | null;
};

type Props = {
  teamId: string;
  userId: string;
  planId: string;
  practiceDate: string;
  drills: PlanDrill[];
};

const ENERGY_ANCHORS: Record<number, string> = {
  1: "Low energy",
  2: "Sluggish",
  3: "Average",
  4: "Good energy",
  5: "Fired up",
};

export default function PracticeLogClient({
  teamId,
  userId,
  planId,
  practiceDate,
  drills,
}: Props) {
  const router = useRouter();
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    drills.forEach((d) => {
      init[d.drillId] = true;
    });
    return init;
  });
  const [teamPerformanceNotes, setTeamPerformanceNotes] = useState("");
  const [highlights, setHighlights] = useState("");
  const [areasToImprove, setAreasToImprove] = useState("");
  const [attendance, setAttendance] = useState("");
  const [energy, setEnergy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleDrill(drillId: string) {
    setCompleted((prev) => ({ ...prev, [drillId]: !prev[drillId] }));
  }

  async function handleSubmit() {
    setError(null);

    const drillsCompleted: string[] = [];
    const drillsSkipped: string[] = [];
    drills.forEach((d) => {
      if (completed[d.drillId]) drillsCompleted.push(d.drillId);
      else drillsSkipped.push(d.drillId);
    });

    let attendanceCount: number | null = null;
    if (attendance.trim()) {
      const parsed = Number(attendance.trim());
      if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        setError("Attendance must be a whole number.");
        return;
      }
      attendanceCount = parsed;
    }

    setSubmitting(true);

    const { error: insertErr } = await supabase.from("practice_logs").insert({
      practice_plan_id: planId,
      team_id: teamId,
      logged_by: userId,
      drills_completed: drillsCompleted,
      drills_skipped: drillsSkipped,
      team_performance_notes: teamPerformanceNotes.trim() || null,
      highlights: highlights.trim() || null,
      areas_to_improve: areasToImprove.trim() || null,
      attendance_count: attendanceCount,
      energy_level: energy,
    });

    if (insertErr) {
      setError(insertErr.message);
      setSubmitting(false);
      return;
    }

    const { error: updateErr } = await supabase
      .from("practice_plans")
      .update({ status: "completed" })
      .eq("id", planId);

    if (updateErr) {
      setError(updateErr.message);
      setSubmitting(false);
      return;
    }

    router.push(`/practice/${planId}`);
    router.refresh();
  }

  return (
    <div className="pt-3xl pb-2xl">
      <Link
        href={`/practice/${planId}`}
        className="text-caption no-underline"
        style={{ color: "var(--color-text-secondary)" }}
      >
        ← Plan
      </Link>

      <h1
        className="text-title font-medium mt-md"
        style={{ color: "var(--color-text-primary)" }}
      >
        Post-Practice Log
      </h1>
      <p
        className="text-caption mt-xs"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {practiceDate}
      </p>

      {/* Section 1: Drills Completed vs. Skipped */}
      <div className="mt-3xl">
        <p
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Drills run
        </p>
        {drills.length === 0 ? (
          <div
            className="mt-md p-2xl rounded-lg text-center"
            style={{
              backgroundColor: "var(--color-surface-base)",
              border: "1px dashed var(--color-border-default)",
            }}
          >
            <p
              className="text-body"
              style={{ color: "var(--color-text-secondary)" }}
            >
              No drills were planned.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-sm mt-md">
            {drills.map((d) => {
              const isCompleted = completed[d.drillId];
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDrill(d.drillId)}
                  aria-pressed={isCompleted}
                  className="text-left rounded-lg transition-all"
                  style={{
                    minHeight: "56px",
                    padding: "12px 16px",
                    backgroundColor: "var(--color-surface-raised)",
                    border: isCompleted
                      ? "1px solid var(--color-green-600)"
                      : "1px solid #C2410C",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span
                    className="text-heading font-medium flex-shrink-0"
                    aria-hidden
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "9999px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isCompleted
                        ? "var(--color-green-800)"
                        : "rgba(194,65,12,0.15)",
                      color: isCompleted
                        ? "var(--color-green-400)"
                        : "#FB923C",
                      lineHeight: 1,
                    }}
                  >
                    {isCompleted ? "✓" : "✕"}
                  </span>
                  <span
                    className="flex-1 text-body font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {d.drillName}
                  </span>
                  <span
                    className="text-caption font-medium"
                    style={{
                      color: isCompleted
                        ? "var(--color-green-400)"
                        : "#FB923C",
                    }}
                  >
                    {isCompleted ? "Completed" : "Skipped"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Team Performance */}
      <div className="mt-3xl">
        <p
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          How did the team perform?
        </p>
        <textarea
          value={teamPerformanceNotes}
          onChange={(e) => setTeamPerformanceNotes(e.target.value)}
          placeholder="Overall observations on how the team did..."
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

      {/* Section 3: Highlights & Areas to Improve */}
      <div className="mt-3xl">
        <p
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          What went well?
        </p>
        <textarea
          value={highlights}
          onChange={(e) => setHighlights(e.target.value)}
          placeholder="Best moments, standout players, things that clicked..."
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

      <div className="mt-2xl">
        <p
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          What needs work?
        </p>
        <textarea
          value={areasToImprove}
          onChange={(e) => setAreasToImprove(e.target.value)}
          placeholder="Gaps to address, drills to revisit, adjustments for next time..."
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

      {/* Section 4: Quick Stats */}
      <div className="mt-3xl">
        <p
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Players present
        </p>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          placeholder="e.g., 12"
          value={attendance}
          onChange={(e) => setAttendance(e.target.value)}
          className="w-full mt-md rounded-lg text-body tabular-nums"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-default)",
            padding: "12px 16px",
            outline: "none",
          }}
        />
      </div>

      <div className="mt-2xl">
        <p
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Team energy
        </p>
        <div className="flex items-center justify-between gap-sm mt-md">
          {[1, 2, 3, 4, 5].map((r) => {
            const selected = energy === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setEnergy(selected ? null : r)}
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
            color: energy
              ? "var(--color-text-primary)"
              : "var(--color-text-muted)",
            minHeight: "20px",
          }}
        >
          {energy ? ENERGY_ANCHORS[energy] : "Tap a level"}
        </p>
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
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-lg rounded-xl text-body font-medium tracking-wide"
          style={{
            backgroundColor: "var(--color-orange-500)",
            color: "#FFFFFF",
            letterSpacing: "0.3px",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Saving..." : "Save Practice Log"}
        </button>
      </div>
    </div>
  );
}
