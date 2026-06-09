"use client";

// AI plan generator — guided 5-step wizard (Basics → Blocks → Skills → Density
// → Review), styled in the --uff-* console idiom to match the coach console.
// Stays on one page; a numbered stepper + footer drive a linear step machine
// (you can jump back to any visited step). Step 5's Next is "Generate" and
// hands a full WizardInput (minus teamId) to onGenerate.

import { Fragment, useState } from "react";
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
  const nextDisabled = (step === 1 && !v.title.trim()) || (step === 2 && !hasAnyBlock);

  const goNext = () => {
    if (nextDisabled) return;
    if (isLast) onGenerate(v);
    else setStep(order[idx + 1]);
  };
  const goBack = () => idx > 0 && setStep(order[idx - 1]);
  // Jump straight to a previously-visited step (stepper nodes + review pencils).
  const goToStep = (s: Step) => {
    const ti = order.indexOf(s);
    if (ti !== -1 && ti <= idx) setStep(s);
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: "rgba(255,106,26,0.14)",
            border: "1px solid rgba(255,106,26,0.32)",
            color: "var(--uff-orange)",
            flexShrink: 0,
          }}
        >
          <Icon.bolt size={16} />
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.015em", color: "var(--uff-text)" }}>
            Build a practice plan
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, lineHeight: 1.45, color: "var(--uff-text-mute)" }}>
            We&apos;ll fill every block from your library &amp; scouting weaknesses — with water breaks.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <Stepper order={order} current={step} onJump={goToStep} />

      <div className="w-card" style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 16, padding: 22 }}>
        {step === 1 && <BasicsStep v={v} patch={patch} />}
        {step === 2 && <BlocksStep v={v} patch={patch} />}
        {step === 3 && <SkillsStep v={v} patch={patch} data={data} />}
        {step === 4 && <DensityStep v={v} patch={patch} />}
        {step === 5 && <ReviewStep v={v} onEdit={goToStep} />}

        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--uff-orange)" }}>
            {error}
          </p>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid var(--uff-line-soft)",
            paddingTop: 18,
            marginTop: 2,
          }}
        >
          <button
            type="button"
            className="wbtn ghost"
            onClick={goBack}
            disabled={idx === 0 || pending}
            style={{ height: 44, opacity: idx === 0 ? 0.4 : 1 }}
          >
            <Icon.arrowLeft size={14} /> Back
          </button>
          <div style={{ fontSize: 11, color: "var(--uff-text-mute)", fontFamily: MONO }}>
            {idx + 1} / {order.length}
          </div>
          <button
            type="button"
            className="wbtn primary"
            onClick={goNext}
            disabled={nextDisabled || pending}
            style={{ height: 44, justifyContent: "center", minWidth: 148 }}
          >
            {isLast ? (
              pending ? "Generating…" : (<><Icon.bolt size={14} /> Generate</>)
            ) : (
              <>Next <Icon.arrowRight size={14} /></>
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
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Field label="Title" style={{ flex: "1 1 220px" }}>
          <input
            className="fr-input"
            value={v.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Sunday practice"
            style={{ width: "100%" }}
          />
        </Field>
        <Field label="Date" style={{ flex: "1 1 160px" }}>
          <input
            type="date"
            className="fr-input"
            value={v.practiceDate}
            onChange={(e) => patch({ practiceDate: e.target.value })}
            style={{ width: "100%" }}
          />
        </Field>
      </div>
      <Hairline />
      <Field label="Total time">
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
      </Field>
      <Hairline />
      <Field label="Format">
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          {(["5v5", "7v7"] as const).map((f) => (
            <Chip key={f} on={v.format === f} onClick={() => patch({ format: f })}>
              {f}
            </Chip>
          ))}
        </div>
      </Field>
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
      <Field label="Core blocks" hint="Ordered warm-up → skills → team / situational. Toggle off what you don't need.">
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <ToggleRow on={v.includeWarmup} onClick={() => patch({ includeWarmup: !v.includeWarmup })} label="Warm-up" hint="Activation & movement prep" />
          <ToggleRow on={v.includeSkills} onClick={() => patch({ includeSkills: !v.includeSkills })} label="Skills" hint="Targeted skill work from scouting" />
          <ToggleRow on={v.includeTeamSituational} onClick={() => patch({ includeTeamSituational: !v.includeTeamSituational })} label="Team / Situational" hint="Offense, defense & scrimmage" />
        </div>
      </Field>
      <Hairline />
      <Field label="Custom blocks" hint="Add a closer like conditioning or agilities.">
        {v.customBlocks.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {v.customBlocks.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 12,
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
                  style={{ width: 148, flexShrink: 0 }}
                  aria-label="Fill from category"
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
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: "transparent",
                    border: "1px solid var(--uff-line)",
                    color: "var(--uff-text-mute)",
                    cursor: "pointer",
                    fontSize: 17,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="wbtn ghost" onClick={addCustom} style={{ marginTop: 12, height: 40 }}>
          <Icon.plus size={13} /> Add block
        </button>
      </Field>
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
      <Field label="Target skills">
        <div className="w-card subdued" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-dim)", lineHeight: 1.5 }}>
            No skills in your library yet. You can still generate with warm-up and team blocks.
          </p>
          <Link
            href={`/dashboard/team/${data.teamId}/benchmarks`}
            style={{ fontSize: 13, fontWeight: 600, color: "var(--uff-orange)", textDecoration: "none" }}
          >
            Go to benchmarks →
          </Link>
        </div>
      </Field>
    );
  }

  // Suggested = the team's weakest measured skills (in weakest-first order).
  const byId = new Map(data.availableSkills.map((s) => [s.skillId, s]));
  const suggested = data.suggestedSkillIds.map((id) => byId.get(id)).filter((s): s is TargetSkill => !!s);
  const suggestedSet = new Set(data.suggestedSkillIds);
  // Everything else: measured (weakest first) then unmeasured (alphabetical).
  const others = data.availableSkills
    .filter((s) => !suggestedSet.has(s.skillId))
    .sort((a, b) => {
      const am = a.avgScore != null, bm = b.avgScore != null;
      if (am !== bm) return am ? -1 : 1;
      if (am && bm) return (a.avgScore as number) - (b.avgScore as number);
      return a.skillName.localeCompare(b.skillName);
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Field
        label={`Target skills${v.skills.length ? ` · ${v.skills.length} selected` : ""}`}
        hint="Pick what to work on — or leave empty to auto-target your weakest skills."
      >
        {suggested.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <GroupLabel>Suggested — your weak spots</GroupLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {suggested.map((s) => (
                <SkillRow key={s.skillId} s={s} on={selectedIds.has(s.skillId)} suggested onToggle={() => toggle(s)} />
              ))}
            </div>
          </div>
        )}
        {others.length > 0 && (
          <div style={{ marginTop: suggested.length ? 16 : 12 }}>
            <GroupLabel>All skills</GroupLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {others.map((s) => (
                <SkillRow key={s.skillId} s={s} on={selectedIds.has(s.skillId)} onToggle={() => toggle(s)} />
              ))}
            </div>
          </div>
        )}
      </Field>
    </div>
  );
}

function DensityStep({ v, patch }: { v: WizardValue; patch: (p: Partial<WizardValue>) => void }) {
  return (
    <>
      <Field label="Drills per block">
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
      </Field>
      <Hairline />
      <Field label="Water breaks">
        <div style={{ marginTop: 10 }}>
          <ToggleRow
            on={v.autoWaterBreaks}
            onClick={() => patch({ autoWaterBreaks: !v.autoWaterBreaks })}
            label="Auto water breaks"
            hint="A 3-minute break roughly every 30 minutes"
          />
        </div>
      </Field>
    </>
  );
}

function ReviewStep({ v, onEdit }: { v: WizardValue; onEdit: (s: Step) => void }) {
  const blocks: string[] = [];
  if (v.includeWarmup) blocks.push("Warm-up");
  if (v.includeSkills) blocks.push(v.skills.length ? `Skills (${v.skills.length})` : "Skills (auto)");
  if (v.includeTeamSituational) blocks.push("Team / Situational");
  v.customBlocks.forEach((c) => blocks.push(c.name.trim() || "Custom block"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ReviewRow label="Title" value={v.title.trim() || "Practice"} onEdit={() => onEdit(1)} />
      <ReviewRow label="Date" value={v.practiceDate} mono onEdit={() => onEdit(1)} />
      <ReviewRow label="Length" value={`${v.totalMinutes} min`} mono onEdit={() => onEdit(1)} />
      <ReviewRow label="Format" value={v.format} mono onEdit={() => onEdit(1)} />
      <ReviewRow label="Blocks" value={blocks.join("  →  ")} onEdit={() => onEdit(2)} />
      {v.includeSkills && (
        <ReviewRow
          label="Skills"
          value={v.skills.length ? v.skills.map((s) => s.skillName).join(", ") : "Auto (weakest)"}
          onEdit={() => onEdit(3)}
        />
      )}
      <ReviewRow label="Drills / block" value={String(v.drillsPerBlock)} mono onEdit={() => onEdit(4)} />
      <ReviewRow label="Water breaks" value={v.autoWaterBreaks ? "On" : "Off"} onEdit={() => onEdit(4)} />
    </div>
  );
}

// --------------------------------------------------------------------------
// Presentational atoms (local — single consumer is this wizard)
// --------------------------------------------------------------------------

function Stepper({ order, current, onJump }: { order: Step[]; current: Step; onJump: (s: Step) => void }) {
  const ci = order.indexOf(current);
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {order.map((s, i) => {
        const done = i < ci;
        const active = s === current;
        const clickable = i <= ci;
        return (
          <Fragment key={s}>
            <button
              type="button"
              onClick={() => clickable && onJump(s)}
              disabled={!clickable}
              aria-current={active ? "step" : undefined}
              style={{
                appearance: "none",
                background: "none",
                border: "none",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: clickable ? "pointer" : "default",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: MONO,
                  flexShrink: 0,
                  transition: "background .15s, border-color .15s, color .15s",
                  ...(done
                    ? { background: "var(--uff-orange)", border: "1px solid var(--uff-orange)", color: "#1a0e02" }
                    : active
                      ? { background: "rgba(255,106,26,0.14)", border: "1px solid var(--uff-orange)", color: "var(--uff-orange)" }
                      : { background: "var(--uff-surface-2)", border: "1px solid var(--uff-line)", color: "var(--uff-text-mute)" }),
                }}
              >
                {done ? <Icon.check size={13} /> : i + 1}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: active ? "var(--uff-text)" : "var(--uff-text-mute)",
                }}
              >
                {LABELS[s]}
              </span>
            </button>
            {i < order.length - 1 && (
              <span
                style={{
                  flex: 1,
                  height: 2,
                  margin: "0 10px",
                  borderRadius: 2,
                  background: i < ci ? "var(--uff-orange)" : "var(--uff-line)",
                  transition: "background .15s",
                }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section style={style}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
        }}
      >
        {label}
      </div>
      {hint && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--uff-text-mute)", lineHeight: 1.45 }}>{hint}</p>}
      {children}
    </section>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--uff-text-dim)", letterSpacing: ".02em" }}>{children}</div>
  );
}

function SkillRow({
  s,
  on,
  suggested,
  onToggle,
}: {
  s: TargetSkill;
  on: boolean;
  suggested?: boolean;
  onToggle: () => void;
}) {
  const grade = scoreToGrade(s.avgScore);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      style={{
        appearance: "none",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "11px 14px",
        borderRadius: 11,
        background: on ? "#5C3308" : "var(--uff-surface-2)",
        border: on ? "1px solid var(--uff-orange)" : "1px solid var(--uff-line-soft)",
        transition: "background .12s, border-color .12s",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <CheckBox on={on} />
        <span style={{ fontSize: 14, fontWeight: 600, color: on ? "#F0B870" : "var(--uff-text)" }}>{s.skillName}</span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {suggested && <Tag>Weak</Tag>}
        {grade && <GradeChip grade={grade} dimmed={!on} />}
      </span>
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        padding: "3px 7px",
        borderRadius: 999,
        color: "#F0B870",
        background: "rgba(255,106,26,0.12)",
        border: "1px solid rgba(255,106,26,0.3)",
      }}
    >
      {children}
    </span>
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
        minWidth: 112,
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
        borderRadius: 12,
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
      style={{
        padding: "8px 18px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background .12s, border-color .12s, color .12s",
        ...(on
          ? { background: "#5C3308", color: "#F0B870", border: "1px solid #D48A30" }
          : {
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.5)",
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
        borderRadius: 12,
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
          width: 40,
          height: 23,
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
            left: on ? 19 : 2,
            width: 19,
            height: 19,
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
        width: 17,
        height: 17,
        borderRadius: 6,
        flexShrink: 0,
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

function PencilIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ReviewRow({
  label,
  value,
  mono,
  onEdit,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onEdit: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid var(--uff-line-soft)",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--uff-text-mute)", flexShrink: 0 }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--uff-text)",
            textAlign: "right",
            fontFamily: mono ? MONO : undefined,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`Edit ${label}`}
          onClick={onEdit}
          style={{
            appearance: "none",
            width: 28,
            height: 28,
            borderRadius: 8,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            background: "transparent",
            border: "1px solid var(--uff-line-soft)",
            color: "var(--uff-text-mute)",
            cursor: "pointer",
            transition: "color .12s, border-color .12s",
          }}
        >
          <PencilIcon />
        </button>
      </span>
    </div>
  );
}

function Hairline() {
  return <div style={{ height: 1, background: "var(--uff-line-soft)" }} />;
}
