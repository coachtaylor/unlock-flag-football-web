"use client";

// AI plan generator — guided 5-step wizard (Basics → Blocks → Skills → Density
// → Review), styled in the --uff-* console idiom to match the practice planner.
// Stays on one page; the footer drives a linear step machine. Step 5's Next is
// "Generate" and hands a full WizardInput (minus teamId) to onGenerate.

import { useState } from "react";
import Link from "next/link";
import { scoreToGrade } from "@/lib/dashboard/heat-scale";
import { Icon } from "@/components/uff/icons";
import { PHASE_CATS, WEB_CAT_DEFS, type CatSlug } from "@/components/uff-web/drills/atoms";
import type { WizardInput, TargetSkill, CustomBlockSpec } from "@/lib/practice/generate/types";
import type { GeneratePageData } from "./generate-view-types";

type WizardValue = Omit<WizardInput, "teamId">;
type Step = 1 | 2 | 3 | 4 | 5;
const LABELS: Record<Step, string> = { 1: "Basics", 2: "Blocks", 3: "Skills", 4: "Density", 5: "Review" };

const MINUTE_STEP = 15;
const MIN_MINUTES = 30;
const MAX_MINUTES = 180;
const MIN_DRILLS = 1;
const MAX_DRILLS = 4;
const MONO = "var(--font-mono, 'JetBrains Mono', monospace)";

