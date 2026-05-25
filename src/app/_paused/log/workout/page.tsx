"use client";

// PAUSED: Individual QB tracking is on hold while the Coach/Team MVP is the focus.
// This route is no longer linked from the bottom nav. Preserved for resumption.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Exercise = {
  id: string;
  exercise_name: string;
  category: string;
  primary_muscles: string[] | null;
};

type RPE = 4 | 6 | 9;

type SetDraft = {
  completed: boolean;
  reps: string;
  weight: string;
  rpe: RPE | null;
};

type ExerciseDraft = {
  exercise: Exercise;
  detailsOpen: boolean;
  sets: SetDraft[];
};

const CATEGORY_LABEL: Record<string, string> = {
  strength: "Strength",
  mobility: "Mobility",
  arm_care: "Arm Care",
  power: "Power",
  speed: "Speed",
};

function newSet(): SetDraft {
  return { completed: true, reps: "", weight: "", rpe: null };
}

export default function WorkoutLog() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [userId, setUserId] = useState<string | null>(null);

  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<ExerciseDraft[]>([]);
  const [weightDefaults, setWeightDefaults] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user?.id;
      if (!id) {
        router.replace("/login");
        return;
      }
      if (cancelled) return;
      setUserId(id);

      const { data, error: exError } = await supabase
        .from("exercise_library")
        .select("id, exercise_name, category, primary_muscles")
        .or(`owner_user_id.is.null,owner_user_id.eq.${id}`)
        .order("exercise_name");

      if (cancelled) return;
      if (exError) {
        setError(exError.message);
      } else {
        setExercises((data ?? []) as Exercise[]);
      }
      setExercisesLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? exercises.filter((e) => e.exercise_name.toLowerCase().includes(q))
      : exercises;
    const groups = new Map<string, Exercise[]>();
    for (const ex of list) {
      const key = ex.category || "other";
      const arr = groups.get(key) ?? [];
      arr.push(ex);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [exercises, search]);

  function toggleExercise(ex: Exercise) {
    setSelected((cur) => {
      const idx = cur.findIndex((d) => d.exercise.id === ex.id);
      if (idx >= 0) return cur.filter((_, i) => i !== idx);
      return [...cur, { exercise: ex, detailsOpen: false, sets: [newSet()] }];
    });
  }

  async function goToLogSets() {
    if (!userId || selected.length === 0) return;

    const ids = selected.map((d) => d.exercise.id);
    const { data } = await supabase
      .from("exercise_sets")
      .select(
        "weight, created_at, workout_session_exercise:workout_session_exercises!inner(exercise_id)"
      )
      .eq("user_id", userId)
      .in("workout_session_exercise.exercise_id", ids)
      .not("weight", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    const defaults: Record<string, string> = {};
    if (data) {
      for (const row of data as unknown as Array<{
        weight: number | null;
        workout_session_exercise: { exercise_id: string } | null;
      }>) {
        const exId = row.workout_session_exercise?.exercise_id;
        if (exId && !defaults[exId] && row.weight != null) {
          defaults[exId] = String(row.weight);
        }
      }
    }
    setWeightDefaults(defaults);
    setStep(2);
  }

  function updateExerciseDraft(exId: string, fn: (d: ExerciseDraft) => ExerciseDraft) {
    setSelected((cur) => cur.map((d) => (d.exercise.id === exId ? fn(d) : d)));
  }

  async function saveWorkout() {
    if (!userId) return;
    setSaving(true);
    setError(null);

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: userId,
        session_date: date,
        title: `Workout • ${date}`,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      setError(sessionError?.message ?? "Failed to create session");
      setSaving(false);
      return;
    }

    for (let i = 0; i < selected.length; i++) {
      const draft = selected[i];
      const completedSets = draft.sets.filter((s) => s.completed).length;

      const { data: link, error: linkError } = await supabase
        .from("workout_session_exercises")
        .insert({
          user_id: userId,
          workout_session_id: session.id,
          exercise_id: draft.exercise.id,
          exercise_order: i + 1,
          completed_sets: completedSets,
        })
        .select("id")
        .single();

      if (linkError || !link) {
        setError(linkError?.message ?? "Failed to link exercise");
        setSaving(false);
        return;
      }

      const setRows = draft.sets.map((s, idx) => ({
        user_id: userId,
        workout_session_exercise_id: link.id,
        set_number: idx + 1,
        reps: s.reps ? Number(s.reps) : null,
        weight: s.weight ? Number(s.weight) : null,
        weight_unit: "lb",
        rpe: s.rpe ?? null,
        completed: s.completed,
      }));

      const { error: setsError } = await supabase.from("exercise_sets").insert(setRows);
      if (setsError) {
        setError(setsError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.replace("/");
  }

  return (
    <div className="pt-2xl pb-3xl px-xl">
      <ProgressHeader step={step} onBack={step > 0 ? () => setStep((step - 1) as 0 | 1) : null} />

      {step === 0 && (
        <SetupScreen
          date={date}
          setDate={setDate}
          notes={notes}
          setNotes={setNotes}
          onNext={() => setStep(1)}
        />
      )}

      {step === 1 && (
        <SelectScreen
          loading={exercisesLoading}
          search={search}
          setSearch={setSearch}
          groups={filtered}
          selected={selected}
          onToggle={toggleExercise}
          onNext={goToLogSets}
        />
      )}

      {step === 2 && (
        <LogSetsScreen
          drafts={selected}
          weightDefaults={weightDefaults}
          onUpdate={updateExerciseDraft}
          onSave={saveWorkout}
          saving={saving}
        />
      )}

      {error && (
        <p className="mt-lg text-caption" style={{ color: "var(--color-error-light)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function ProgressHeader({
  step,
  onBack,
}: {
  step: 0 | 1 | 2;
  onBack: (() => void) | null;
}) {
  const labels = ["Setup", "Select", "Log"];
  return (
    <div className="mb-2xl">
      <div className="flex items-center justify-between mb-md">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-caption"
            style={{ color: "var(--color-text-secondary)", minHeight: 44 }}
          >
            ← Back
          </button>
        ) : (
          <span style={{ minHeight: 44 }} />
        )}
        <span className="text-caption" style={{ color: "var(--color-orange-400)" }}>
          {step + 1} / 3
        </span>
      </div>
      <div className="flex gap-xs">
        {labels.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              style={{
                height: 3,
                borderRadius: 9999,
                backgroundColor:
                  i <= step ? "var(--color-orange-500)" : "var(--color-border-subtle)",
              }}
            />
            <p
              className="text-micro mt-xs"
              style={{
                color:
                  i === step
                    ? "var(--color-text-primary)"
                    : "var(--color-text-muted)",
              }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupScreen({
  date,
  setDate,
  notes,
  setNotes,
  onNext,
}: {
  date: string;
  setDate: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h1 className="text-title">New workout</h1>
      <p className="text-caption mt-xs" style={{ color: "var(--color-text-secondary)" }}>
        Set the date. Add notes if you want.
      </p>

      <div className="mt-2xl flex flex-col gap-lg">
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md px-md text-body outline-none"
            style={{
              height: 44,
              backgroundColor: "var(--color-surface-base)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
              colorScheme: "dark",
            }}
          />
        </Field>

        <Field label="Session notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md px-md py-sm text-body outline-none resize-none"
            style={{
              backgroundColor: "var(--color-surface-base)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
            }}
            placeholder="How did the session feel?"
          />
        </Field>
      </div>

      <PrimaryButton onClick={onNext} className="mt-2xl">
        Start Logging
      </PrimaryButton>
    </div>
  );
}

function SelectScreen({
  loading,
  search,
  setSearch,
  groups,
  selected,
  onToggle,
  onNext,
}: {
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  groups: [string, Exercise[]][];
  selected: ExerciseDraft[];
  onToggle: (ex: Exercise) => void;
  onNext: () => void;
}) {
  const selectedIds = new Set(selected.map((d) => d.exercise.id));
  const canAdvance = selected.length > 0;

  return (
    <div className="pb-[180px]">
      <h1 className="text-title">Choose exercises</h1>
      <p className="text-caption mt-xs" style={{ color: "var(--color-text-secondary)" }}>
        Tap to add. Tap again to remove.
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search exercises"
        className="w-full mt-lg rounded-md px-md text-body outline-none"
        style={{
          height: 44,
          backgroundColor: "var(--color-surface-base)",
          border: "1px solid var(--color-border-default)",
          color: "var(--color-text-primary)",
        }}
      />

      <div className="mt-lg flex flex-col gap-lg">
        {loading && (
          <p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
            Loading exercises…
          </p>
        )}
        {!loading && groups.length === 0 && (
          <p className="text-caption" style={{ color: "var(--color-text-muted)" }}>
            No matches.
          </p>
        )}
        {groups.map(([category, list]) => (
          <div key={category}>
            <p className="label-micro mb-sm" style={{ color: "var(--color-text-secondary)" }}>
              {CATEGORY_LABEL[category] ?? category}
            </p>
            <div className="flex flex-col gap-sm">
              {list.map((ex) => {
                const isSelected = selectedIds.has(ex.id);
                const muscle = ex.primary_muscles?.[0];
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => onToggle(ex)}
                    aria-pressed={isSelected}
                    className="w-full text-left rounded-lg p-lg transition-colors"
                    style={{
                      backgroundColor: isSelected
                        ? "rgba(212,138,48,0.08)"
                        : "var(--color-surface-raised)",
                      border: `1px solid ${
                        isSelected
                          ? "var(--color-orange-500)"
                          : "var(--color-border-subtle)"
                      }`,
                      minHeight: 56,
                    }}
                  >
                    <p
                      className="text-body font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {ex.exercise_name}
                    </p>
                    {muscle && (
                      <p
                        className="text-caption mt-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {muscle}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 px-xl pt-md pb-lg"
        style={{
          backgroundColor: "var(--color-surface-base)",
          borderTop: "1px solid var(--color-border-subtle)",
        }}
      >
        {selected.length > 0 && (
          <div className="flex gap-sm flex-wrap mb-md max-h-[80px] overflow-y-auto">
            {selected.map((d) => (
              <SelectedPill key={d.exercise.id} onRemove={() => onToggle(d.exercise)}>
                {d.exercise.exercise_name}
              </SelectedPill>
            ))}
          </div>
        )}
        <PrimaryButton onClick={onNext} disabled={!canAdvance}>
          {canAdvance ? `Log Sets (${selected.length})` : "Log Sets"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function LogSetsScreen({
  drafts,
  weightDefaults,
  onUpdate,
  onSave,
  saving,
}: {
  drafts: ExerciseDraft[];
  weightDefaults: Record<string, string>;
  onUpdate: (exId: string, fn: (d: ExerciseDraft) => ExerciseDraft) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div>
      <h1 className="text-title">Log sets</h1>
      <p className="text-caption mt-xs" style={{ color: "var(--color-text-secondary)" }}>
        Check off completed sets. Add details if you want.
      </p>

      <div className="mt-2xl flex flex-col gap-lg">
        {drafts.map((draft) => (
          <ExerciseCard
            key={draft.exercise.id}
            draft={draft}
            defaultWeight={weightDefaults[draft.exercise.id]}
            onChange={(fn) => onUpdate(draft.exercise.id, fn)}
          />
        ))}
      </div>

      <PrimaryButton onClick={onSave} disabled={saving} className="mt-2xl">
        {saving ? "Saving…" : "Save Workout"}
      </PrimaryButton>
    </div>
  );
}

function ExerciseCard({
  draft,
  defaultWeight,
  onChange,
}: {
  draft: ExerciseDraft;
  defaultWeight: string | undefined;
  onChange: (fn: (d: ExerciseDraft) => ExerciseDraft) => void;
}) {
  function updateSet(idx: number, patch: Partial<SetDraft>) {
    onChange((d) => ({
      ...d,
      sets: d.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  function addSet() {
    onChange((d) => ({
      ...d,
      sets: [...d.sets, newSet()],
    }));
  }

  function toggleDetails() {
    onChange((d) => ({ ...d, detailsOpen: !d.detailsOpen }));
  }

  return (
    <div
      className="rounded-lg p-lg"
      style={{ backgroundColor: "var(--color-surface-raised)" }}
    >
      <div className="flex items-center justify-between mb-md">
        <p className="text-heading" style={{ color: "var(--color-text-primary)" }}>
          {draft.exercise.exercise_name}
        </p>
        <button
          type="button"
          onClick={toggleDetails}
          className="text-caption"
          style={{ color: "var(--color-orange-400)", minHeight: 44, padding: "0 8px" }}
        >
          {draft.detailsOpen ? "Hide details" : "Add details"}
        </button>
      </div>

      <div className="flex flex-col gap-sm">
        {draft.sets.map((set, idx) => (
          <SetRow
            key={idx}
            setNumber={idx + 1}
            set={set}
            detailsOpen={draft.detailsOpen}
            defaultWeight={defaultWeight}
            onChange={(patch) => updateSet(idx, patch)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addSet}
        className="w-full mt-md rounded-md text-caption font-medium transition-colors"
        style={{
          minHeight: 44,
          backgroundColor: "transparent",
          color: "var(--color-text-secondary)",
          border: "1px dashed var(--color-border-default)",
        }}
      >
        + Add set
      </button>
    </div>
  );
}

function SetRow({
  setNumber,
  set,
  detailsOpen,
  defaultWeight,
  onChange,
}: {
  setNumber: number;
  set: SetDraft;
  detailsOpen: boolean;
  defaultWeight: string | undefined;
  onChange: (patch: Partial<SetDraft>) => void;
}) {
  const weightValue = set.weight !== "" ? set.weight : "";
  const weightPlaceholder = defaultWeight ?? "Weight";

  return (
    <div
      className="rounded-md p-md"
      style={{
        backgroundColor: "var(--color-surface-base)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <div className="flex items-center gap-md">
        <button
          type="button"
          onClick={() => onChange({ completed: !set.completed })}
          aria-pressed={set.completed}
          aria-label={`Set ${setNumber} completed`}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            backgroundColor: set.completed ? "var(--color-orange-500)" : "transparent",
            border: `1px solid ${
              set.completed ? "var(--color-orange-500)" : "var(--color-border-default)"
            }`,
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {set.completed ? "✓" : ""}
        </button>
        <span
          className="text-caption"
          style={{ color: "var(--color-text-secondary)", minWidth: 44 }}
        >
          Set {setNumber}
        </span>
      </div>

      {detailsOpen && (
        <div className="mt-md flex flex-col gap-sm">
          <div className="flex gap-sm">
            <NumberInput
              label="Reps"
              value={set.reps}
              onChange={(v) => onChange({ reps: v })}
              placeholder="0"
            />
            <NumberInput
              label="Weight (lbs)"
              value={weightValue}
              onChange={(v) => onChange({ weight: v })}
              placeholder={weightPlaceholder}
            />
          </div>
          <div>
            <p
              className="label-micro mb-xs"
              style={{ color: "var(--color-text-secondary)" }}
            >
              RPE
            </p>
            <div className="flex gap-sm">
              {([
                { label: "Easy", value: 4 },
                { label: "Moderate", value: 6 },
                { label: "Hard", value: 9 },
              ] as const).map((opt) => (
                <Pill
                  key={opt.value}
                  selected={set.rpe === opt.value}
                  onClick={() =>
                    onChange({ rpe: set.rpe === opt.value ? null : opt.value })
                  }
                >
                  {opt.label}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex-1 flex flex-col gap-xs">
      <span className="label-micro" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md px-md text-body outline-none tabular-nums"
        style={{
          height: 44,
          backgroundColor: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-default)",
          color: "var(--color-text-primary)",
        }}
      />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="label-micro" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="rounded-pill text-caption font-medium transition-all"
      style={{
        minHeight: 44,
        padding: "8px 14px",
        backgroundColor: selected ? "#5C3308" : "rgba(255,255,255,0.04)",
        color: selected ? "#F0B870" : "rgba(255,255,255,0.45)",
        border: `1px solid ${
          selected ? "var(--color-orange-500)" : "rgba(255,255,255,0.08)"
        }`,
      }}
    >
      {children}
    </button>
  );
}

function SelectedPill({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="rounded-pill text-caption font-medium flex items-center gap-xs"
      style={{
        minHeight: 32,
        padding: "4px 12px",
        backgroundColor: "#5C3308",
        color: "#F0B870",
        border: "1px solid var(--color-orange-500)",
      }}
    >
      {children}
      <span style={{ opacity: 0.7 }}>×</span>
    </button>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  className,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-lg rounded-xl text-body font-medium tracking-wide transition-opacity ${className ?? ""}`}
      style={{
        backgroundColor: "var(--color-orange-500)",
        color: "#FFFFFF",
        letterSpacing: "0.3px",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
