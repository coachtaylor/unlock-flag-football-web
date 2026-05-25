"use client";

// PAUSED: Individual QB tracking is on hold while the Coach/Team MVP is the focus.
// This route is no longer linked from the bottom nav or auth flow. Preserved for resumption.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Format = "5v5" | "7v7" | "both";

type ImprovementGoal =
  | "Strength"
  | "Mobility"
  | "Throwing Mechanics"
  | "Pain Management"
  | "Football IQ"
  | "Conditioning";

const IMPROVEMENT_GOALS: ImprovementGoal[] = [
  "Strength",
  "Mobility",
  "Throwing Mechanics",
  "Pain Management",
  "Football IQ",
  "Conditioning",
];

type ProfileDraft = {
  display_name: string;
  primary_position: string;
  format_preference: Format | "";
  improvement_goals: string[];
};

const EMPTY_DRAFT: ProfileDraft = {
  display_name: "",
  primary_position: "QB",
  format_preference: "",
  improvement_goals: [],
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(0);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "display_name, primary_position, format_preference, improvement_goals, onboarding_step, onboarding_completed_at"
        )
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (profile?.onboarding_completed_at) {
        router.replace("/");
        return;
      }

      if (profile) {
        const rawGoals = profile.improvement_goals;
        const goals: string[] = Array.isArray(rawGoals)
          ? rawGoals
          : typeof rawGoals === "string" && rawGoals.length > 0
            ? [rawGoals]
            : [];
        setDraft({
          display_name: profile.display_name ?? "",
          primary_position: profile.primary_position ?? "QB",
          format_preference: (profile.format_preference as Format) ?? "",
          improvement_goals: goals,
        });
        setStep(profile.onboarding_step ?? 0);
      }

      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function persist(nextStep: number, completed: boolean) {
    if (!userId) return;
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      id: userId,
      display_name: draft.display_name.trim() || null,
      primary_position: draft.primary_position || "QB",
      format_preference: draft.format_preference || null,
      improvement_goals:
        draft.improvement_goals.length > 0 ? draft.improvement_goals : null,
      onboarding_step: nextStep,
    };
    if (completed) payload.onboarding_completed_at = new Date().toISOString();

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return false;
    }
    return true;
  }

  async function goNext() {
    const nextStep = Math.min(step + 1, 2);
    const ok = await persist(nextStep, false);
    if (ok) setStep(nextStep);
  }

  async function goBack() {
    const prevStep = Math.max(step - 1, 0);
    const ok = await persist(prevStep, false);
    if (ok) setStep(prevStep);
  }

  async function completeOnboarding() {
    const ok = await persist(2, true);
    if (ok) router.replace("/");
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-center justify-center py-3xl px-xl">
      <div
        className="rounded-lg p-2xl"
        style={{
          backgroundColor: "var(--color-surface-raised)",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <ProgressDots current={step} total={3} />

        {step === 0 && <WelcomeScreen onNext={goNext} saving={saving} />}
        {step === 1 && (
          <ProfileScreen
            draft={draft}
            setDraft={setDraft}
            onNext={goNext}
            onBack={goBack}
            saving={saving}
          />
        )}
        {step === 2 && (
          <YourPlanScreen
            goals={draft.improvement_goals}
            onComplete={completeOnboarding}
            onBack={goBack}
            saving={saving}
          />
        )}

        {error && (
          <p className="mt-lg text-caption" style={{ color: "var(--color-error-light)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-sm justify-center mb-2xl">
      {Array.from({ length: total }).map((_, i) => {
        const opacity = i < current ? 0.3 : i === current ? 1 : 0.2;
        return (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              backgroundColor: "var(--color-orange-500)",
              opacity,
            }}
          />
        );
      })}
    </div>
  );
}

function WelcomeScreen({ onNext, saving }: { onNext: () => void; saving: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-title">Welcome to Unlock Flag Football</h1>
      <p
        className="text-body mt-md"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Track your development. Know what to focus on. Become a better QB.
      </p>
      <PrimaryButton onClick={onNext} disabled={saving} className="mt-2xl">
        {saving ? "Saving…" : "Get Started"}
      </PrimaryButton>
    </div>
  );
}

function ProfileScreen({
  draft,
  setDraft,
  onNext,
  onBack,
  saving,
}: {
  draft: ProfileDraft;
  setDraft: (next: ProfileDraft) => void;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  const formats: Format[] = ["5v5", "7v7", "both"];
  const canAdvance = draft.display_name.trim().length > 0;

  function toggleGoal(goal: ImprovementGoal) {
    const current = draft.improvement_goals;
    const next = current.includes(goal)
      ? current.filter((g) => g !== goal)
      : [...current, goal];
    setDraft({ ...draft, improvement_goals: next });
  }

  return (
    <div>
      <h1 className="text-title mb-xs">Quick profile</h1>
      <p
        className="text-caption mb-2xl"
        style={{ color: "var(--color-text-secondary)" }}
      >
        We use this to tailor your dashboard.
      </p>

      <div className="flex flex-col gap-lg">
        <Field label="Display name">
          <Input
            value={draft.display_name}
            onChange={(v) => setDraft({ ...draft, display_name: v })}
            autoComplete="name"
          />
        </Field>

        <Field label="Position">
          <Input
            value={draft.primary_position}
            onChange={(v) => setDraft({ ...draft, primary_position: v })}
          />
        </Field>

        <Field label="Format preference">
          <div className="flex gap-sm flex-wrap">
            {formats.map((f) => {
              const selected = draft.format_preference === f;
              return (
                <Pill
                  key={f}
                  selected={selected}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      format_preference: selected ? "" : f,
                    })
                  }
                >
                  {f === "both" ? "Both" : f}
                </Pill>
              );
            })}
          </div>
        </Field>

        <Field label="Improvement goals">
          <div className="flex gap-sm flex-wrap">
            {IMPROVEMENT_GOALS.map((goal) => {
              const selected = draft.improvement_goals.includes(goal);
              return (
                <Pill
                  key={goal}
                  selected={selected}
                  onClick={() => toggleGoal(goal)}
                >
                  {goal}
                </Pill>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="mt-2xl flex gap-md">
        <SecondaryButton onClick={onBack} disabled={saving}>
          Back
        </SecondaryButton>
        <PrimaryButton
          onClick={onNext}
          disabled={saving || !canAdvance}
          className="flex-1"
        >
          {saving ? "Saving…" : "Continue"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function YourPlanScreen({
  goals,
  onComplete,
  onBack,
  saving,
}: {
  goals: string[];
  onComplete: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  const cards: { label: string; labelColor: string; body: string }[] = [];
  const has = (g: string) => goals.includes(g);

  if (has("Strength") || has("Mobility") || has("Conditioning")) {
    cards.push({
      label: "Workouts",
      labelColor: "var(--color-green-400)",
      body: "Workouts with muscle group balance and progress tracking",
    });
  }
  if (has("Throwing Mechanics")) {
    cards.push({
      label: "Throwing",
      labelColor: "var(--color-orange-400)",
      body: "Throwing session tracking with mechanics quality monitoring",
    });
  }
  if (has("Pain Management")) {
    cards.push({
      label: "Pain Management",
      labelColor: "var(--color-orange-400)",
      body: "Track pain by body area and spot patterns tied to activity",
    });
  }
  if (has("Football IQ")) {
    cards.push({
      label: "Football IQ",
      labelColor: "var(--color-indigo-400)",
      body: "Routes, coverages, and play concepts in the playbook",
    });
  }
  cards.push({
    label: "Weekly Focus",
    labelColor: "var(--color-blue-400)",
    body: "Weekly focus recommendations based on your activity",
  });

  return (
    <div>
      <h1 className="text-title mb-xs">Here&apos;s your plan</h1>
      <p
        className="text-caption mb-2xl"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Based on your goals, here&apos;s how Unlock will help you improve.
      </p>

      <div className="flex flex-col gap-md">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg p-lg"
            style={{
              backgroundColor: "var(--color-surface-base)",
              border: "1px dashed var(--color-border-subtle)",
            }}
          >
            <p
              className="label-micro"
              style={{ color: card.labelColor }}
            >
              {card.label}
            </p>
            <p
              className="text-body mt-xs"
              style={{ color: "var(--color-text-primary)" }}
            >
              {card.body}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-2xl flex gap-md">
        <SecondaryButton onClick={onBack} disabled={saving}>
          Back
        </SecondaryButton>
        <PrimaryButton
          onClick={onComplete}
          disabled={saving}
          className="flex-1"
        >
          {saving ? "Saving…" : "Let's go"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-xs">
      <span
        className="label-micro"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      className="w-full rounded-md px-md text-body outline-none transition-colors"
      style={{
        height: "44px",
        backgroundColor: "var(--color-surface-base)",
        border: "1px solid var(--color-border-default)",
        color: "var(--color-text-primary)",
      }}
    />
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
        border: `1px solid ${selected ? "var(--color-orange-500)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      {children}
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
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="py-lg px-xl rounded-xl text-body font-medium transition-opacity"
      style={{
        backgroundColor: "transparent",
        color: "var(--color-text-secondary)",
        border: "1px solid var(--color-border-default)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
