"use client";

import { useState } from "react";
import Link from "next/link";
import { scoreToGrade } from "@/lib/dashboard/heat-scale";
import type { GeneratePageData } from "./generate-view-types";

const MINUTE_STEP = 15;
const MIN_MINUTES = 30;
const MAX_MINUTES = 180;

export default function GenerateDialog({
  data,
  pending,
  error,
  onGenerate,
}: {
  data: GeneratePageData;
  pending: boolean;
  error: string | null;
  onGenerate: (input: { totalMinutes: number; format: "5v5" | "7v7"; skillIds: string[] }) => void;
}) {
  const [minutes, setMinutes] = useState(data.defaultMinutes);
  const [format, setFormat] = useState<"5v5" | "7v7">(data.defaultFormat);
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSkill = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const hasSkills = data.availableSkills.length > 0;

  return (
    <div className="mx-auto max-w-[640px] px-xl py-2xl">
      <h1 className="text-title font-medium text-text-primary">Generate a practice plan</h1>
      <p className="mt-xs text-body text-text-secondary">
        We&apos;ll draft a plan from your team&apos;s scouting weaknesses and drill library. You can tweak every block
        before saving.
      </p>

      {/* Time */}
      <section className="mt-2xl">
        <div className="label-micro text-text-muted">Total time</div>
        <div className="mt-sm flex items-center gap-md">
          <button
            type="button"
            onClick={() => setMinutes((m) => Math.max(MIN_MINUTES, m - MINUTE_STEP))}
            className="h-11 w-11 rounded-lg bg-surface-raised text-heading text-text-primary"
            aria-label="Decrease time"
          >
            −
          </button>
          <span className="text-stat font-medium tabular-nums text-text-primary">{minutes} min</span>
          <button
            type="button"
            onClick={() => setMinutes((m) => Math.min(MAX_MINUTES, m + MINUTE_STEP))}
            className="h-11 w-11 rounded-lg bg-surface-raised text-heading text-text-primary"
            aria-label="Increase time"
          >
            +
          </button>
        </div>
      </section>

      {/* Format */}
      <section className="mt-2xl">
        <div className="label-micro text-text-muted">Format</div>
        <div className="mt-sm flex gap-sm">
          {(["5v5", "7v7"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={format === f}
              onClick={() => setFormat(f)}
              className="rounded-pill px-[14px] py-[8px] text-caption font-medium transition-all"
              style={
                format === f
                  ? { backgroundColor: "#5C3308", color: "#F0B870", border: "1px solid #D48A30" }
                  : {
                      backgroundColor: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.45)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }
              }
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section className="mt-2xl">
        <div className="label-micro text-text-muted">Target skills</div>
        {hasSkills ? (
          <>
            <p className="mt-xs text-caption text-text-muted">
              Leave empty to target your team&apos;s biggest weaknesses automatically.
            </p>
            <div className="mt-sm flex flex-col gap-xs">
              {data.availableSkills.map((s) => {
                const on = selected.includes(s.skillId);
                return (
                  <button
                    key={s.skillId}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSkill(s.skillId)}
                    className="flex items-center justify-between rounded-lg p-lg text-left transition-all"
                    style={{
                      backgroundColor: on ? "#5C3308" : "var(--surface-raised, #161C24)",
                      border: on ? "1px solid #D48A30" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span className="text-body" style={{ color: on ? "#F0B870" : undefined }}>
                      {s.skillName}
                    </span>
                    <span className="label-micro text-text-muted">{scoreToGrade(s.avgScore) ?? "—"}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-sm rounded-lg border border-border-subtle bg-surface-base p-lg">
            <p className="text-body text-text-secondary">
              No scouting data yet. Run a benchmark to unlock AI plan generation.
            </p>
            <Link
              href={`/dashboard/team/${data.teamId}/benchmarks`}
              className="mt-sm inline-block text-caption font-medium text-orange-400"
            >
              Go to benchmarks →
            </Link>
          </div>
        )}
      </section>

      {error && <p className="mt-lg text-caption text-orange-400">{error}</p>}

      <button
        type="button"
        disabled={pending || !hasSkills}
        onClick={() => onGenerate({ totalMinutes: minutes, format, skillIds: selected })}
        className="mt-2xl w-full rounded-xl py-lg text-body font-medium tracking-wide disabled:opacity-50"
        style={{ backgroundColor: "#D48A30", color: "#FFFFFF", letterSpacing: "0.3px" }}
      >
        {pending ? "Generating…" : "Generate plan"}
      </button>
    </div>
  );
}
