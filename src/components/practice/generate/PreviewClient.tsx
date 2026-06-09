"use client";

// AI plan generator — preview + per-block control. Styled in the --uff-*
// console idiom to match the planner. Logic is unchanged from the keyless
// build: regenerate a block, swap/reject a drill, adopt a gap-proposal drill
// into the library, then Accept → create plan → open the editor. Water breaks
// (computed by the wizard) render as thin rows between blocks and are saved.

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  regenerateBlock,
  adoptGapDrill,
  createPlanFromGeneration,
  recordGenerationFeedback,
} from "@/lib/practice/generate/actions";
import { toSavePayload } from "@/lib/practice/generate/to-payload";
import { Icon } from "@/components/uff/icons";
import type { GeneratedBlock } from "@/lib/practice/generate/types";
import type { PreviewState } from "./generate-view-types";

const MONO = "var(--font-mono, 'JetBrains Mono', monospace)";

export default function PreviewClient({
  teamId,
  state,
  onRegenerateAll,
  onDiscard,
}: {
  teamId: string;
  state: PreviewState;
  onRegenerateAll: () => void;
  onDiscard: () => void;
}) {
  const router = useRouter();
  const { skeleton, blockCandidates } = state;

  const [blocks, setBlocks] = useState<GeneratedBlock[]>(state.generated.blocks);
  const [names, setNames] = useState<Map<string, string>>(
    () => new Map(blockCandidates.flatMap((bc) => bc.candidates.map((c) => [c.drillId, c.drillName]))),
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [feedback, setFeedback] = useState<-1 | 1 | null>(null);

  const blockByKey = useMemo(() => new Map(blocks.map((b) => [b.blockKey, b])), [blocks]);
  const candByKey = useMemo(() => new Map(blockCandidates.map((bc) => [bc.blockKey, bc])), [blockCandidates]);
  const breakByKey = useMemo(
    () => new Map(state.waterBreaks.map((w) => [w.afterBlockKey, w.minutes])),
    [state.waterBreaks],
  );

  const totalPlanned = skeleton.totalMinutes;

  function updateBlock(key: string, next: GeneratedBlock) {
    setBlocks((prev) => {
      const exists = prev.some((b) => b.blockKey === key);
      return exists ? prev.map((b) => (b.blockKey === key ? next : b)) : [...prev, next];
    });
  }

  async function handleRegenerate(key: string) {
    setBusyKey(key);
    const current = blockByKey.get(key);
    const res = await regenerateBlock({
      teamId,
      generationId: state.generationId,
      blockKey: key,
      excludeDrillIds: current?.drills.map((d) => d.drillId) ?? [],
    });
    setBusyKey(null);
    if (res.ok) updateBlock(key, res.block);
  }

  function swapDrill(key: string, index: number, newDrillId: string) {
    const b = blockByKey.get(key);
    if (!b) return;
    const drills = b.drills.map((d, i) => (i === index ? { ...d, drillId: newDrillId } : d));
    updateBlock(key, { ...b, drills });
  }

  function rejectDrill(key: string, index: number) {
    const b = blockByKey.get(key);
    if (!b) return;
    updateBlock(key, { ...b, drills: b.drills.filter((_, i) => i !== index) });
  }

  async function adoptGap(key: string, skillId: string) {
    const b = blockByKey.get(key);
    const gap = b?.gapProposals.find((g) => g.skillId === skillId);
    if (!b || !gap) return;
    setBusyKey(key);
    const res = await adoptGapDrill({
      teamId,
      name: gap.name,
      description: gap.description,
      category: gap.category,
      phaseSkillIds: [skillId],
    });
    setBusyKey(null);
    if (!res.ok) return;
    setNames((prev) => new Map(prev).set(res.drillId, gap.name));
    updateBlock(key, {
      ...b,
      drills: [...b.drills, { drillId: res.drillId, coachingCue: "" }],
      gapProposals: b.gapProposals.filter((g) => g.skillId !== skillId),
    });
  }

  async function handleAccept() {
    setAccepting(true);
    const payload = toSavePayload({
      planId: "",
      title: state.title,
      practiceDate: state.practiceDate,
      skeleton,
      generated: { blocks, usedFallback: state.generated.usedFallback },
      waterBreaks: state.waterBreaks,
    });
    const { plan_id: _omit, ...rest } = payload;
    void _omit;
    const res = await createPlanFromGeneration({ teamId, generationId: state.generationId, payload: rest });
    if (res.ok) router.push(`/dashboard/team/${teamId}/practice/${res.planId}/edit`);
    else setAccepting(false);
  }

  function sendFeedback(value: -1 | 1) {
    setFeedback(value);
    void recordGenerationFeedback({ generationId: state.generationId, feedback: value });
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--uff-text)" }}>
          Review your plan
        </div>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 13,
            fontWeight: 700,
            color: "var(--uff-text)",
          }}
        >
          {totalPlanned}
          <span style={{ color: "var(--uff-text-mute)", fontWeight: 500 }}> min</span>
        </span>
      </div>
      {state.generated.usedFallback && (
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--uff-text-mute)" }}>
          Generated without AI assist — drills auto-selected.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        {skeleton.blocks.map((sb) => {
          const gen = blockByKey.get(sb.key);
          const cands = candByKey.get(sb.key)?.candidates ?? [];
          const isSkill = sb.kind === "skill";
          const breakMin = breakByKey.get(sb.key);
          return (
            <Fragment key={sb.key}>
            <div className="w-card">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--uff-text)", letterSpacing: "-0.005em" }}>
                    {sb.name}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--uff-text-mute)", marginTop: 2 }}>
                    {sb.targetMinutes} min
                  </div>
                </div>
                {isSkill && (
                  <button
                    type="button"
                    className="wbtn ghost"
                    disabled={busyKey === sb.key}
                    onClick={() => handleRegenerate(sb.key)}
                    style={{ height: 30, padding: "0 12px", fontSize: 12, color: "var(--uff-orange)" }}
                  >
                    {busyKey === sb.key ? "…" : "↻ Regenerate"}
                  </button>
                )}
              </div>

              {gen?.rationale && (
                <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--uff-text-dim)" }}>
                  {gen.rationale}
                </p>
              )}

              {/* Drills */}
              {gen && gen.drills.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {gen.drills.map((d, i) => (
                    <div
                      key={`${d.drillId}-${i}`}
                      style={{
                        background: "var(--uff-surface-2)",
                        border: "1px solid var(--uff-line-soft)",
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--uff-text)" }}>
                          {names.get(d.drillId) ?? "Drill"}
                        </span>
                        <button
                          type="button"
                          onClick={() => rejectDrill(sb.key, i)}
                          aria-label="Remove drill"
                          style={{
                            appearance: "none",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 12,
                            color: "var(--uff-text-mute)",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      {d.coachingCue && (
                        <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.45, color: "var(--uff-text-dim)" }}>
                          {d.coachingCue}
                        </p>
                      )}
                      {cands.length > 1 && (
                        <select
                          value={d.drillId}
                          onChange={(e) => swapDrill(sb.key, i, e.target.value)}
                          className="fr-input"
                          style={{ marginTop: 10, width: "100%", height: 34, fontSize: 12.5 }}
                        >
                          {cands.map((c) => (
                            <option key={c.drillId} value={c.drillId}>
                              {c.drillName}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Gap proposals */}
              {gen?.gapProposals.map((g) => (
                <div
                  key={g.skillId}
                  style={{
                    marginTop: 12,
                    borderRadius: 10,
                    padding: 12,
                    border: "1px dashed rgba(255,106,26,0.5)",
                    background: "rgba(255,106,26,0.06)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: "var(--uff-orange)",
                    }}
                  >
                    No drill covers this skill
                  </div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: "var(--uff-text)" }}>{g.name}</div>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.45, color: "var(--uff-text-dim)" }}>
                    {g.description}
                  </p>
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      type="button"
                      disabled={busyKey === sb.key}
                      onClick={() => adoptGap(sb.key, g.skillId)}
                      style={{
                        appearance: "none",
                        cursor: busyKey === sb.key ? "not-allowed" : "pointer",
                        opacity: busyKey === sb.key ? 0.55 : 1,
                        padding: "8px 14px",
                        borderRadius: 999,
                        fontSize: 12.5,
                        fontWeight: 600,
                        background: "#5C3308",
                        color: "#F0B870",
                        border: "1px solid #D48A30",
                      }}
                    >
                      Add to library &amp; include
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateBlock(sb.key, {
                          ...(gen as GeneratedBlock),
                          gapProposals: (gen as GeneratedBlock).gapProposals.filter((x) => x.skillId !== g.skillId),
                        })
                      }
                      style={{
                        appearance: "none",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12.5,
                        color: "var(--uff-text-mute)",
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {breakMin != null && <WaterBreakRow minutes={breakMin} />}
            </Fragment>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className="wbtn primary"
          disabled={accepting}
          onClick={handleAccept}
          style={{ height: 44, padding: "0 22px", fontSize: 14 }}
        >
          {accepting ? "Saving…" : (<><Icon.check size={14} /> Accept &amp; open in editor</>)}
        </button>
        <button type="button" className="wbtn ghost" onClick={onRegenerateAll} style={{ height: 44 }}>
          Regenerate all
        </button>
        <button
          type="button"
          onClick={onDiscard}
          style={{
            appearance: "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            color: "var(--uff-text-mute)",
          }}
        >
          Discard
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <FeedbackButton active={feedback === 1} onClick={() => sendFeedback(1)} label="Helpful">
            👍
          </FeedbackButton>
          <FeedbackButton active={feedback === -1} onClick={() => sendFeedback(-1)} label="Not helpful">
            👎
          </FeedbackButton>
        </div>
      </div>
    </div>
  );
}

function WaterBreakRow({ minutes }: { minutes: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 10,
        border: "1px dashed var(--uff-line-soft)",
        background: "var(--uff-surface-2)",
        fontSize: 12.5,
        color: "var(--uff-text-mute)",
      }}
    >
      <span aria-hidden>💧</span>
      <span style={{ fontWeight: 600, color: "var(--uff-text-dim)" }}>Water break</span>
      <span style={{ fontFamily: MONO, marginLeft: "auto" }}>{minutes} min</span>
    </div>
  );
}

function FeedbackButton({
  children,
  active,
  label,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      style={{
        appearance: "none",
        background: active ? "var(--uff-surface-2)" : "none",
        border: active ? "1px solid var(--uff-line)" : "1px solid transparent",
        borderRadius: 9,
        width: 34,
        height: 34,
        fontSize: 15,
        cursor: "pointer",
        opacity: active ? 1 : 0.5,
        transition: "opacity .12s, background .12s",
      }}
    >
      {children}
    </button>
  );
}