export default function GenerateWizard({
  data,
  pending,
  error,
  onGenerate,
}: {
  data: GeneratePageData;
  pending: boolean;
  error: string | null;
  onGenerate: (input: WizardValue) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [v, setV] = useState<WizardValue>({
    title: data.defaultTitle,
    practiceDate: data.defaultDate,
    totalMinutes: data.defaultMinutes,
    format: data.defaultFormat,
    includeWarmup: true,
    includeSkills: true,
    includeTeamSituational: true,
    customBlocks: [],
    skills: [],
    drillsPerBlock: 2,
    autoWaterBreaks: true,
  });

  // Skill step is skipped entirely when the Skills block is turned off.
  const order: Step[] = v.includeSkills ? [1, 2, 3, 4, 5] : [1, 2, 4, 5];
  const idx = order.indexOf(step);
  const isLast = idx === order.length - 1;
  const patch = (p: Partial<WizardValue>) => setV((s) => ({ ...s, ...p }));

  const hasAnyBlock = v.includeWarmup || v.includeSkills || v.includeTeamSituational || v.customBlocks.length > 0;
  const nextDisabled =
    (step === 1 && !v.title.trim()) || (step === 2 && !hasAnyBlock);

  const goNext = () => {
    if (nextDisabled) return;
    if (isLast) onGenerate(v);
    else setStep(order[idx + 1]);
  };
  const goBack = () => {
    if (idx > 0) setStep(order[idx - 1]);
  };

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
            Build a practice plan
          </div>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--uff-text-dim)", margin: 0 }}>
          A few quick choices and we&apos;ll draft a complete plan — every block filled from your drill
          library and scouting weaknesses, with water breaks scheduled automatically.
        </p>
      </div>

      {/* Stepper */}
      <Stepper order={order} current={step} />

      <div className="w-card" style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 14 }}>
        {step === 1 && <BasicsStep v={v} patch={patch} />}
        {step === 2 && <BlocksStep v={v} patch={patch} />}
        {step === 3 && <SkillsStep v={v} patch={patch} data={data} />}
        {step === 4 && <DensityStep v={v} patch={patch} />}
        {step === 5 && <ReviewStep v={v} />}

        {error && <p style={{ margin: 0, fontSize: 13, color: "var(--uff-orange)" }}>{error}</p>}

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            className="wbtn ghost"
            onClick={goBack}
            disabled={idx === 0 || pending}
            style={{ height: 44, opacity: idx === 0 ? 0.4 : 1 }}
          >
            Back
          </button>
          <div style={{ fontSize: 11, color: "var(--uff-text-mute)", fontFamily: MONO }}>
            {idx + 1} / {order.length}
          </div>
          <button
            type="button"
            className="wbtn primary"
            onClick={goNext}
            disabled={nextDisabled || pending}
            style={{ height: 44, justifyContent: "center", minWidth: 140 }}
          >
            {isLast ? (
              pending ? "Generating…" : (<><Icon.bolt size={14} /> Generate</>)
            ) : (
              "Next"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Steps
// --------------------------------------------------------------------------

function BasicsStep({ v, patch }: { v: WizardValue; patch: (p: Partial<WizardValue>) => void }) {
  return (
    <>
      <section>
        <SectionLabel>Title</SectionLabel>
        <input
          className="fr-input"
          value={v.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Sunday practice"
          style={{ marginTop: 10, width: "100%" }}
        />
      </section>
      <Hairline />
      <section>
        <SectionLabel>Date</SectionLabel>
        <input
          type="date"
          className="fr-input"
          value={v.practiceDate}
          onChange={(e) => patch({ practiceDate: e.target.value })}
          style={{ marginTop: 10, width: "100%" }}
        />
      </section>
      <Hairline />
      <section>
        <SectionLabel>Total time</SectionLabel>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 14 }}>
          <StepperButton
            label="Decrease time"
            disabled={v.totalMinutes <= MIN_MINUTES}
            onClick={() => patch({ totalMinutes: Math.max(MIN_MINUTES, v.totalMinutes - MINUTE_STEP) })}
          >
            −
          </StepperButton>
          <MonoStat value={v.totalMinutes} unit="min" />
          <StepperButton
            label="Increase time"
            disabled={v.totalMinutes >= MAX_MINUTES}
            onClick={() => patch({ totalMinutes: Math.min(MAX_MINUTES, v.totalMinutes + MINUTE_STEP) })}
          >
            +
          </StepperButton>
        </div>
      </section>
      <Hairline />
      <section>
        <SectionLabel>Format</SectionLabel>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          {(["5v5", "7v7"] as const).map((f) => (
            <Chip key={f} on={v.format === f} onClick={() => patch({ format: f })}>
              {f}
            </Chip>
          ))}
        </div>
      </section>
    </>
  );
}

function BlocksStep({ v, patch }: { v: WizardValue; patch: (p: Partial<WizardValue>) => void }) {
  const setCustom = (next: CustomBlockSpec[]) => patch({ customBlocks: next });
  const addCustom = () => setCustom([...v.customBlocks, { name: "", source: "conditioning", share: 1 }]);
  const updateCustom = (i: number, p: Partial<CustomBlockSpec>) =>
    setCustom(v.customBlocks.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const removeCustom = (i: number) => setCustom(v.customBlocks.filter((_, j) => j !== i));

  return (
    <>
      <section>
        <SectionLabel>Core blocks</SectionLabel>
        <p style={{ marginTop: 6, fontSize: 12, color: "var(--uff-text-mute)", lineHeight: 1.4 }}>
          Ordered warm-up → skills → team / situational. Toggle off anything you don&apos;t need.
        </p>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <ToggleRow on={v.includeWarmup} onClick={() => patch({ includeWarmup: !v.includeWarmup })} label="Warm-up" hint="Activation & movement prep" />
          <ToggleRow on={v.includeSkills} onClick={() => patch({ includeSkills: !v.includeSkills })} label="Skills" hint="Targeted skill work from scouting" />
          <ToggleRow on={v.includeTeamSituational} onClick={() => patch({ includeTeamSituational: !v.includeTeamSituational })} label="Team / Situational" hint="Offense, defense & scrimmage" />
        </div>
      </section>
      <Hairline />
      <section>
        <SectionLabel>Custom blocks</SectionLabel>
        {v.customBlocks.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {v.customBlocks.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "var(--uff-surface-2)",
                  border: "1px solid var(--uff-line-soft)",
                }}
              >
                <input
                  className="fr-input"
                  value={c.name}
                  onChange={(e) => updateCustom(i, { name: e.target.value })}
                  placeholder="Block name"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <select
                  className="fr-input"
                  value={c.source}
                  onChange={(e) => updateCustom(i, { source: e.target.value as CatSlug | "manual" })}
                  style={{ width: 140 }}
                >
                  {PHASE_CATS.map((slug) => (
                    <option key={slug} value={slug}>
                      {WEB_CAT_DEFS[slug].label}
                    </option>
                  ))}
                  <option value="manual">Manual (no fill)</option>
                </select>
                <button
                  type="button"
                  aria-label="Remove block"
                  onClick={() => removeCustom(i)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    flexShrink: 0,
                    background: "transparent",
                    border: "1px solid var(--uff-line)",
                    color: "var(--uff-text-mute)",
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="wbtn ghost"
          onClick={addCustom}
          style={{ marginTop: 12, height: 40 }}
        >
          + Add block
        </button>
      </section>
    </>
  );
}

function SkillsStep({
  v,
  patch,
  data,
}: {
  v: WizardValue;
  patch: (p: Partial<WizardValue>) => void;
  data: GeneratePageData;
}) {
  const selectedIds = new Set(v.skills.map((s) => s.skillId));
  const toggle = (s: TargetSkill) =>
    patch({
      skills: selectedIds.has(s.skillId)
        ? v.skills.filter((x) => x.skillId !== s.skillId)
        : [...v.skills, s],
    });

  if (data.availableSkills.length === 0) {
    return (
      <section>
        <SectionLabel>Target skills</SectionLabel>
        <div className="w-card subdued" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-dim)", lineHeight: 1.5 }}>
            No scouting data yet. Run a benchmark to unlock targeted skill work — or just generate with
            warm-up and team blocks.
          </p>
          <Link
            href={`/dashboard/team/${data.teamId}/benchmarks`}
            style={{ fontSize: 13, fontWeight: 600, color: "var(--uff-orange)", textDecoration: "none" }}
          >
            Go to benchmarks →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionLabel>Target skills</SectionLabel>
      <p style={{ marginTop: 6, fontSize: 12, color: "var(--uff-text-mute)", lineHeight: 1.4 }}>
        Leave empty to target your team&apos;s biggest weaknesses automatically.
      </p>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {data.availableSkills.map((s) => {
          const on = selectedIds.has(s.skillId);
          const grade = scoreToGrade(s.avgScore);
          return (
            <button
              key={s.skillId}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s)}
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
                <CheckBox on={on} />
                {s.skillName}
              </span>
              {grade && <GradeChip grade={grade} dimmed={!on} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DensityStep({ v, patch }: { v: WizardValue; patch: (p: Partial<WizardValue>) => void }) {
  return (
    <>
      <section>
        <SectionLabel>Drills per block</SectionLabel>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 14 }}>
          <StepperButton
            label="Fewer drills"
            disabled={v.drillsPerBlock <= MIN_DRILLS}
            onClick={() => patch({ drillsPerBlock: Math.max(MIN_DRILLS, v.drillsPerBlock - 1) })}
          >
            −
          </StepperButton>
          <MonoStat value={v.drillsPerBlock} unit={v.drillsPerBlock === 1 ? "drill" : "drills"} />
          <StepperButton
            label="More drills"
            disabled={v.drillsPerBlock >= MAX_DRILLS}
            onClick={() => patch({ drillsPerBlock: Math.min(MAX_DRILLS, v.drillsPerBlock + 1) })}
          >
            +
          </StepperButton>
        </div>
      </section>
      <Hairline />
      <section>
        <SectionLabel>Water breaks</SectionLabel>
        <div style={{ marginTop: 10 }}>
          <ToggleRow
            on={v.autoWaterBreaks}
            onClick={() => patch({ autoWaterBreaks: !v.autoWaterBreaks })}
            label="Auto water breaks"
            hint="A 3-minute break roughly every 30 minutes"
          />
        </div>
      </section>
    </>
  );
}

function ReviewStep({ v }: { v: WizardValue }) {
  const blocks: string[] = [];
  if (v.includeWarmup) blocks.push("Warm-up");
  if (v.includeSkills) blocks.push(v.skills.length ? `Skills (${v.skills.length})` : "Skills (auto)");
  if (v.includeTeamSituational) blocks.push("Team / Situational");
  v.customBlocks.forEach((c) => blocks.push(c.name.trim() || "Custom block"));

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLabel>Review</SectionLabel>
      <ReviewRow label="Title" value={v.title.trim() || "Practice"} />
      <ReviewRow label="Date" value={v.practiceDate} mono />
      <ReviewRow label="Length" value={`${v.totalMinutes} min`} mono />
      <ReviewRow label="Format" value={v.format} mono />
      <ReviewRow label="Blocks" value={blocks.join("  →  ")} />
      <ReviewRow label="Drills / block" value={String(v.drillsPerBlock)} mono />
      <ReviewRow label="Water breaks" value={v.autoWaterBreaks ? "On" : "Off"} />
    </section>
  );
}

// --------------------------------------------------------------------------
// Presentational atoms (local — single consumer is this wizard)
// --------------------------------------------------------------------------

function Stepper({ order, current }: { order: Step[]; current: Step }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {order.map((s) => {
        const active = s === current;
        const done = order.indexOf(s) < order.indexOf(current);
        return (
          <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                height: 3,
                borderRadius: 2,
                background: active || done ? "var(--uff-orange)" : "var(--uff-line)",
                transition: "background .15s",
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: active ? "var(--uff-text)" : "var(--uff-text-mute)",
              }}
            >
              {LABELS[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

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

function MonoStat({ value, unit }: { value: number; unit: string }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: "var(--uff-text)",
        minWidth: 110,
        textAlign: "center",
      }}
    >
      {value}
      <span style={{ fontSize: 14, color: "var(--uff-text-mute)", fontWeight: 600 }}> {unit}</span>
    </span>
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

function ToggleRow({
  on,
  onClick,
  label,
  hint,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
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
        width: "100%",
        background: on ? "#5C3308" : "var(--uff-surface-2)",
        border: on ? "1px solid var(--uff-orange)" : "1px solid var(--uff-line-soft)",
        transition: "background .12s, border-color .12s",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: on ? "#F0B870" : "var(--uff-text)" }}>{label}</span>
        <span style={{ fontSize: 11.5, color: "var(--uff-text-mute)" }}>{hint}</span>
      </span>
      <span
        aria-hidden
        style={{
          width: 38,
          height: 22,
          borderRadius: 999,
          flexShrink: 0,
          background: on ? "#D48A30" : "var(--uff-line)",
          position: "relative",
          transition: "background .12s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: on ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left .12s",
          }}
        />
      </span>
    </button>
  );
}

function CheckBox({ on }: { on: boolean }) {
  return (
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

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
      <span style={{ fontSize: 12, color: "var(--uff-text-mute)" }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--uff-text)",
          textAlign: "right",
          fontFamily: mono ? MONO : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Hairline() {
  return <div style={{ height: 1, background: "var(--uff-line-soft)" }} />;
}
