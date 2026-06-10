"use client";

// AI plan generator — preview + per-block control. Styled in the --uff-*
// console idiom. Each block is a delineated "section" with a category-colored
// rail + numbered badge so the breaks are obvious at a glance. Coaches can:
// reorder blocks (▲▼), delete a whole block (🗑), regenerate a skill block,
// swap a drill inline (the drill NAME is the swap control — no duplicate
// dropdown), remove a drill, add another drill that fits the block (from that
// block's aligned candidate pool only), adopt a gap-proposal drill into the
// library, then Accept → create plan → open the editor.
//
// Drill-bearing blocks STRETCH to absorb the full practice time (empty blocks
// contribute 0), so the per-block minutes shown here always sum to the target.
// Water breaks recompute live from the current order. All of it persists.

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  regenerateBlock,
  adoptGapDrill,
  createPlanFromGeneration,
  recordGenerationFeedback,
} from "@/lib/practice/generate/actions";
import { toSavePayload, distributeBlockMinutes } from "@/lib/practice/generate/to-payload";
import { computeWaterBreaks } from "@/lib/practice/generate/water-breaks";
import { WEB_CAT_DEFS, pickPhaseCat } from "@/components/uff-web/drills/atoms";
import { Icon } from "@/components/uff/icons";
import type { GeneratedBlock, SkeletonBlock, Skeleton } from "@/lib/practice/generate/types";
import type { PreviewState } from "./generate-view-types";

const MONO = "var(--font-mono, 'JetBrains Mono', monospace)";
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239aa0a6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";
const STYLE = `
.pv-swap{transition:background-color 120ms ease;border-radius:8px;}
.pv-swap:hover{background-color:rgba(255,255,255,0.05);}
.pv-add{transition:border-color 120ms ease,color 120ms ease,background-color 120ms ease;}
.pv-add:hover{border-color:var(--uff-line);color:var(--uff-text);background-color:rgba(255,255,255,0.02);}
.pv-remove{transition:color 120ms ease;}
.pv-remove:hover{color:var(--uff-text)!important;}
.pv-ic{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:transparent;border:1px solid transparent;color:var(--uff-text-mute);cursor:pointer;transition:background-color 120ms ease,color 120ms ease,border-color 120ms ease;}
.pv-ic:hover:not(:disabled){background-color:var(--uff-surface-2);color:var(--uff-text);border-color:var(--uff-line-soft);}
.pv-ic:disabled{opacity:.28;cursor:not-allowed;}
.pv-ic.danger:hover:not(:disabled){color:#FF6B6B;border-color:rgba(255,107,107,0.35);}
.pv-sec{animation:pvIn 180ms ease both;}
@keyframes pvIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion: reduce){.pv-sec{animation:none;}}
`;

/** Category-colored accent per block kind — reuses the drills-surface palette
 *  so a section reads the same color it would in the library. */
