"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Category = { id: string; name: string };

type LibraryDrill = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
};

type PlanDrill = {
  drillId: string;
  durationMinutes: number;
};

export type PracticePlanFormInitial = {
  id: string;
  practiceDate: string;
  startTime: string;
  endTime: string;
  title: string;
  notes: string;
  status: "draft" | "finalized" | "completed";
  drills: PlanDrill[];
};

type Props = {
  teamId: string;
  drills: LibraryDrill[];
  categories: Category[];
  initial?: PracticePlanFormInitial;
};


const ALL = "__all__";

function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function PracticePlanForm({
  teamId,
  drills,
  categories,
  initial,
}: Props) {
  const router = useRouter();
  const isEditing = !!initial;

  const [practiceDate, setPracticeDate] = useState(
    initial?.practiceDate ?? todayString()
  );
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [planDrills, setPlanDrills] = useState<PlanDrill[]>(
    initial?.drills ?? []
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<string>(ALL);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const drillsById = useMemo(() => {
    const map = new Map<string, LibraryDrill>();
    for (const d of drills) map.set(d.id, d);
    return map;
  }, [drills]);

  // When the user returns from /drills/new after publishing a drill, the URL
  // carries `addDrill=<id>`. Append it to the loaded plan and open the picker.
  // The plan itself was persisted to the DB before navigating, so the rest of
  // the form data is already hydrated via the `initial` prop on this page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addDrill = params.get("addDrill");
    if (!addDrill) return;

    setPlanDrills((prev) =>
      prev.some((d) => d.drillId === addDrill)
        ? prev
        : [...prev, { drillId: addDrill, durationMinutes: 15 }]
    );
    setPickerOpen(true);

    const url = new URL(window.location.href);
    url.searchParams.delete("addDrill");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const totalDuration = useMemo(
    () => planDrills.reduce((sum, d) => sum + (d.durationMinutes || 0), 0),
    [planDrills]
  );

  const practiceMinutes = useMemo(() => {
    if (!startTime || !endTime) return null;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
    const diff = eh * 60 + em - (sh * 60 + sm);
    return diff > 0 ? diff : null;
  }, [startTime, endTime]);

  const remainingMinutes =
    practiceMinutes != null ? practiceMinutes - totalDuration : null;

  const filteredDrills = useMemo(() => {
    if (pickerCategory === ALL) return drills;
    return drills.filter((d) => d.categoryId === pickerCategory);
  }, [drills, pickerCategory]);

  const addedIds = useMemo(
    () => new Set(planDrills.map((d) => d.drillId)),
    [planDrills]
  );

  function addDrill(drillId: string) {
    if (addedIds.has(drillId)) return;
    setPlanDrills((prev) => [...prev, { drillId, durationMinutes: 15 }]);
  }

  function removeDrill(index: number) {
    setPlanDrills((prev) => prev.filter((_, i) => i !== index));
  }

  function moveDrill(index: number, direction: -1 | 1) {
    setPlanDrills((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // Persist current form state to the DB. Returns the planId on success, or
  // null on failure (after setting an error). Used by both save() and
  // goCreateNewDrill — the latter auto-saves a draft so unsaved input is
  // never lost across navigation.
  async function persistPlan(
    targetStatus: "draft" | "finalized" | "completed"
  ): Promise<string | null> {
    if (!practiceDate) {
      setError("Practice date is required.");
      return null;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in.");
      return null;
    }

    let planId = initial?.id;
    const payload = {
      team_id: teamId,
      practice_date: practiceDate,
      start_time: startTime || null,
      end_time: endTime || null,
      title: title.trim() || null,
      notes: notes.trim() || null,
      status: targetStatus,
    };

    if (isEditing && planId) {
      const { error: updateErr } = await supabase
        .from("practice_plans")
        .update(payload)
        .eq("id", planId);
      if (updateErr) {
        setError(updateErr.message);
        return null;
      }
      const { error: deleteErr } = await supabase
        .from("practice_plan_drills")
        .delete()
        .eq("practice_plan_id", planId);
      if (deleteErr) {
        setError(deleteErr.message);
        return null;
      }
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("practice_plans")
        .insert({ ...payload, created_by: user.id })
        .select("id")
        .single();
      if (insertErr || !inserted) {
        setError(insertErr?.message ?? "Could not create plan.");
        return null;
      }
      planId = inserted.id as string;
    }

    if (planDrills.length > 0 && planId) {
      const rows = planDrills.map((d, i) => ({
        practice_plan_id: planId,
        drill_id: d.drillId,
        drill_order: i + 1,
        duration_minutes: d.durationMinutes || null,
        notes: null,
      }));
      const { error: drillsErr } = await supabase
        .from("practice_plan_drills")
        .insert(rows);
      if (drillsErr) {
        setError(drillsErr.message);
        return null;
      }
    }

    return planId ?? null;
  }

  async function goCreateNewDrill() {
    setError(null);
    setSubmitting(true);
    // Auto-save as a draft (or preserve existing status if already past
    // draft) so navigating away never loses work.
    const targetStatus =
      initial?.status && initial.status !== "draft" ? initial.status : "draft";
    const planId = await persistPlan(targetStatus);
    if (!planId) {
      setSubmitting(false);
      return;
    }
    const returnTo = `/practice/${planId}/edit`;
    const url = `/drills/new?returnTo=${encodeURIComponent(returnTo)}`;
    // For a brand-new plan, replace `/practice/new` in history so back-nav
    // doesn't drop the user on an empty form whose draft has already been
    // saved under a real id.
    if (isEditing) {
      router.push(url);
    } else {
      router.replace(url);
    }
  }

  function updateDuration(index: number, value: string) {
    const parsed = parseInt(value, 10);
    setPlanDrills((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        durationMinutes: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
      };
      return next;
    });
  }

  async function save(targetStatus: "draft" | "finalized") {
    setError(null);
    setSubmitting(true);
    const planId = await persistPlan(targetStatus);
    if (!planId) {
      setSubmitting(false);
      return;
    }
    router.push(`/practice/${planId}`);
  }

  const pillStyle = (selected: boolean) => ({
    padding: "8px 14px",
    minHeight: "44px",
    backgroundColor: selected ? "#5C3308" : "rgba(255,255,255,0.04)",
    color: selected ? "#F0B870" : "rgba(255,255,255,0.45)",
    border: selected
      ? "1px solid #D48A30"
      : "1px solid rgba(255,255,255,0.08)",
  });

  return (
    <div className="pt-3xl pb-2xl">
      <Link
        href={isEditing && initial ? `/practice/${initial.id}` : "/practice"}
        className="text-caption no-underline"
        style={{ color: "var(--color-text-secondary)" }}
      >
        ← {isEditing ? "Plan" : "Practice Plans"}
      </Link>

      <h1
        className="text-title font-medium mt-md"
        style={{ color: "var(--color-text-primary)" }}
      >
        {isEditing ? "Edit Plan" : "New Practice Plan"}
      </h1>

      {/* Date */}
      <div className="mt-2xl">
        <label
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Practice date
        </label>
        <input
          type="date"
          value={practiceDate}
          onChange={(e) => setPracticeDate(e.target.value)}
          className="w-full mt-md rounded-lg text-body"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-default)",
            padding: "12px",
            outline: "none",
          }}
        />
      </div>

      {/* Start / End time */}
      <div className="mt-xl flex gap-md">
        <div className="flex-1">
          <label
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Start time
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full mt-md rounded-lg text-body"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
              padding: "12px",
              outline: "none",
            }}
          />
        </div>
        <div className="flex-1">
          <label
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            End time
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full mt-md rounded-lg text-body"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
              padding: "12px",
              outline: "none",
            }}
          />
        </div>
      </div>
      {startTime && endTime && practiceMinutes == null && (
        <p
          className="text-caption mt-xs"
          style={{ color: "var(--color-orange-400)" }}
        >
          End time must be after start time.
        </p>
      )}

      {/* Title */}
      <div className="mt-xl">
        <label
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Title (optional)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Pre-tournament conditioning focus"
          className="w-full mt-md rounded-lg text-body"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-default)",
            padding: "12px",
            outline: "none",
          }}
        />
      </div>

      {/* Notes */}
      <div className="mt-xl">
        <label
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="General notes about this practice..."
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

      {/* Drills */}
      <div className="mt-3xl">
        <div className="flex items-center justify-between">
          <p
            className="text-heading font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            Drills
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-pill text-caption font-medium"
            style={{
              padding: "8px 14px",
              minHeight: "44px",
              backgroundColor: "var(--color-orange-500)",
              color: "#FFFFFF",
              letterSpacing: "0.3px",
            }}
          >
            {pickerOpen ? "Done" : "Add Drill"}
          </button>
        </div>

        {(planDrills.length > 0 || practiceMinutes != null) && (
          <p
            className="text-caption mt-xs tabular-nums"
            style={{
              color:
                remainingMinutes != null && remainingMinutes < 0
                  ? "var(--color-orange-400)"
                  : "var(--color-text-secondary)",
            }}
          >
            {planDrills.length > 0 && (
              <>
                {planDrills.length} drill
                {planDrills.length === 1 ? "" : "s"} · {totalDuration} min
                planned
              </>
            )}
            {planDrills.length > 0 && practiceMinutes != null && " · "}
            {practiceMinutes != null && remainingMinutes != null && (
              <>
                {remainingMinutes >= 0
                  ? `${remainingMinutes} min available`
                  : `${Math.abs(remainingMinutes)} min over`}
              </>
            )}
          </p>
        )}

        {/* Picker */}
        {pickerOpen && (
          <div
            className="mt-md p-md rounded-lg"
            style={{
              backgroundColor: "var(--color-surface-overlay)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            <div className="flex items-center justify-between gap-sm mb-md">
              <p
                className="label-micro"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Library
              </p>
              <button
                type="button"
                onClick={goCreateNewDrill}
                disabled={submitting}
                className="text-caption font-medium"
                style={{
                  background: "transparent",
                  color: "var(--color-orange-400)",
                  padding: "4px 8px",
                  minHeight: "36px",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? "Saving…" : "+ New drill"}
              </button>
            </div>

            {drills.length === 0 ? (
              <p
                className="text-body"
                style={{ color: "var(--color-text-secondary)" }}
              >
                No published drills yet. Tap &ldquo;+ New drill&rdquo; to
                create one.
              </p>
            ) : (
              <>
                <div
                  className="flex gap-sm overflow-x-auto"
                  style={{ paddingBottom: "4px" }}
                >
                  <button
                    type="button"
                    onClick={() => setPickerCategory(ALL)}
                    aria-pressed={pickerCategory === ALL}
                    className="rounded-pill text-caption font-medium transition-all flex-shrink-0"
                    style={pillStyle(pickerCategory === ALL)}
                  >
                    All
                  </button>
                  {categories.map((c) => {
                    const selected = pickerCategory === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPickerCategory(c.id)}
                        aria-pressed={selected}
                        className="rounded-pill text-caption font-medium transition-all flex-shrink-0 capitalize"
                        style={pillStyle(selected)}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-sm mt-md">
                  {filteredDrills.map((d) => {
                    const added = addedIds.has(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => addDrill(d.id)}
                        disabled={added}
                        className="p-md rounded-lg text-left transition-all"
                        style={{
                          backgroundColor: "var(--color-surface-base)",
                          border: "1px solid var(--color-border-subtle)",
                          opacity: added ? 0.5 : 1,
                          minHeight: "44px",
                        }}
                      >
                        <div className="flex items-center justify-between gap-md">
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-body font-medium"
                              style={{
                                color: "var(--color-text-primary)",
                              }}
                            >
                              {d.name}
                            </p>
                            {d.categoryName && (
                              <span
                                className="label-micro rounded-pill capitalize inline-block mt-xs"
                                style={{
                                  padding: "2px 8px",
                                  backgroundColor: "rgba(255,255,255,0.04)",
                                  color: "rgba(255,255,255,0.55)",
                                }}
                              >
                                {d.categoryName}
                              </span>
                            )}
                          </div>
                          <span
                            className="text-body font-medium flex-shrink-0"
                            style={{
                              color: added
                                ? "var(--color-green-400)"
                                : "var(--color-orange-400)",
                            }}
                          >
                            {added ? "✓" : "+"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Selected drills */}
        {planDrills.length === 0 ? (
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
              No drills yet. Tap &ldquo;Add Drill&rdquo; to build the schedule.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-sm mt-md">
            {planDrills.map((pd, index) => {
              const drill = drillsById.get(pd.drillId);
              return (
                <div
                  key={`${pd.drillId}-${index}`}
                  className="p-md rounded-lg"
                  style={{
                    backgroundColor: "var(--color-surface-base)",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <div className="flex items-center gap-sm">
                    <span
                      className="text-caption tabular-nums flex-shrink-0"
                      style={{
                        color: "var(--color-text-muted)",
                        width: "20px",
                      }}
                    >
                      {index + 1}
                    </span>
                    <p
                      className="text-body font-medium flex-1 min-w-0"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {drill?.name ?? "Unknown drill"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-sm mt-md">
                    <div className="flex items-center gap-xs">
                      <button
                        type="button"
                        onClick={() => moveDrill(index, -1)}
                        disabled={index === 0}
                        aria-label="Move up"
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "8px",
                          backgroundColor: "var(--color-surface-raised)",
                          color:
                            index === 0
                              ? "var(--color-text-muted)"
                              : "var(--color-text-secondary)",
                          border: "1px solid var(--color-border-subtle)",
                          opacity: index === 0 ? 0.4 : 1,
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDrill(index, 1)}
                        disabled={index === planDrills.length - 1}
                        aria-label="Move down"
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "8px",
                          backgroundColor: "var(--color-surface-raised)",
                          color:
                            index === planDrills.length - 1
                              ? "var(--color-text-muted)"
                              : "var(--color-text-secondary)",
                          border: "1px solid var(--color-border-subtle)",
                          opacity: index === planDrills.length - 1 ? 0.4 : 1,
                        }}
                      >
                        ↓
                      </button>
                    </div>
                    <div className="flex items-center gap-xs">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={pd.durationMinutes}
                        onChange={(e) => updateDuration(index, e.target.value)}
                        className="text-body tabular-nums text-center"
                        style={{
                          width: "56px",
                          height: "44px",
                          borderRadius: "8px",
                          backgroundColor: "var(--color-surface-raised)",
                          color: "var(--color-text-primary)",
                          border: "1px solid var(--color-border-default)",
                          outline: "none",
                        }}
                      />
                      <span
                        className="text-caption"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        min
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDrill(index)}
                      aria-label="Remove drill"
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "8px",
                        backgroundColor: "transparent",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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

      <div className="mt-3xl flex flex-col gap-sm">
        <button
          type="button"
          onClick={() => save("finalized")}
          disabled={submitting}
          className="w-full py-lg rounded-xl text-body font-medium tracking-wide"
          style={{
            backgroundColor: "var(--color-orange-500)",
            color: "#FFFFFF",
            letterSpacing: "0.3px",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Saving..." : "Finalize Plan"}
        </button>
        <button
          type="button"
          onClick={() => save("draft")}
          disabled={submitting}
          className="w-full py-lg rounded-xl text-body font-medium tracking-wide"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-subtle)",
            letterSpacing: "0.3px",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          Save Draft
        </button>
      </div>
    </div>
  );
}
