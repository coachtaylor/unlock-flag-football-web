"use client";

// AI plan generator — guided wizard (Basics → Blocks → Skills → Density →
// Review) in a two-column layout: a live "plan rail" on the left that builds
// as you go, the active step on the right. Styled in the --uff-* console idiom
// but tuned for craft: crisp orange selection (no muddy fills), selectable
// cards instead of iOS toggles, editorial type, tabular numerals, scoped
// transitions and tactile press states. Step 5's Next is "Generate" and hands
// a full WizardInput (minus teamId) to onGenerate.

import { Fragment, useState } from "react";
import Link from "next/link";
import { scoreToGrade } from "@/lib/dashboard/heat-scale";
import { Icon } from "@/components/uff/icons";
import { PHASE_CATS, WEB_CAT_DEFS, type CatSlug } from "@/components/uff-web/drills/atoms";
import type { WizardInput, TargetSkill, CustomBlockSpec } from "@/lib/practice/generate/types";
import type { GeneratePageData, SelectableSkill } from "./generate-view-types";

type WizardValue = Omit<WizardInput, "teamId">;
type Step = 1 | 2 | 3 | 4 | 5;
const LABELS: Record<Step, string> = { 1: "Basics", 2: "Blocks", 3: "Skills", 4: "Density", 5: "Review" };

const MINUTE_STEP = 15;
const MIN_MINUTES = 30;
const MAX_MINUTES = 180;
const MIN_DRILLS = 1;
const MAX_DRILLS = 4;
const MONO = "var(--font-mono, 'JetBrains Mono', monospace)";

// Crisp selected treatment — replaces the old muddy #5C3308 brown fill.
const SEL_BG = "rgba(255,106,26,0.10)";
const SEL_BORDER = "var(--uff-orange)";

