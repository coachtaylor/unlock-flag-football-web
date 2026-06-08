"use client";

// AI plan generator — input dialog. Styled in the --uff-* console idiom to
// match the practice planner it launches from (w-card surfaces, mono
// numerals, orange-tint selected chips, .wbtn CTA).

import { useState } from "react";
import Link from "next/link";
import { scoreToGrade } from "@/lib/dashboard/heat-scale";
import { Icon } from "@/components/uff/icons";
import type { GeneratePageData } from "./generate-view-types";

const MINUTE_STEP = 15;
const MIN_MINUTES = 30;
const MAX_MINUTES = 180;

const MONO = "var(--font-mono, 'JetBrains Mono', monospace)";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: "var(--uff-text-mute)",
      }}
    >
      {children}
    </div>
  );
}

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
    <div style={{ maxWidth: 680, margin: "0 auto", width: "100%" }}>
      {/* Intro */}
      <div className="w-card hero" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              display: "grid",
              placeItems: "center",
              background: "rgba(255,106,26,0.14)",
              border: "1px solid rgba(255,106,26,0.32)",
              color: "var(--uff-orange)",
            }}
          >
            <Icon.bolt size={15} />
          </span>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--uff-text)" }}>
            Generate a practice plan
          </div>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--uff-text-dim)", margin: 0 }}>
          We&apos;ll draft a plan from your team&apos;s scouting weaknesses and drill library. You can
          tweak every block before saving.
        </p>
      </div>

      <div className="w-card" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* Time */}
        <section>
          <SectionLabel>Total time</SectionLabel>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 14 }}>
            <StepperButton
              label="Decrease time"
              disabled={minutes <= MIN_MINUTES}
              onClick={() => setMinutes((m) => Math.max(MIN_MINUTES, m - MINUTE_STEP))}
            >
              −
            </StepperButton>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "var(--uff-text)",
                minWidth: 96,
                textAlign: "center",
              }}
            >
              {minutes}
              <span style={{ fontSize: 14, color: "var(--uff-text-mute)", fontWeight: 600 }}> min</span>
            </span>
            <StepperButton
              label="Increase time"
              disabled={minutes >= MAX_MINUTES}
              onClick={() => setMinutes((m) => Math.min(MAX_MINUTES, m + MINUTE_STEP))}
            >
              +
            </StepperButton>
          </div>
        </section>

        <Hairline />

        {/* Format */}
        <section>
          <SectionLabel>Format</SectionLabel>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            {(["5v5", "7v7"] as const).map((f) => (
              <Chip key={f} on={format === f} onClick={() => setFormat(f)}>
                {f}
              </Chip>
            ))}
          </div>
        </section>

        <Hairline />

        {/* Skills */}
        <section>
          <SectionLabel>Target skills</SectionLabel>
          {hasSkills ? (
            <>
              <p style={{ marginTop: 6, fontSize: 12, color: "var(--uff-text-mute)", lineHeight: 1.4 }}>
                Leave empty to target your team&apos;s biggest weaknesses automatically.
              </p>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {data.availableSkills.map((s) => {
                  const on = selected.includes(s.skillId);
                  const grade = scoreToGrade(s.avgScore);
                  return (
                    <button
                      key={s.skillId}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSkill(s.skillId)}
                      style={{
                        appearance: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: on ? "#5C3308" : "var(--uff-surface-2)",
                        border: on ? "1px solid var(--uff-orange)" : "1px solid var(--uff-line-soft)",
                        transition: "background .12s, border-color .12s",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 10,
                          fontSize: 14,
                          fontWeight: 600,
                          color: on ? "#F0B870" : "var(--uff-text)",
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 5,
                            display: "grid",
                            placeItems: "center",
                            border: on ? "1px solid #F0B870" : "1px solid var(--uff-line)",
                            background: on ? "#F0B870" : "transparent",
                            color: "#3a2206",
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {on ? "✓" : ""}
                        </span>
                        {s.skillName}
                      </span>
                      {grade && <GradeChip grade={grade} dimmed={!on} />}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div
              className="w-card subdued"
              style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}
            >
              <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-dim)", lineHeight: 1.5 }}>
                No scouting data yet. Run a benchmark to unlock AI plan generation.
              </p>
              <Link
                href={`/dashboard/team/${data.teamId}/benchmarks`}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--uff-orange)",
                  textDecoration: "none",
                }}
              >
                Go to benchmarks →
              </Link>
            </div>
          )}
        </section>

        {error && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--uff-orange)" }}>{error}</p>
        )}

        <button
          type="button"
          className="wbtn primary"
          disabled={pending || !hasSkills}
          onClick={() => onGenerate({ totalMinutes: minutes, format, skillIds: selected })}
          style={{ height: 46, justifyContent: "center", fontSize: 14 }}
        >
          {pending ? "Generating…" : (<><Icon.bolt size={14} /> Generate plan</>)}
        </button>
      </div>
    </div>
  );
}

function StepperButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 42,
        height: 42,
        borderRadius: 11,
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line)",
        color: "var(--uff-text)",
        fontSize: 22,
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "grid",
        placeItems: "center",
        transition: "background .12s",
      }}
    >
      {children}
    </button>
  );
}

function Chip({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="rounded-pill"
      style={{
        padding: "8px 16px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background .12s, border-color .12s, color .12s",
        ...(on
          ? { background: "#5C3308", color: "#F0B870", border: "1px solid #D48A30" }
          : {
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.45)",
              border: "1px solid rgba(255,255,255,0.08)",
            }),
      }}
    >
      {children}
    </button>
  );
}

function GradeChip({ grade, dimmed }: { grade: string; dimmed?: boolean }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".06em",
        color: "var(--uff-text-mute)",
        opacity: dimmed ? 0.8 : 1,
      }}
    >
      {grade}
    </span>
  );
}

function Hairline() {
  return <div style={{ height: 1, background: "var(--uff-line-soft)" }} />;
}