function blockAccent(b: SkeletonBlock): { color: string; tint: string } {
  if (b.kind === "skill") return { color: "#6EA8FF", tint: "rgba(110,168,255,0.13)" };
  if (b.kind === "team") return { color: "#7DDFD2", tint: "rgba(125,223,210,0.13)" };
  const slug = b.categorySlugs.length ? pickPhaseCat(b.categorySlugs) : "other";
  const d = WEB_CAT_DEFS[slug] ?? WEB_CAT_DEFS.other;
  return { color: d.color, tint: d.tint };
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
  const [order, setOrder] = useState<string[]>(() => skeleton.blocks.map((b) => b.key));
  const [names, setNames] = useState<Map<string, string>>(
    () => new Map(blockCandidates.flatMap((bc) => bc.candidates.map((c) => [c.drillId, c.drillName]))),
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [feedback, setFeedback] = useState<-1 | 1 | null>(null);

  const skeletonByKey = useMemo(() => new Map(skeleton.blocks.map((b) => [b.key, b])), [skeleton.blocks]);
  const blockByKey = useMemo(() => new Map(blocks.map((b) => [b.blockKey, b])), [blocks]);
  const candByKey = useMemo(() => new Map(blockCandidates.map((bc) => [bc.blockKey, bc])), [blockCandidates]);

  // The current ordered plan: stretched per-block minutes + recomputed breaks.
  const plan = useMemo(() => {
    const orderedBlocks = order
      .map((k) => skeletonByKey.get(k))
      .filter((b): b is SkeletonBlock => Boolean(b));
    const drillCount = new Map(orderedBlocks.map((b) => [b.key, blockByKey.get(b.key)?.drills.length ?? 0]));
    const effMin = distributeBlockMinutes(orderedBlocks, drillCount, skeleton.totalMinutes);
    const breaks = computeWaterBreaks(
      orderedBlocks.map((b) => ({ key: b.key, targetMinutes: effMin.get(b.key) ?? b.targetMinutes })),
      { everyMin: 30, durationMin: 3, enabled: state.waterBreaks.length > 0 },
    );
    return { orderedBlocks, effMin, breaks };
  }, [order, blockByKey, skeletonByKey, skeleton.totalMinutes, state.waterBreaks.length]);

  const breakByKey = useMemo(() => new Map(plan.breaks.map((w) => [w.afterBlockKey, w.minutes])), [plan.breaks]);
  const totalPlanned = skeleton.totalMinutes;

  function updateBlock(key: string, next: GeneratedBlock) {
    setBlocks((prev) => {
      const exists = prev.some((b) => b.blockKey === key);
      return exists ? prev.map((b) => (b.blockKey === key ? next : b)) : [...prev, next];
    });
  }

  function moveBlock(key: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function deleteBlock(key: string) {
    setOrder((prev) => prev.filter((k) => k !== key));
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
    const drills = b.drills.map((d, i) => (i === index ? { ...d, drillId: newDrillId, coachingCue: "" } : d));
    updateBlock(key, { ...b, drills });
  }

  function rejectDrill(key: string, index: number) {
    const b = blockByKey.get(key);
    if (!b) return;
    updateBlock(key, { ...b, drills: b.drills.filter((_, i) => i !== index) });
  }

  function addDrill(key: string, drillId: string) {
    if (!drillId) return;
    const b = blockByKey.get(key);
    if (!b || b.drills.some((d) => d.drillId === drillId)) return;
    updateBlock(key, { ...b, drills: [...b.drills, { drillId, coachingCue: "" }] });
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
    const orderedSkeleton: Skeleton = { ...skeleton, blocks: plan.orderedBlocks };
    const payload = toSavePayload({
      planId: "",
      title: state.title,
      practiceDate: state.practiceDate,
      skeleton: orderedSkeleton,
      generated: { blocks, usedFallback: state.generated.usedFallback },
      waterBreaks: plan.breaks,
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
      <style>{STYLE}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.015em", color: "var(--uff-text)", textWrap: "balance" }}>
          Review your plan
        </div>
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: "var(--uff-text)", fontVariantNumeric: "tabular-nums" }}>
          {totalPlanned}
          <span style={{ color: "var(--uff-text-mute)", fontWeight: 500 }}> min</span>
        </span>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--uff-text-mute)" }}>
        {plan.orderedBlocks.length} block{plan.orderedBlocks.length === 1 ? "" : "s"} · reorder or remove anything before saving
      </p>
      {state.generated.usedFallback && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--uff-text-mute)" }}>
          Generated without AI assist — drills auto-selected.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        {plan.orderedBlocks.map((sb, i) => {
          const gen = blockByKey.get(sb.key);
          const cands = candByKey.get(sb.key)?.candidates ?? [];
          const isSkill = sb.kind === "skill";
          const breakMin = breakByKey.get(sb.key);
          const usedIds = new Set(gen?.drills.map((d) => d.drillId) ?? []);
          const available = cands.filter((c) => !usedIds.has(c.drillId));
          const accent = blockAccent(sb);
          const mins = plan.effMin.get(sb.key) ?? sb.targetMinutes;
          const drillCount = gen?.drills.length ?? 0;
          return (
            <Fragment key={sb.key}>
              <div
                className="w-card pv-sec"
                style={{ position: "relative", overflow: "hidden", padding: "16px 18px 16px 22px" }}
              >
                {/* category accent rail */}
                <div
                  aria-hidden
                  style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent.color, opacity: 0.9 }}
                />

                {/* Section header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                    <div
                      aria-hidden
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        display: "grid",
                        placeItems: "center",
                        background: accent.tint,
                        border: `1px solid ${accent.color}55`,
                        color: accent.color,
                        fontFamily: MONO,
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14.5,
                          fontWeight: 700,
                          color: "var(--uff-text)",
                          letterSpacing: "-0.005em",
                          textWrap: "balance",
                        }}
                      >
                        {sb.name}
                      </div>
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 11,
                          color: "var(--uff-text-mute)",
                          marginTop: 2,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {mins} min{drillCount > 0 ? ` · ${drillCount} drill${drillCount === 1 ? "" : "s"}` : ""}
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                    {isSkill && (
                      <button
                        type="button"
                        className="wbtn ghost"
                        disabled={busyKey === sb.key}
                        onClick={() => handleRegenerate(sb.key)}
                        style={{ height: 32, padding: "0 10px", fontSize: 12, color: "var(--uff-orange)", marginRight: 4 }}
                      >
                        {busyKey === sb.key ? "…" : "↻ Regenerate"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="pv-ic"
                      onClick={() => moveBlock(sb.key, -1)}
                      disabled={i === 0}
                      aria-label="Move block up"
                      title="Move up"
                    >
                      <ArrowIcon dir="up" />
                    </button>
                    <button
                      type="button"
                      className="pv-ic"
                      onClick={() => moveBlock(sb.key, 1)}
                      disabled={i === plan.orderedBlocks.length - 1}
                      aria-label="Move block down"
                      title="Move down"
                    >
                      <ArrowIcon dir="down" />
                    </button>
                    <button
                      type="button"
                      className="pv-ic danger"
                      onClick={() => deleteBlock(sb.key)}
                      aria-label="Delete block"
                      title="Delete block"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {gen?.rationale && (
                  <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--uff-text-dim)", textWrap: "pretty" }}>
                    {gen.rationale}
                  </p>
                )}

                {/* Drills */}
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {gen?.drills.map((d, di) => (
                    <div
                      key={`${d.drillId}-${di}`}
                      style={{
                        background: "var(--uff-surface-2)",
                        border: "1px solid var(--uff-line-soft)",
                        borderRadius: 12,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <DrillSwap
                          value={d.drillId}
                          options={swapOptions(d.drillId, cands, names)}
                          onChange={(id) => swapDrill(sb.key, di, id)}
                        />
                        <button
                          type="button"
                          className="pv-remove"
                          onClick={() => rejectDrill(sb.key, di)}
                          aria-label="Remove drill"
                          style={{
                            appearance: "none",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--uff-text-mute)",
                            flexShrink: 0,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      {d.coachingCue && (
                        <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.45, color: "var(--uff-text-dim)", textWrap: "pretty" }}>
                          {d.coachingCue}
                        </p>
                      )}
                    </div>
                  ))}

                  {drillCount === 0 && (
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--uff-text-mute)" }}>
                      No drills yet — this block won&apos;t take time until you add one.
                    </p>
                  )}

                  {available.length > 0 && (
                    <select
                      className="pv-add"
                      value=""
                      onChange={(e) => addDrill(sb.key, e.target.value)}
                      aria-label="Add a drill that fits this block"
                      style={{
                        appearance: "none",
                        WebkitAppearance: "none",
                        MozAppearance: "none",
                        width: "100%",
                        height: 40,
                        borderRadius: 11,
                        background: `${CHEVRON} no-repeat right 14px center`,
                        backgroundColor: "transparent",
                        border: "1px dashed var(--uff-line-soft)",
                        color: "var(--uff-text-mute)",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        padding: "0 38px 0 14px",
                      }}
                    >
                      <option value="" disabled>
                        + Add a drill that fits this block
                      </option>
                      {available.map((c) => (
                        <option key={c.drillId} value={c.drillId}>
                          {c.drillName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Gap proposals */}
                {gen?.gapProposals.map((g) => (
                  <div
                    key={g.skillId}
                    style={{
                      marginTop: 12,
                      borderRadius: 12,
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
                          background: "var(--uff-orange)",
                          color: "#1a0e02",
                          border: "none",
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

        {plan.orderedBlocks.length === 0 && (
          <div
            className="w-card"
            style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--uff-text-mute)" }}
          >
            Every block was removed. Use <strong style={{ color: "var(--uff-text-dim)" }}>Start over</strong> to rebuild the plan.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className="wbtn primary"
          disabled={accepting || plan.orderedBlocks.length === 0}
          onClick={handleAccept}
          style={{ height: 44, padding: "0 22px", fontSize: 14 }}
        >
          {accepting ? "Saving…" : (<><Icon.check size={14} /> Accept &amp; open in editor</>)}
        </button>
        <button type="button" className="wbtn ghost" onClick={onRegenerateAll} style={{ height: 44 }}>
          Start over
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

function ArrowIcon({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {dir === "up" ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  );
}

// All aligned candidates for a block as {id,name}, ensuring the current pick is present.
function swapOptions(
  currentId: string,
  cands: { drillId: string; drillName: string }[],
  names: Map<string, string>,
): { id: string; name: string }[] {
  const opts = cands.map((c) => ({ id: c.drillId, name: c.drillName }));
  if (!opts.some((o) => o.id === currentId)) opts.unshift({ id: currentId, name: names.get(currentId) ?? "Drill" });
  return opts;
}

// The drill name IS the swap control — a select styled as the title. Falls back
// to static text when there's no alternative to swap to.
function DrillSwap({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; name: string }[];
  onChange: (id: string) => void;
}) {
  const current = options.find((o) => o.id === value);
  if (options.length <= 1) {
    return <span style={{ fontSize: 14, fontWeight: 600, color: "var(--uff-text)" }}>{current?.name ?? "Drill"}</span>;
  }
  return (
    <select
      className="pv-swap"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Swap drill"
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        background: `${CHEVRON} no-repeat right 4px center`,
        backgroundColor: "transparent",
        border: "none",
        color: "var(--uff-text)",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        padding: "4px 24px 4px 8px",
        marginLeft: -8,
        maxWidth: "100%",
      }}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

function WaterBreakRow({ minutes }: { minutes: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "-4px 0",
        padding: "8px 14px",
        borderRadius: 10,
        border: "1px dashed var(--uff-line-soft)",
        background: "var(--uff-surface-2)",
        fontSize: 12.5,
        color: "var(--uff-text-mute)",
      }}
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2.7 6.4 9.5a7 7 0 1 0 11.2 0Z" />
      </svg>
      <span style={{ fontWeight: 600, color: "var(--uff-text-dim)" }}>Water break</span>
      <span style={{ fontFamily: MONO, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{minutes} min</span>
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