const STYLE = `
.gw-root{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
.gw-num{font-variant-numeric:tabular-nums;}
.gw-grid{display:grid;grid-template-columns:1fr;gap:18px;align-items:start;}
.gw-step{order:1;}
.gw-rail{order:2;}
@media(min-width:880px){
  .gw-grid{grid-template-columns:236px minmax(0,1fr);gap:22px;}
  .gw-rail{grid-column:1;grid-row:1;position:sticky;top:16px;}
  .gw-step{grid-column:2;grid-row:1;}
}
.gw-press{transition-property:transform,background-color,border-color,color,box-shadow;transition-duration:130ms;transition-timing-function:ease-out;}
.gw-press:active{transform:scale(.975);}
.gw-card-enter{animation:gwIn .22s ease-out both;}
@keyframes gwIn{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:none;}}
.gw-balance{text-wrap:balance;}
.gw-pretty{text-wrap:pretty;}
@media(prefers-reduced-motion:reduce){
  .gw-card-enter{animation:none;}
  .gw-press{transition:none;}
  .gw-press:active{transform:none;}
}
`;

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
  const goToStep = (s: Step) => {
    const ti = order.indexOf(s);
    if (ti !== -1 && ti <= idx) setStep(s);
  };

  return (
    <div className="gw-root" style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
      <style>{STYLE}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            display: "grid",
            placeItems: "center",
            background: "rgba(255,106,26,0.14)",
            border: "1px solid rgba(255,106,26,0.32)",
            color: "var(--uff-orange)",
            flexShrink: 0,
          }}
        >
          <Icon.bolt size={17} />
        </span>
        <div>
          <h1 className="gw-balance" style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--uff-text)" }}>
            Build a practice plan
          </h1>
          <p className="gw-pretty" style={{ margin: "2px 0 0", fontSize: 12.5, lineHeight: 1.45, color: "var(--uff-text-mute)" }}>
            Answer a few questions — we fill every block from your library and scouting weaknesses.
          </p>
        </div>
      </div>

      <div className="gw-grid">
        <PlanRail className="gw-rail" v={v} step={step} order={order} onJump={goToStep} />

        <div className="gw-step">
          <div key={step} className="w-card gw-card-enter" style={{ display: "flex", flexDirection: "column", gap: 20, padding: 24 }}>
            <StepHead n={order.indexOf(step) + 1} total={order.length} label={LABELS[step]} />

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

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid var(--uff-line-soft)",
                paddingTop: 18,
              }}
            >
              <button
                type="button"
                className="wbtn ghost gw-press"
                onClick={goBack}
                disabled={idx === 0 || pending}
                style={{ height: 44, opacity: idx === 0 ? 0.4 : 1 }}
              >
                <Icon.arrowLeft size={14} /> Back
              </button>
              <button
                type="button"
                className="wbtn primary gw-press"
                onClick={goNext}
                disabled={nextDisabled || pending}
                style={{ height: 44, justifyContent: "center", minWidth: 150 }}
              >
                {isLast ? (
                  pending ? "Generating…" : (<><Icon.bolt size={14} /> Generate plan</>)
                ) : (
                  <>Next <Icon.arrowRight size={14} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Live plan rail
// --------------------------------------------------------------------------

function PlanRail({
  className,
  v,
  step,
  order,
  onJump,
}: {
  className?: string;
  v: WizardValue;
  step: Step;
  order: Step[];
  onJump: (s: Step) => void;
}) {
  const blocks: { label: string; sub: string }[] = [];
  if (v.includeWarmup) blocks.push({ label: "Warm-up", sub: "Activation" });
  if (v.includeSkills) blocks.push({ label: "Skills", sub: v.skills.length ? `${v.skills.length} targeted` : "Auto — weakest" });
  if (v.includeTeamSituational) blocks.push({ label: "Team / Situational", sub: "Off · Def · Scrim" });
  v.customBlocks.forEach((c) => blocks.push({ label: c.name.trim() || "Custom block", sub: c.source === "manual" ? "Manual" : WEB_CAT_DEFS[c.source as CatSlug].label }));

  const dateLabel = formatDate(v.practiceDate);

  return (
    <aside className={`w-card ${className ?? ""}`} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <Eyebrow>Your plan</Eyebrow>
        <div className="gw-balance" style={{ marginTop: 6, fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--uff-text)", lineHeight: 1.2 }}>
          {v.title.trim() || "Untitled practice"}
        </div>
        <div style={{ marginTop: 3, fontSize: 12, color: "var(--uff-text-mute)" }}>
          {dateLabel} · <span style={{ color: "var(--uff-text-dim)" }}>{v.format}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="gw-num" style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--uff-orange)" }}>
          {v.totalMinutes}
        </span>
        <span style={{ fontSize: 12, color: "var(--uff-text-mute)", fontWeight: 600 }}>min total</span>
      </div>

      <div style={{ height: 1, background: "var(--uff-line-soft)" }} />

      {/* Block timeline */}
      <div>
        <Eyebrow>Blocks</Eyebrow>
        {blocks.length === 0 ? (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--uff-text-mute)" }}>No blocks selected yet.</p>
        ) : (
          <ol style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {blocks.map((b, i) => (
              <Fragment key={`${b.label}-${i}`}>
                <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span
                    className="gw-num"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      flexShrink: 0,
                      marginTop: 1,
                      display: "grid",
                      placeItems: "center",
                      fontFamily: MONO,
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--uff-orange)",
                      background: "rgba(255,106,26,0.12)",
                      border: "1px solid rgba(255,106,26,0.3)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--uff-text)", lineHeight: 1.3 }}>{b.label}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--uff-text-mute)" }}>{b.sub}</span>
                  </span>
                </li>
                {v.autoWaterBreaks && i < blocks.length - 1 && (
                  <li style={{ display: "flex", gap: 10, alignItems: "center", padding: "1px 0 1px 4px" }}>
                    <Droplet />
                    <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>Water break</span>
                  </li>
                )}
              </Fragment>
            ))}
          </ol>
        )}
      </div>

      <div style={{ height: 1, background: "var(--uff-line-soft)" }} />

      <button
        type="button"
        className="gw-press"
        onClick={() => onJump(4)}
        disabled={order.indexOf(4) > order.indexOf(step)}
        style={{
          appearance: "none",
          background: "none",
          border: "none",
          padding: 0,
          textAlign: "left",
          cursor: order.indexOf(4) <= order.indexOf(step) ? "pointer" : "default",
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--uff-text-mute)" }}>Drills / block</span>
        <span className="gw-num" style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "var(--uff-text)" }}>{v.drillsPerBlock}</span>
      </button>
    </aside>
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
            className="fr-input gw-num"
            value={v.practiceDate}
            onChange={(e) => patch({ practiceDate: e.target.value })}
            style={{ width: "100%" }}
          />
        </Field>
      </div>
      <Hairline />
      <Field label="Total time">
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 16 }}>
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
        <div style={{ marginTop: 12 }}>
          <Segmented
            options={[{ value: "5v5", label: "5v5" }, { value: "7v7", label: "7v7" }]}
            value={v.format}
            onChange={(f) => patch({ format: f as "5v5" | "7v7" })}
          />
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
      <Field label="Core blocks" hint="Run in order: warm-up → skills → team. Tap to include or skip.">
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <SelectCard on={v.includeWarmup} onClick={() => patch({ includeWarmup: !v.includeWarmup })} title="Warm-up" hint="Activation & movement prep" />
          <SelectCard on={v.includeSkills} onClick={() => patch({ includeSkills: !v.includeSkills })} title="Skills" hint="Targeted skill work from scouting" />
          <SelectCard on={v.includeTeamSituational} onClick={() => patch({ includeTeamSituational: !v.includeTeamSituational })} title="Team / Situational" hint="Offense, defense & scrimmage" />
        </div>
      </Field>
      <Hairline />
      <Field label="Custom blocks" hint="Add a closer like conditioning or agilities.">
        {v.customBlocks.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {v.customBlocks.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 13,
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
                  style={{ width: 150, flexShrink: 0 }}
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
                  className="gw-press"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    flexShrink: 0,
                    background: "transparent",
                    border: "1px solid var(--uff-line)",
                    color: "var(--uff-text-mute)",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="wbtn ghost gw-press" onClick={addCustom} style={{ marginTop: 14, height: 42 }}>
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
          <p className="gw-pretty" style={{ margin: 0, fontSize: 13, color: "var(--uff-text-dim)", lineHeight: 1.5 }}>
            No skills in your library yet. You can still generate with warm-up and team blocks.
          </p>
          <Link href={`/dashboard/team/${data.teamId}/benchmarks`} style={{ fontSize: 13, fontWeight: 600, color: "var(--uff-orange)", textDecoration: "none" }}>
            Go to benchmarks →
          </Link>
        </div>
      </Field>
    );
  }

  const byId = new Map(data.availableSkills.map((s) => [s.skillId, s]));
  const suggested = data.suggestedSkillIds.map((id) => byId.get(id)).filter((s): s is SelectableSkill => !!s);
  const suggestedSet = new Set(data.suggestedSkillIds);
  const others = data.availableSkills
    .filter((s) => !suggestedSet.has(s.skillId))
    .sort((a, b) => {
      const am = a.avgScore != null, bm = b.avgScore != null;
      if (am !== bm) return am ? -1 : 1;
      if (am && bm) return (a.avgScore as number) - (b.avgScore as number);
      return a.skillName.localeCompare(b.skillName);
    });

  return (
    <Field
      label={`Target skills${v.skills.length ? ` · ${v.skills.length} selected` : ""}`}
      hint="Pick what to drill — or leave empty to auto-target your weakest skills."
    >
      <div style={{ marginTop: 14, maxHeight: 460, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingRight: 2 }}>
        {suggested.length > 0 && (
          <div>
            <GroupLabel>Suggested — your weak spots</GroupLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {suggested.map((s) => (
                <SkillRow key={s.skillId} s={s} on={selectedIds.has(s.skillId)} weak onToggle={() => toggle(s)} />
              ))}
            </div>
          </div>
        )}
        {others.length > 0 && (
          <div>
            <GroupLabel>All skills</GroupLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {others.map((s) => (
                <SkillRow key={s.skillId} s={s} on={selectedIds.has(s.skillId)} onToggle={() => toggle(s)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

function DensityStep({ v, patch }: { v: WizardValue; patch: (p: Partial<WizardValue>) => void }) {
  return (
    <>
      <Field label="Drills per block" hint="How many drills to slot into each block.">
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 16 }}>
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
        <div style={{ marginTop: 14 }}>
          <SelectCard
            on={v.autoWaterBreaks}
            onClick={() => patch({ autoWaterBreaks: !v.autoWaterBreaks })}
            title="Auto water breaks"
            hint="A 3-minute break roughly every 30 minutes"
            icon={<Droplet />}
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
    <div style={{ display: "flex", flexDirection: "column" }}>
      <p className="gw-pretty" style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--uff-text-mute)", lineHeight: 1.45 }}>
        Looks good? Generate to draft the plan — you can tweak every block before saving.
      </p>
      <ReviewRow label="Title" value={v.title.trim() || "Practice"} onEdit={() => onEdit(1)} />
      <ReviewRow label="Date" value={formatDate(v.practiceDate)} onEdit={() => onEdit(1)} />
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
      <ReviewRow label="Water breaks" value={v.autoWaterBreaks ? "On" : "Off"} onEdit={() => onEdit(4)} last />
    </div>
  );
}

// --------------------------------------------------------------------------
// Presentational atoms
// --------------------------------------------------------------------------

function StepHead({ n, total, label }: { n: number; total: number; label: string }) {
  return (
    <div>
      <div className="gw-num" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--uff-orange)" }}>
        Step {n} / {total}
      </div>
      <h2 className="gw-balance" style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 800, letterSpacing: "-0.015em", color: "var(--uff-text)" }}>
        {label}
      </h2>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--uff-text-mute)" }}>
      {children}
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
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--uff-text-dim)" }}>{label}</div>
      {hint && <p className="gw-pretty" style={{ margin: "6px 0 0", fontSize: 12, color: "var(--uff-text-mute)", lineHeight: 1.45 }}>{hint}</p>}
      {children}
    </section>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "var(--uff-text-dim)", letterSpacing: ".02em" }}>{children}</div>;
}

