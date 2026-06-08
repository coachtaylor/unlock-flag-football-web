"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  regenerateBlock,
  adoptGapDrill,
  createPlanFromGeneration,
  recordGenerationFeedback,
} from "@/lib/practice/generate/actions";
import { toSavePayload } from "@/lib/practice/generate/to-payload";
import type { GeneratedBlock } from "@/lib/practice/generate/types";
import type { PreviewState } from "./generate-view-types";

function nextSundayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const add = day === 0 ? 7 : 7 - day;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

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
      title: `AI practice — ${nextSundayISO()}`,
      practiceDate: nextSundayISO(),
      skeleton,
      generated: { blocks, usedFallback: state.generated.usedFallback },
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
    <div className="mx-auto max-w-[760px] px-xl py-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-title font-medium text-text-primary">Review your plan</h1>
        <span className="label-micro text-text-muted tabular-nums">{totalPlanned} min</span>
      </div>
      {state.generated.usedFallback && (
        <p className="mt-xs text-caption text-text-muted">Generated without AI assist — drills auto-selected.</p>
      )}

      <div className="mt-2xl flex flex-col gap-lg">
        {skeleton.blocks.map((sb) => {
          const gen = blockByKey.get(sb.key);
          const cands = candByKey.get(sb.key)?.candidates ?? [];
          const isSkill = sb.kind === "skill";
          return (
            <div key={sb.key} className="rounded-lg bg-surface-raised p-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-body font-medium text-text-primary">{sb.name}</div>
                  <div className="label-micro text-text-muted tabular-nums">{sb.targetMinutes} min</div>
                </div>
                {isSkill && (
                  <button
                    type="button"
                    disabled={busyKey === sb.key}
                    onClick={() => handleRegenerate(sb.key)}
                    className="rounded-pill px-md py-xs text-caption font-medium text-orange-400 disabled:opacity-50"
                    style={{ border: "1px solid rgba(212,138,48,0.4)" }}
                  >
                    {busyKey === sb.key ? "…" : "↻ Regenerate"}
                  </button>
                )}
              </div>

              {gen?.rationale && <p className="mt-sm text-caption text-text-secondary">{gen.rationale}</p>}

              {/* Drills */}
              {gen && gen.drills.length > 0 && (
                <div className="mt-md flex flex-col gap-sm">
                  {gen.drills.map((d, i) => (
                    <div key={`${d.drillId}-${i}`} className="rounded-md bg-surface-base p-md">
                      <div className="flex items-center justify-between gap-sm">
                        <span className="text-body text-text-primary">{names.get(d.drillId) ?? "Drill"}</span>
                        <button
                          type="button"
                          onClick={() => rejectDrill(sb.key, i)}
                          className="text-caption text-text-muted"
                          aria-label="Remove drill"
                        >
                          Remove
                        </button>
                      </div>
                      {d.coachingCue && <p className="mt-xs text-caption text-text-secondary">{d.coachingCue}</p>}
                      {cands.length > 1 && (
                        <select
                          value={d.drillId}
                          onChange={(e) => swapDrill(sb.key, i, e.target.value)}
                          className="mt-sm w-full rounded-md bg-surface-raised p-xs text-caption text-text-secondary"
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
                  className="mt-md rounded-md p-md"
                  style={{ border: "1px dashed rgba(212,138,48,0.5)", backgroundColor: "rgba(212,138,48,0.06)" }}
                >
                  <div className="label-micro text-orange-400">No drill covers this skill</div>
                  <div className="mt-xs text-body text-text-primary">{g.name}</div>
                  <p className="mt-xs text-caption text-text-secondary">{g.description}</p>
                  <div className="mt-sm flex gap-sm">
                    <button
                      type="button"
                      disabled={busyKey === sb.key}
                      onClick={() => adoptGap(sb.key, g.skillId)}
                      className="rounded-pill px-md py-xs text-caption font-medium disabled:opacity-50"
                      style={{ backgroundColor: "#5C3308", color: "#F0B870", border: "1px solid #D48A30" }}
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
                      className="text-caption text-text-muted"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-2xl flex flex-wrap items-center gap-md">
        <button
          type="button"
          disabled={accepting}
          onClick={handleAccept}
          className="rounded-xl px-2xl py-lg text-body font-medium tracking-wide disabled:opacity-50"
          style={{ backgroundColor: "#D48A30", color: "#FFFFFF", letterSpacing: "0.3px" }}
        >
          {accepting ? "Saving…" : "Accept & open in editor"}
        </button>
        <button type="button" onClick={onRegenerateAll} className="text-caption font-medium text-text-secondary">
          Regenerate all
        </button>
        <button type="button" onClick={onDiscard} className="text-caption text-text-muted">
          Discard
        </button>
        <div className="ml-auto flex items-center gap-sm">
          <button
            type="button"
            aria-pressed={feedback === 1}
            onClick={() => sendFeedback(1)}
            className="text-body"
            style={{ opacity: feedback === 1 ? 1 : 0.5 }}
          >
            👍
          </button>
          <button
            type="button"
            aria-pressed={feedback === -1}
            onClick={() => sendFeedback(-1)}
            className="text-body"
            style={{ opacity: feedback === -1 ? 1 : 0.5 }}
          >
            👎
          </button>
        </div>
      </div>
    </div>
  );
}
