"use client";

// PAUSED: Individual QB tracking is on hold while the Coach/Team MVP is the focus.
// This route is no longer linked from the bottom nav. Preserved for resumption.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type SessionType = "game" | "practice";
type Format = "5v5" | "7v7";

const STRUGGLE_TAGS: { label: string; value: string }[] = [
  { label: "Reading coverage", value: "reading_coverage" },
  { label: "Route decisions", value: "route_decisions" },
  { label: "Telegraphing", value: "telegraphing" },
  { label: "Timing", value: "timing" },
  { label: "Accuracy", value: "accuracy" },
  { label: "Pocket awareness", value: "pocket_awareness" },
  { label: "Scramble decisions", value: "scramble_decisions" },
  { label: "Arm pain", value: "arm_pain" },
  { label: "Leadership", value: "leadership" },
  { label: "Communication", value: "communication" },
  { label: "Conditioning", value: "conditioning" },
];

function todayIso() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function feelAnchor(value: number) {
  if (value <= 2) return "Terrible";
  if (value <= 4) return "Rough";
  if (value <= 6) return "Okay";
  if (value <= 8) return "Good";
  return "Great";
}

function performanceAnchor(value: number) {
  if (value <= 2) return "Rough day";
  if (value <= 4) return "Off";
  if (value <= 6) return "Solid";
  if (value <= 8) return "Sharp";
  return "Lights out";
}

type Draft = {
  sessionType: SessionType | null;
  format: Format | null;
  leagueTeam: string;
  sessionDate: string;
  performanceRating: number | null;
  whatWentWell: string;
  struggles: string;
  struggleTags: string[];
  armFeel: number | null;
  legsFeel: number | null;
  energy: number | null;
  weeklyFocus: string;
};

const EMPTY: Draft = {
  sessionType: null,
  format: null,
  leagueTeam: "",
  sessionDate: todayIso(),
  performanceRating: null,
  whatWentWell: "",
  struggles: "",
  struggleTags: [],
  armFeel: null,
  legsFeel: null,
  energy: null,
  weeklyFocus: "",
};

