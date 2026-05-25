"use client";

// PAUSED: Individual QB tracking is on hold while the Coach/Team MVP is the focus.
// This route is no longer linked from the bottom nav. Preserved for resumption.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type SliderConfig = {
  key: "sleep_quality" | "stress" | "elbow_pain_rest";
  label: string;
  min: number;
  max: number;
  default: number;
  anchors: { value: number; label: string }[];
};

const SLIDERS: SliderConfig[] = [
  {
    key: "sleep_quality",
    label: "Sleep quality",
    min: 1,
    max: 10,
    default: 7,
    anchors: [
      { value: 1, label: "Poor" },
      { value: 5, label: "Okay" },
      { value: 10, label: "Great" },
    ],
  },
  {
    key: "stress",
    label: "Stress",
    min: 1,
    max: 10,
    default: 5,
    anchors: [
      { value: 1, label: "Low" },
      { value: 5, label: "Moderate" },
      { value: 10, label: "High" },
    ],
  },
  {
    key: "elbow_pain_rest",
    label: "Elbow pain at rest",
    min: 0,
    max: 10,
    default: 0,
    anchors: [
      { value: 0, label: "None" },
      { value: 3, label: "Noticeable" },
      { value: 5, label: "Moderate" },
      { value: 7, label: "Significant" },
      { value: 10, label: "Severe" },
    ],
  },
];

export default function RecoveryCheckIn() {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>({
    sleep_quality: 7,
    stress: 5,
    elbow_pain_rest: 0,
  });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You're not signed in. Try logging in again.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("recovery_logs").insert({
      user_id: user.id,
      sleep_quality: values.sleep_quality,
      stress: values.stress,
      elbow_pain_rest: values.elbow_pain_rest,
      notes: notes.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    router.push("/");
  }

  return (
    <div className="pt-3xl pb-3xl">
      <h1 className="text-title font-medium" style={{ color: "var(--color-text-primary)" }}>
        Recovery Check-in
      </h1>
      <p className="text-caption mt-xs" style={{ color: "var(--color-text-secondary)" }}>
        How are you feeling this week?
      </p>

      <form onSubmit={handleSubmit} className="mt-2xl flex flex-col gap-lg">
        {SLIDERS.map((s) => (
          <div
            key={s.key}
            className="rounded-lg p-lg"
            style={{ backgroundColor: "var(--color-surface-raised)" }}
          >
            <div className="flex items-baseline justify-between mb-md">
              <label
                htmlFor={s.key}
                className="text-heading font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {s.label}
              </label>
              <span
                className="text-stat tabular-nums"
                style={{ color: "var(--color-orange-400)" }}
              >
                {values[s.key]}
              </span>
            </div>

            <input
              id={s.key}
              type="range"
              min={s.min}
              max={s.max}
              step={1}
              value={values[s.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [s.key]: Number(e.target.value) }))
              }
              className="recovery-slider w-full"
              style={
                {
                  "--fill":
                    ((values[s.key] - s.min) / (s.max - s.min)) * 100 + "%",
                } as React.CSSProperties
              }
            />

            <div className="flex justify-between mt-sm">
              {s.anchors.map((a) => (
                <span
                  key={a.value}
                  className="text-micro"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {a.value} {a.label}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div
          className="rounded-lg p-lg"
          style={{ backgroundColor: "var(--color-surface-raised)" }}
        >
          <label
            htmlFor="notes"
            className="label-micro block mb-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anything worth remembering this week?"
            className="w-full rounded-md px-md py-sm text-body outline-none resize-none"
            style={{
              backgroundColor: "var(--color-surface-base)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>

        {error && (
          <p className="text-caption" style={{ color: "var(--color-error-light)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-lg rounded-xl text-body font-medium tracking-wide transition-opacity"
          style={{
            backgroundColor: "var(--color-orange-500)",
            color: "#FFFFFF",
            letterSpacing: "0.3px",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      </form>

      <style jsx>{`
        .recovery-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 9999px;
          background: linear-gradient(
            to right,
            var(--color-orange-500) 0%,
            var(--color-orange-500) var(--fill),
            var(--color-border-default) var(--fill),
            var(--color-border-default) 100%
          );
          outline: none;
          cursor: pointer;
        }
        .recovery-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          background: var(--color-orange-500);
          border: none;
          cursor: pointer;
        }
        .recovery-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          background: var(--color-orange-500);
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
