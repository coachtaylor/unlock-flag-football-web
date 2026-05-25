"use client";

// PAUSED: Individual QB tracking is on hold while the Coach/Team MVP is the focus.
// This route is no longer linked from the bottom nav. Preserved for resumption.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Intensity = "Low" | "Medium" | "High";
type Mechanics = "Rough" | "Okay" | "Smooth" | "Locked In";
type HipUse = "Forgot" | "Sometimes" | "Mostly" | "Every Throw";

const INTENSITY_OPTIONS: { label: Intensity; value: number }[] = [
  { label: "Low", value: 30 },
  { label: "Medium", value: 60 },
  { label: "High", value: 90 },
];

const MECHANICS_OPTIONS: { label: Mechanics; value: number }[] = [
  { label: "Rough", value: 3 },
  { label: "Okay", value: 5 },
  { label: "Smooth", value: 7 },
  { label: "Locked In", value: 9 },
];

const HIP_USE_OPTIONS: { label: HipUse; value: number }[] = [
  { label: "Forgot", value: 2 },
  { label: "Sometimes", value: 5 },
  { label: "Mostly", value: 7 },
  { label: "Every Throw", value: 10 },
];

function todayIso() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function painAnchor(value: number) {
  if (value === 0) return "None";
  if (value <= 3) return "Noticeable";
  if (value <= 5) return "Moderate";
  if (value <= 7) return "Significant";
  return "Severe";
}

export default function ThrowingLog() {
  const router = useRouter();
  const [sessionDate, setSessionDate] = useState<string>(todayIso());
  const [totalThrows, setTotalThrows] = useState<string>("");
  const [painAfter, setPainAfter] = useState<number>(0);

  const [showDetails, setShowDetails] = useState(false);
  const [painBefore, setPainBefore] = useState<number | null>(null);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [mechanics, setMechanics] = useState<number | null>(null);
  const [hipUse, setHipUse] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const throwsNumber = Number(totalThrows);
  const canSave =
    !saving &&
    sessionDate.length > 0 &&
    totalThrows.trim().length > 0 &&
    Number.isFinite(throwsNumber) &&
    throwsNumber > 0;

  async function handleSave() {
    setError(null);
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setSaving(false);
      router.replace("/login");
      return;
    }

    const { error: insertError } = await supabase.from("throwing_sessions").insert({
      user_id: user.id,
      session_date: sessionDate,
      total_throws: throwsNumber,
      post_throw_elbow_pain: painAfter,
      pre_throw_elbow_pain: painBefore,
      average_intensity_percent: intensity,
      mechanics_quality: mechanics,
      hip_use_quality: hipUse,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.replace("/");
  }

  return (
    <div className="px-xl pt-3xl pb-3xl">
      <h1 className="text-title" style={{ color: "var(--color-text-primary)" }}>
        Throwing Session
      </h1>
      <p
        className="text-caption mt-xs"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Track your throws and manage pain.
      </p>

      <div
        className="mt-2xl rounded-lg p-lg flex flex-col gap-xl"
        style={{ backgroundColor: "var(--color-surface-raised)" }}
      >
        <Field label="Date">
          <DateInput value={sessionDate} onChange={setSessionDate} />
        </Field>

        <Field label="Total throws">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={totalThrows}
            onChange={(e) => setTotalThrows(e.target.value)}
            placeholder="e.g. 50"
            className="w-full rounded-md px-md text-body outline-none tabular-nums"
            style={{
              height: "44px",
              backgroundColor: "var(--color-surface-base)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
            }}
          />
        </Field>

        <PainSlider
          label="Elbow pain after throwing"
          value={painAfter}
          onChange={setPainAfter}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((s) => !s)}
        className="mt-lg flex items-center gap-xs text-caption font-medium"
        style={{ color: "var(--color-text-secondary)" }}
        aria-expanded={showDetails}
      >
        <span>{showDetails ? "Hide details" : "Add details"}</span>
        <Chevron rotated={showDetails} />
      </button>

      {showDetails && (
        <div
          className="mt-md rounded-lg p-lg flex flex-col gap-xl"
          style={{ backgroundColor: "var(--color-surface-raised)" }}
        >
          <PainSlider
            label="Elbow pain before throwing"
            value={painBefore ?? 0}
            displayValue={painBefore}
            onChange={setPainBefore}
          />

          <PillField
            label="Intensity"
            options={INTENSITY_OPTIONS}
            selectedValue={intensity}
            onSelect={setIntensity}
          />

          <PillField
            label="Mechanics quality"
            options={MECHANICS_OPTIONS}
            selectedValue={mechanics}
            onSelect={setMechanics}
          />

          <PillField
            label="Hip-use quality"
            options={HIP_USE_OPTIONS}
            selectedValue={hipUse}
            onSelect={setHipUse}
          />
        </div>
      )}

      {error && (
        <p
          className="mt-lg text-caption"
          style={{ color: "var(--color-error-light)" }}
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full py-lg rounded-xl text-body font-medium tracking-wide mt-2xl transition-opacity"
        style={{
          backgroundColor: "var(--color-orange-500)",
          color: "#FFFFFF",
          letterSpacing: "0.3px",
          opacity: canSave ? 1 : 0.6,
        }}
      >
        {saving ? "Saving…" : "Save Session"}
      </button>
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
        <path d="M2.5 6.5H13.5" stroke="currentColor" strokeWidth="1.2" />
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

function PainSlider({
  label,
  value,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  displayValue?: number | null;
  onChange: (n: number) => void;
}) {
  const shown = displayValue ?? value;
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
          {shown === null ? "—" : shown}
          <span
            className="text-caption ml-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {shown === null ? "" : painAnchor(shown)}
          </span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--color-orange-500)" }}
      />
      <div
        className="flex justify-between text-micro tabular-nums"
        style={{ color: "var(--color-text-muted)" }}
      >
        <span>0 None</span>
        <span>3</span>
        <span>5 Mod</span>
        <span>7</span>
        <span>10 Severe</span>
      </div>
    </div>
  );
}

function PillField<T extends { label: string; value: number }>({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  options: T[];
  selectedValue: number | null;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-sm">
      <span
        className="label-micro"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {label}
      </span>
      <div className="flex gap-sm flex-wrap">
        {options.map((opt) => {
          const selected = selectedValue === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(opt.value)}
              className="rounded-pill text-caption font-medium transition-all"
              style={{
                minHeight: 44,
                padding: "8px 14px",
                backgroundColor: selected
                  ? "#5C3308"
                  : "rgba(255,255,255,0.04)",
                color: selected ? "#F0B870" : "rgba(255,255,255,0.45)",
                border: `1px solid ${selected ? "var(--color-orange-500)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chevron({ rotated }: { rotated: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{
        transform: rotated ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 150ms ease",
      }}
      aria-hidden
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