export default function GameRecap() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [userId, setUserId] = useState<string | null>(null);
  const [recentFocus, setRecentFocus] = useState<string[]>([]);
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

      const { data: rows } = await supabase
        .from("game_practice_logs")
        .select("league_team, weekly_focus_action, session_date")
        .eq("user_id", id)
        .order("session_date", { ascending: false })
        .limit(10);

      if (cancelled || !rows) return;

      const lastLeague = rows.find((r) => r.league_team)?.league_team ?? "";
      const focuses = rows
        .map((r) => r.weekly_focus_action)
        .filter((v): v is string => !!v && v.trim().length > 0)
        .slice(0, 3);

      setDraft((d) => ({ ...d, leagueTeam: lastLeague }));
      setRecentFocus(focuses);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSave() {
    if (!userId) return;
    if (!draft.sessionType || !draft.format) return;

    setSaving(true);
    setError(null);

    const payload = {
      user_id: userId,
      session_date: draft.sessionDate,
      session_type: draft.sessionType,
      league_team: draft.leagueTeam.trim() || "Untitled",
      format: draft.format,
      performance_rating: draft.performanceRating,
      what_went_well: draft.whatWentWell.trim() || null,
      struggles: draft.struggles.trim() || null,
      struggle_tags: draft.struggleTags,
      arm_feel: draft.armFeel,
      legs_mobility_feel: draft.legsFeel,
      overall_energy: draft.energy,
      weekly_focus_action: draft.weeklyFocus.trim() || null,
    };

    const { error: insertError } = await supabase
      .from("game_practice_logs")
      .insert(payload);

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.replace("/");
  }

  function next() {
    setStep((s) => Math.min(s + 1, 5));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  const canAdvanceFromPre = !!draft.sessionType && !!draft.format;

  return (
    <div className="px-xl pt-3xl pb-3xl">
      <ProgressDots current={step} total={6} />

      <div
        className="mt-2xl rounded-lg p-lg"
        style={{ backgroundColor: "var(--color-surface-raised)" }}
      >
        {step === 0 && (
          <PreScreen
            draft={draft}
            setDraft={setDraft}
          />
        )}
        {step === 1 && (
          <PerformanceScreen
            value={draft.performanceRating}
            onChange={(v) => setDraft({ ...draft, performanceRating: v })}
          />
        )}
        {step === 2 && (
          <WentWellScreen
            value={draft.whatWentWell}
            onChange={(v) => setDraft({ ...draft, whatWentWell: v })}
          />
        )}
        {step === 3 && (
          <StrugglesScreen
            text={draft.struggles}
            tags={draft.struggleTags}
            onTextChange={(v) => setDraft({ ...draft, struggles: v })}
            onToggleTag={(tag) =>
              setDraft({
                ...draft,
                struggleTags: draft.struggleTags.includes(tag)
                  ? draft.struggleTags.filter((t) => t !== tag)
                  : [...draft.struggleTags, tag],
              })
            }
          />
        )}
        {step === 4 && (
          <BodyFeelScreen
            arm={draft.armFeel}
            legs={draft.legsFeel}
            energy={draft.energy}
            onChange={(field, v) => setDraft({ ...draft, [field]: v })}
          />
        )}
        {step === 5 && (
          <FocusScreen
            value={draft.weeklyFocus}
            onChange={(v) => setDraft({ ...draft, weeklyFocus: v })}
            recent={recentFocus}
          />
        )}
      </div>

      {error && (
        <p
          className="mt-lg text-caption"
          style={{ color: "var(--color-error-light)" }}
        >
          {error}
        </p>
      )}

      <div className="mt-2xl flex gap-md">
        {step > 0 && (
          <SecondaryButton onClick={back} disabled={saving}>
            Back
          </SecondaryButton>
        )}
        {step < 5 && (
          <PrimaryButton
            onClick={next}
            disabled={step === 0 && !canAdvanceFromPre}
            className="flex-1"
          >
            Next
          </PrimaryButton>
        )}
        {step === 5 && (
          <PrimaryButton
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving ? "Saving…" : "Save Recap"}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

function PreScreen({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
}) {
  return (
    <div className="flex flex-col gap-xl">
      <div>
        <h1 className="text-title">Recap setup</h1>
        <p
          className="text-caption mt-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Quick context, then we&apos;ll get into it.
        </p>
      </div>

      <Field label="Session type">
        <div className="flex gap-sm flex-wrap">
          {(["game", "practice"] as SessionType[]).map((t) => (
            <Pill
              key={t}
              selected={draft.sessionType === t}
              onClick={() => setDraft({ ...draft, sessionType: t })}
            >
              {t === "game" ? "Game" : "Practice"}
            </Pill>
          ))}
        </div>
      </Field>

      <Field label="Format">
        <div className="flex gap-sm flex-wrap">
          {(["5v5", "7v7"] as Format[]).map((f) => (
            <Pill
              key={f}
              selected={draft.format === f}
              onClick={() => setDraft({ ...draft, format: f })}
            >
              {f}
            </Pill>
          ))}
        </div>
      </Field>

      <Field label="League / team">
        <Input
          value={draft.leagueTeam}
          onChange={(v) => setDraft({ ...draft, leagueTeam: v })}
          placeholder="e.g. Saturday 7v7"
        />
      </Field>

      <Field label="Date">
        <DateInput
          value={draft.sessionDate}
          onChange={(v) => setDraft({ ...draft, sessionDate: v })}
        />
      </Field>
    </div>
  );
}

function PerformanceScreen({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number) => void;
}) {
  const shown = value ?? 5;
  return (
    <div className="flex flex-col gap-xl">
      <div>
        <h1 className="text-title">How&apos;d you play today?</h1>
        <p
          className="text-caption mt-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Gut feel — no overthinking.
        </p>
      </div>

      <div className="flex flex-col items-center gap-sm">
        <span
          className="tabular-nums"
          style={{
            fontSize: "56px",
            lineHeight: 1,
            fontWeight: 500,
            color: "var(--color-orange-400)",
          }}
        >
          {value === null ? "—" : value}
        </span>
        <span
          className="text-caption"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {value === null ? "Slide to rate" : performanceAnchor(value)}
        </span>
      </div>

      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--color-orange-500)" }}
      />
      <div
        className="flex justify-between text-micro"
        style={{ color: "var(--color-text-muted)" }}
      >
        <span>1 Rough day</span>
        <span>5 Solid</span>
        <span>10 Lights out</span>
      </div>
    </div>
  );
}

function WentWellScreen({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="text-title">What went well?</h1>
        <p
          className="text-caption mt-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Lead with the positive. Skip if nothing comes to mind.
        </p>
      </div>
      <Textarea
        value={value}
        onChange={onChange}
        placeholder="e.g. Quick reads on Cover 2, scramble decisions, ball placement"
      />
    </div>
  );
}

function StrugglesScreen({
  text,
  tags,
  onTextChange,
  onToggleTag,
}: {
  text: string;
  tags: string[];
  onTextChange: (v: string) => void;
  onToggleTag: (tag: string) => void;
}) {
  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="text-title">What did you struggle with?</h1>
        <p
          className="text-caption mt-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Tag what came up. Add detail if you want.
        </p>
      </div>
      <Textarea
        value={text}
        onChange={onTextChange}
        placeholder="e.g. Couldn't read Cover 3 cloud, late on the dig route"
      />
      <Field label="Tags">
        <div className="flex gap-sm flex-wrap">
          {STRUGGLE_TAGS.map((tag) => (
            <Pill
              key={tag.value}
              selected={tags.includes(tag.value)}
              onClick={() => onToggleTag(tag.value)}
            >
              {tag.label}
            </Pill>
          ))}
        </div>
      </Field>
    </div>
  );
}