function SelectCard({
  on,
  onClick,
  title,
  hint,
  icon,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  hint: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="gw-press"
      style={{
        appearance: "none",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 15px",
        borderRadius: 14,
        width: "100%",
        background: on ? SEL_BG : "var(--uff-surface-2)",
        border: on ? `1.5px solid ${SEL_BORDER}` : "1.5px solid var(--uff-line-soft)",
      }}
    >
      <Check on={on} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--uff-text)", letterSpacing: "-0.005em" }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--uff-text-mute)" }}>{hint}</span>
      </span>
      {icon && <span style={{ color: "var(--uff-text-mute)", flexShrink: 0 }}>{icon}</span>}
    </button>
  );
}

function SkillRow({
  s,
  on,
  weak,
  onToggle,
}: {
  s: SelectableSkill;
  on: boolean;
  weak?: boolean;
  onToggle: () => void;
}) {
  const grade = scoreToGrade(s.avgScore);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className="gw-press"
      style={{
        appearance: "none",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 13,
        background: on ? SEL_BG : "var(--uff-surface-2)",
        border: on ? `1.5px solid ${SEL_BORDER}` : "1.5px solid var(--uff-line-soft)",
      }}
    >
      <span style={{ marginTop: 1 }}>
        <Check on={on} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--uff-text)" }}>{s.skillName}</span>
          {weak && <Tag>Weak</Tag>}
          {grade && <GradeChip grade={grade} />}
        </span>
        {s.description && (
          <span className="gw-pretty" style={{ display: "block", marginTop: 3, fontSize: 12, lineHeight: 1.45, color: "var(--uff-text-mute)" }}>
            {s.description}
          </span>
        )}
      </span>
    </button>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      style={{
        display: "flex",
        width: "100%",
        padding: 4,
        gap: 4,
        borderRadius: 13,
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line-soft)",
      }}
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="gw-press"
            style={{
              appearance: "none",
              flex: 1,
              height: 42,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
              background: on ? "var(--uff-orange)" : "transparent",
              color: on ? "#1a0e02" : "var(--uff-text-mute)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MonoStat({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="gw-num" style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--uff-text)", minWidth: 124, textAlign: "center" }}>
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
      className="gw-press"
      style={{
        width: 46,
        height: 46,
        borderRadius: 13,
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line)",
        color: "var(--uff-text)",
        fontSize: 22,
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "grid",
        placeItems: "center",
      }}
    >
      {children}
    </button>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="gw-press"
      style={{
        width: 20,
        height: 20,
        borderRadius: 7,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        border: on ? "1.5px solid var(--uff-orange)" : "1.5px solid var(--uff-line)",
        background: on ? "var(--uff-orange)" : "transparent",
        color: "#1a0e02",
      }}
    >
      {on && <Icon.check size={13} />}
    </span>
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
        color: "var(--uff-orange)",
        background: "rgba(255,106,26,0.12)",
        border: "1px solid rgba(255,106,26,0.3)",
      }}
    >
      {children}
    </span>
  );
}

function GradeChip({ grade }: { grade: string }) {
  return (
    <span className="gw-num" style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", color: "var(--uff-text-mute)" }}>
      {grade}
    </span>
  );
}

function PencilIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function Droplet({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2.7 6.4 9.5a7 7 0 1 0 11.2 0Z" />
    </svg>
  );
}

function ReviewRow({
  label,
  value,
  mono,
  last,
  onEdit,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
  onEdit: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        padding: "11px 0",
        borderBottom: last ? "none" : "1px solid var(--uff-line-soft)",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--uff-text-mute)", flexShrink: 0 }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span
          className={mono ? "gw-num" : undefined}
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
          className="gw-press"
          style={{
            appearance: "none",
            width: 30,
            height: 30,
            borderRadius: 9,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            background: "transparent",
            border: "1px solid var(--uff-line-soft)",
            color: "var(--uff-text-mute)",
            cursor: "pointer",
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

// yyyy-mm-dd → "Sun Jun 14" (date-only, no timezone drift).
function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[dt.getDay()]} ${mons[dt.getMonth()]} ${dt.getDate()}`;
}