function BodyFeelScreen({
  arm,
  legs,
  energy,
  onChange,
}: {
  arm: number | null;
  legs: number | null;
  energy: number | null;
  onChange: (
    field: "armFeel" | "legsFeel" | "energy",
    value: number,
  ) => void;
}) {
  return (
    <div className="flex flex-col gap-xl">
      <div>
        <h1 className="text-title">How does your body feel?</h1>
        <p
          className="text-caption mt-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Right now, post-game.
        </p>
      </div>
      <FeelSlider
        label="Arm / Elbow"
        value={arm}
        onChange={(v) => onChange("armFeel", v)}
      />
      <FeelSlider
        label="Legs / Mobility"
        value={legs}
        onChange={(v) => onChange("legsFeel", v)}
      />
      <FeelSlider
        label="Overall Energy"
        value={energy}
        onChange={(v) => onChange("energy", v)}
      />
    </div>
  );
}

function FocusScreen({
  value,
  onChange,
  recent,
}: {
  value: string;
  onChange: (v: string) => void;
  recent: string[];
}) {
  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="text-title">One thing to focus on this week</h1>
        <p
          className="text-caption mt-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Make it specific. This becomes your weekly focus card.
        </p>
      </div>
      <Textarea
        value={value}
        onChange={onChange}
        placeholder="e.g. Run through the full progression before scrambling"
      />

      {recent.length > 0 && (
        <div className="flex flex-col gap-sm">
          <span
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Recent focuses
          </span>
          {recent.map((focus, i) => (
            <div
              key={i}
              className="rounded-md p-md text-caption"
              style={{
                backgroundColor: "var(--color-surface-base)",
                border: "1px solid var(--color-border-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              {focus}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeelSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  const shown = value ?? 5;
  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-baseline justify-between">
        <span
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {label}
        </span>
        <span
          className="text-stat tabular-nums"
          style={{ color: "var(--color-text-primary)" }}
        >
          {value === null ? "—" : value}
          <span
            className="text-caption ml-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {value === null ? "" : feelAnchor(value)}
          </span>
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--color-orange-500)" }}
      />
      <div
        className="flex justify-between text-micro"
        style={{ color: "var(--color-text-muted)" }}
      >
        <span>1 Terrible</span>
        <span>5 Okay</span>
        <span>10 Great</span>
      </div>
    </div>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-sm justify-center">
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md px-md text-body outline-none"
      style={{
        height: "44px",
        backgroundColor: "var(--color-surface-base)",
        border: "1px solid var(--color-border-default)",
        color: "var(--color-text-primary)",
      }}
    />
  );
}

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Pick a date";

  function openPicker(el: HTMLInputElement | null) {
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // fall through to focus+click
      }
    }
    el.focus();
    el.click();
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        const input = (e.currentTarget.querySelector(
          'input[type="date"]',
        ) as HTMLInputElement | null);
        openPicker(input);
      }}
      className="w-full rounded-md px-md text-body text-left flex items-center justify-between relative overflow-hidden"
      style={{
        height: "44px",
        backgroundColor: "var(--color-surface-base)",
        border: "1px solid var(--color-border-default)",
        color: "var(--color-text-primary)",
      }}
    >
      <span>{display}</span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        style={{ color: "var(--color-text-secondary)" }}
      >
        <rect
          x="2.5"
          y="3.5"
          width="11"
          height="10"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="M2.5 6.5H13.5"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="M5.5 2.5V4.5M10.5 2.5V4.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label="Date"
      />
    </button>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full rounded-md px-md py-md text-body outline-none resize-none"
      style={{
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
