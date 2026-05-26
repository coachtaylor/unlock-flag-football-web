"use client";

// The practice editor — Build 5.5 marquee surface. Renders the block
// model: blocks → drills (with parallel groups, per-drill cues, duration
// + reps), between-block water breaks, plus an attendance / block-library
// sheet pair. Save goes through replace_practice_plan_blocks via the
// server action.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  PracticePlan,
  PlanBlock,
  PlanDrill,
  PlanBreak,
  PlanStatus,
} from "@/lib/practice/plan-data";
import { blockMinutes, interleavePlan, planTotals } from "@/lib/practice/plan-data";
import { blockColor } from "@/lib/practice/block-colors";
import {
  PracticeStatusPill,
  PIcon,
  formatDateLabel,
  durLabel,
} from "./atoms";
import { DurStepper } from "./DurStepper";
import {
  savePlan,
  deletePlan,
  saveAttendance,
  type SaveBlockInput,
} from "@/lib/practice/actions";

// ── Drill catalog passed in from the server ────────────────────────────
export type DrillCatalogEntry = {
  id: string;
  name: string;
  category_name: string | null;
  benchmark_types: string[];
  default_duration_min: number | null;
  default_reps: number | null;
  description: string | null;
};

export type BlockTemplateEntry = {
  id: string;
  name: string;
};

export type RosterEntry = {
  id: string;
  display_name: string;
  position: string | null;
  initials: string;
  color: string;
};

export type EditorPlan = PracticePlan & { teamId: string };

type Props = {
  plan: EditorPlan;
  drillCatalog: DrillCatalogEntry[];
  blockTemplates: BlockTemplateEntry[];
  roster: RosterEntry[];
};

// Local editable shapes — kept loose so we can build up an unsaved plan
// without forcing the strict schema. Drill rows get a synthetic `key`
// when they're created locally (no DB id yet).
type EditDrill = PlanDrill & { key: string };
type EditBlock = Omit<PlanBlock, "drills"> & { drills: EditDrill[]; key: string };
type EditBreak = PlanBreak & { key: string };

let __cid = 0;
const cid = (prefix: string) => `${prefix}-${++__cid}-${Date.now()}`;

// Add minutes to a "HH:MM" or "HH:MM:SS" time string, wrapping past midnight.
// Returns the same shape it was given. Used to keep End time in sync with
// Start time (default offset = 120 = 2h).
function addMinutes(time: string, minutes: number): string {
  const [hStr, mStr, sStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const total = (h * 60 + m + minutes) % (24 * 60);
  const wrapped = total < 0 ? total + 24 * 60 : total;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return sStr !== undefined ? `${hh}:${mm}:${sStr}` : `${hh}:${mm}`;
}

function toEdit(plan: EditorPlan): {
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  status: PlanStatus;
  blocks: EditBlock[];
  breaks: EditBreak[];
  attendees: Record<string, boolean | null>;
} {
  return {
    title: plan.title,
    date: plan.practice_date,
    start_time: plan.start_time,
    end_time: plan.end_time,
    status: plan.status,
    blocks: plan.blocks.map((b) => ({
      ...b,
      key: b.id,
      drills: b.drills.map((d) => ({ ...d, key: d.id })),
    })),
    breaks: plan.breaks.map((br) => ({ ...br, key: br.id })),
    attendees: Object.fromEntries(plan.attendees.map((a) => [a.player_id, a.rsvp])),
  };
}

export default function EditorClient({ plan, drillCatalog, blockTemplates, roster }: Props) {
  const router = useRouter();
  const initial = toEdit(plan);
  const [title, setTitle] = useState(initial.title);
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState<string | null>(initial.start_time);
  const [endTime, setEndTime] = useState<string | null>(initial.end_time);
  const [status, setStatus] = useState<PlanStatus>(initial.status);
  const [blocks, setBlocks] = useState<EditBlock[]>(initial.blocks);
  const [breaks, setBreaks] = useState<EditBreak[]>(initial.breaks);
  const [attendees, setAttendees] = useState<Record<string, boolean | null>>(initial.attendees);
  const [expandedDrillKey, setExpandedDrillKey] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"none" | "blocks" | "attendance" | "drills">("none");
  const [drillPickerBlock, setDrillPickerBlock] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Derived totals — recompute on every mutation
  const projection = useMemo((): PracticePlan => {
    return {
      id: plan.id,
      team_id: plan.team_id,
      title,
      practice_date: date,
      start_time: startTime,
      end_time: endTime,
      status,
      notes: plan.notes,
      blocks: blocks.map((b) => ({ ...b, drills: b.drills })),
      breaks: breaks,
      attendees: Object.entries(attendees).map(([player_id, rsvp]) => ({
        player_id,
        rsvp,
        attended: null,
      })),
    };
  }, [title, date, startTime, status, blocks, breaks, attendees, plan]);

  const t = planTotals(projection);
  const overBudget = t.total > t.target && t.target > 0;
  const remaining = t.target - t.total;
  const rsvpIn = Object.values(attendees).filter((v) => v === true).length;
  const rsvpOut = Object.values(attendees).filter((v) => v === false).length;
  const rsvpNoResp = roster.length - rsvpIn - rsvpOut;

  // ── Mutators ─────────────────────────────────────────────────────────
  function updateBlock(key: string, patch: Partial<EditBlock>) {
    setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }
  function updateDrill(blockKey: string, drillKey: string, patch: Partial<EditDrill>) {
    setBlocks((bs) =>
      bs.map((b) =>
        b.key !== blockKey
          ? b
          : {
              ...b,
              drills: b.drills.map((d) => (d.key === drillKey ? { ...d, ...patch } : d)),
            },
      ),
    );
  }
  function removeDrill(blockKey: string, drillKey: string) {
    setBlocks((bs) =>
      bs.map((b) => (b.key !== blockKey ? b : { ...b, drills: b.drills.filter((d) => d.key !== drillKey) })),
    );
  }
  function reorderDrill(blockKey: string, drillKey: string, dir: -1 | 1) {
    setBlocks((bs) =>
      bs.map((b) => {
        if (b.key !== blockKey) return b;
        const i = b.drills.findIndex((d) => d.key === drillKey);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= b.drills.length) return b;
        const cp = b.drills.slice();
        [cp[i], cp[j]] = [cp[j], cp[i]];
        return { ...b, drills: cp };
      }),
    );
  }
  function addBlock(name: string = "New block", templateId: string | null = null) {
    setBlocks((bs) => {
      const key = cid("blk");
      return [
        ...bs,
        {
          id: key,
          key,
          name,
          block_order: bs.length,
          target_minutes: 15,
          template_id: templateId,
          drills: [],
        },
      ];
    });
  }
  function removeBlock(blockKey: string) {
    // Find the removed block's order BEFORE we drop it, so we can fix up
    // breaks anchored to it (delete the ones pointing AT the removed
    // block, shift higher anchors down by 1).
    setBlocks((bs) => {
      const removed = bs.find((b) => b.key === blockKey);
      if (!removed) return bs;
      const removedOrder = removed.block_order;
      setBreaks((br) =>
        br
          .filter((b) => b.after_block_order !== removedOrder)
          .map((b) =>
            b.after_block_order > removedOrder
              ? { ...b, after_block_order: b.after_block_order - 1 }
              : b,
          ),
      );
      return bs.filter((b) => b.key !== blockKey).map((b, i) => ({ ...b, block_order: i }));
    });
  }
  function reorderBlock(blockKey: string, dir: -1 | 1) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.key === blockKey);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const cp = bs.slice();
      [cp[i], cp[j]] = [cp[j], cp[i]];
      const reindexed = cp.map((b, k) => ({ ...b, block_order: k }));
      // Breaks were anchored to the OLD block_orders at positions i and j.
      // After the swap, the block formerly at i is now at j and vice versa,
      // so a break anchored to i should now be anchored to j (and vice
      // versa) to stay attached to the same block.
      setBreaks((br) =>
        br.map((b) => {
          if (b.after_block_order === i) return { ...b, after_block_order: j };
          if (b.after_block_order === j) return { ...b, after_block_order: i };
          return b;
        }),
      );
      return reindexed;
    });
  }
  function addDrillToBlock(blockKey: string, drill: DrillCatalogEntry) {
    setBlocks((bs) =>
      bs.map((b) =>
        b.key !== blockKey
          ? b
          : {
              ...b,
              drills: [
                ...b.drills,
                {
                  id: cid("dr"),
                  key: cid("dr"),
                  drill_id: drill.id,
                  drill_name: drill.name,
                  drill_order: b.drills.length,
                  duration_minutes: drill.default_duration_min ?? 10,
                  reps_count: drill.default_reps ?? null,
                  notes: null,
                  parallel_group: null,
                  is_water_break: false,
                  benchmark_types: drill.benchmark_types,
                  category_name: drill.category_name,
                  description: drill.description,
                },
              ],
            },
      ),
    );
  }
  function pairAsParallel(blockKey: string) {
    // Pair the LAST two drills in the block. Assigns a fresh parallel_group
    // index (max+1 across the whole plan) so it's globally unique per the
    // RPC's cross-block validation.
    setBlocks((bs) => {
      const allPg = bs.flatMap((b) => b.drills.map((d) => d.parallel_group ?? 0));
      const nextPg = (allPg.length > 0 ? Math.max(...allPg) : 0) + 1;
      return bs.map((b) => {
        if (b.key !== blockKey) return b;
        if (b.drills.length < 2) return b;
        const last = b.drills.length - 1;
        const cp = b.drills.slice();
        cp[last] = { ...cp[last], parallel_group: nextPg };
        cp[last - 1] = { ...cp[last - 1], parallel_group: nextPg };
        return { ...b, drills: cp };
      });
    });
  }
  function insertBreakAfter(blockOrder: number) {
    setBreaks((br) => [
      ...br,
      {
        id: cid("br"),
        key: cid("br"),
        after_block_order: blockOrder,
        break_order: br.length,
        duration_minutes: 2,
      },
    ]);
  }
  function updateBreak(brKey: string, minutes: number) {
    setBreaks((br) => br.map((b) => (b.key === brKey ? { ...b, duration_minutes: minutes } : b)));
  }
  function removeBreak(brKey: string) {
    setBreaks((br) => br.filter((b) => b.key !== brKey));
  }

  // ── Save ─────────────────────────────────────────────────────────────
  function buildPayloadBlocks(): SaveBlockInput[] {
    return blocks.map((b, i) => ({
      template_id: b.template_id,
      name: b.name,
      block_order: i,
      target_minutes: b.target_minutes ?? null,
      drills: b.drills.map((d, di) => ({
        drill_id: d.drill_id,
        drill_order: di,
        duration_minutes: d.duration_minutes,
        reps_count: d.reps_count,
        notes: d.notes,
        parallel_group: d.parallel_group,
      })),
    }));
  }

  async function commitSave(nextStatus: "draft" | "scheduled") {
    setError(null);
    // Drop orphan breaks (whose after_block_order doesn't point at an
    // existing block) before saving — they'd never render anyway, and
    // sending them would silently inflate the total on the next load.
    const validOrders = new Set<number>(blocks.map((b, i) => i));
    validOrders.add(-1);
    const visibleBreaksPayload = breaks
      .filter((br) => validOrders.has(br.after_block_order))
      .map((br, i) => ({
        after_block_order: br.after_block_order,
        break_order: i,
        duration_minutes: br.duration_minutes,
      }));
    const res = await savePlan({
      plan_id: plan.id,
      title,
      practice_date: date,
      start_time: startTime,
      end_time: endTime,
      status: nextStatus,
      blocks: buildPayloadBlocks(),
      breaks: visibleBreaksPayload,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (nextStatus === "scheduled") {
      router.push(`/practice/${plan.id}`);
      return;
    }
    setStatus(nextStatus);
    router.refresh();
  }

  async function commitAttendance() {
    const rows = Object.entries(attendees)
      .filter(([, v]) => v !== null)
      .map(([player_id, rsvp]) => ({ player_id, rsvp: rsvp as boolean }));
    const res = await saveAttendance(plan.id, rows);
    if (!res.ok) setError(res.error);
    setSheet("none");
  }

  async function discardAndDelete() {
    if (!confirm("Discard this plan? This deletes the draft.")) return;
    await deletePlan(plan.id);
    router.push("/practice");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 720px) 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ── MAIN COLUMN ────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Plan details */}
          <div className="w-card" style={{ padding: 18 }}>
            <div className="sect-head" style={{ marginBottom: 14 }}>
              <div className="title">
                <span className="tk" />
                Practice details
              </div>
              <PracticeStatusPill status={status} mini />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <FieldRow label="Title">
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle()} />
              </FieldRow>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10 }}>
                <FieldRow label="Date">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle()} />
                </FieldRow>
                <FieldRow label="Start time">
                  <input
                    type="time"
                    step={300}
                    value={startTime ?? ""}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      setStartTime(v);
                      // Auto-bump end time to start + 2h. Always — if a
                      // user wants a different end they can set it after.
                      setEndTime(v ? addMinutes(v, 120) : null);
                    }}
                    style={inputStyle()}
                  />
                </FieldRow>
                <FieldRow label="End time">
                  <input
                    type="time"
                    step={300}
                    value={endTime ?? ""}
                    onChange={(e) => setEndTime(e.target.value || null)}
                    style={inputStyle()}
                  />
                </FieldRow>
              </div>
            </div>
          </div>

          {/* Time budget strip */}
          <BudgetStrip plan={projection} over={overBudget} remaining={remaining} />

          {/* Blocks + breaks */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {blocks.length === 0 && <EmptyPlanState onAdd={() => addBlock("Warm-up")} />}

            {interleavePlan(projection).map((row) => {
              if (row.kind === "break") {
                const br = breaks.find((b) => b.id === row.payload.id || b.key === row.payload.id);
                if (!br) return null;
                return (
                  <WaterBreakRow
                    key={br.key}
                    minutes={br.duration_minutes}
                    onChange={(v) => updateBreak(br.key, v)}
                    onRemove={() => removeBreak(br.key)}
                  />
                );
              }
              const block = blocks.find((b) => b.id === row.payload.id || b.key === row.payload.id);
              if (!block) return null;
              const blockIndex = blocks.findIndex((b) => b.key === block.key);
              const hasBreakAfter = !!breaks.find((br) => br.after_block_order === block.block_order);
              return (
                <div key={block.key}>
                  <BlockEditCard
                    block={block}
                    blockIndex={blockIndex}
                    expandedDrillKey={expandedDrillKey}
                    setExpandedDrillKey={setExpandedDrillKey}
                    onUpdate={(patch) => updateBlock(block.key, patch)}
                    onUpdateDrill={(dk, patch) => updateDrill(block.key, dk, patch)}
                    onRemoveDrill={(dk) => removeDrill(block.key, dk)}
                    onReorderDrill={(dk, dir) => reorderDrill(block.key, dk, dir)}
                    onAddDrill={() => {
                      setDrillPickerBlock(block.key);
                      setSheet("drills");
                    }}
                    onPairParallel={() => pairAsParallel(block.key)}
                    onReorderBlock={(dir) => reorderBlock(block.key, dir)}
                    onRemoveBlock={() => removeBlock(block.key)}
                  />
                  {!hasBreakAfter && <InsertBreakRail onInsert={() => insertBreakAfter(block.block_order)} />}
                </div>
              );
            })}
          </div>

          {/* Add block actions */}
          <AddBlockRail onAddBlank={() => addBlock()} onAddFromLibrary={() => setSheet("blocks")} />

          {error && (
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(255,77,77,0.08)",
                border: "1px solid rgba(255,77,77,0.30)",
                borderRadius: 10,
                color: "var(--uff-red)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Bottom action row */}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="wbtn ghost" onClick={discardAndDelete}>
              Discard
            </button>
            <span style={{ flex: 1 }} />
            <Link href={`/practice/${plan.id}`} className="wbtn">
              Cancel
            </Link>
            <button
              type="button"
              className="wbtn"
              onClick={() => startTransition(() => commitSave("draft"))}
              disabled={isPending}
            >
              Save draft
            </button>
            <button
              type="button"
              className="wbtn primary"
              onClick={() => startTransition(() => commitSave("scheduled"))}
              disabled={isPending || blocks.length === 0}
            >
              <PIcon.check size={13} /> Save & schedule
            </button>
          </div>
        </div>

        {/* ── SIDE RAIL ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 80 }}>
          <RsvpRailCard
            rsvpIn={rsvpIn}
            rsvpOut={rsvpOut}
            rsvpNoResp={rsvpNoResp}
            total={roster.length}
            onManage={() => setSheet("attendance")}
          />
          <PlanTotalsCard plan={projection} />
          <TipCard />
        </div>
      </div>

      {/* Sheets */}
      {sheet === "blocks" && (
        <BlockLibrarySheet
          templates={blockTemplates}
          onClose={() => setSheet("none")}
          onPickBlank={() => {
            addBlock("Block");
            setSheet("none");
          }}
          onPickTemplate={(tpl) => {
            addBlock(tpl.name, tpl.id);
            setSheet("none");
          }}
        />
      )}
      {sheet === "drills" && drillPickerBlock && (
        <DrillPickerSheet
          catalog={drillCatalog}
          onClose={() => {
            setSheet("none");
            setDrillPickerBlock(null);
          }}
          onPick={(drill) => {
            addDrillToBlock(drillPickerBlock, drill);
            setSheet("none");
            setDrillPickerBlock(null);
          }}
        />
      )}
      {sheet === "attendance" && (
        <AttendanceSheet
          roster={roster}
          attendees={attendees}
          dateLabel={formatDateLabel(date)}
          onClose={() => setSheet("none")}
          onChange={(playerId, rsvp) => setAttendees((a) => ({ ...a, [playerId]: rsvp }))}
          onBulkIn={() => setAttendees(Object.fromEntries(roster.map((p) => [p.id, true])))}
          onReset={() => setAttendees({})}
          onSave={commitAttendance}
        />
      )}
    </div>
  );
}

// ── Field row + input ──────────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    height: 36,
    padding: "0 12px",
    background: "var(--uff-surface-2)",
    border: "1px solid var(--uff-line-soft)",
    borderRadius: 8,
    color: "var(--uff-text)",
    fontFamily: "inherit",
    fontSize: 13,
    outline: "none",
  };
}

// ── Budget strip ───────────────────────────────────────────────────────
function BudgetStrip({
  plan,
  over,
  remaining,
}: {
  plan: PracticePlan;
  over: boolean;
  remaining: number;
}) {
  const t = planTotals(plan);
  const denom = Math.max(t.target, t.total, 1);
  return (
    <div className="w-card subdued" style={{ padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ minWidth: 110 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".14em",
              color: "var(--uff-text-mute)",
              textTransform: "uppercase",
            }}
          >
            {over ? "Over budget" : "Remaining"}
          </div>
          <div
            className="mono"
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 22,
              fontWeight: 700,
              color: over ? "var(--uff-red)" : "var(--uff-lime)",
              marginTop: 2,
              letterSpacing: "-0.01em",
            }}
          >
            {over ? "+" : ""}
            {Math.abs(remaining)}
            <span style={{ fontSize: 12, marginLeft: 2 }}>m</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              height: 10,
              borderRadius: 5,
              overflow: "hidden",
              background: "rgba(255,255,255,0.04)",
              display: "flex",
            }}
          >
            {interleavePlan(plan).map((row) => {
              if (row.kind === "block") {
                const mn = blockMinutes(row.payload);
                const c = blockColor(row.payload.name);
                return (
                  <div
                    key={row.payload.id}
                    style={{
                      width: `${(mn / denom) * 100}%`,
                      background: c.accent,
                      opacity: 0.95,
                      borderRight: "1px solid #08090B",
                    }}
                  />
                );
              }
              return (
                <div
                  key={row.payload.id}
                  style={{
                    width: `${(row.payload.duration_minutes / denom) * 100}%`,
                    background: "#6EA8FF",
                    opacity: 0.7,
                    borderRight: "1px solid #08090B",
                  }}
                />
              );
            })}
          </div>
        </div>
        <div style={{ minWidth: 96, textAlign: "right" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".14em",
              color: "var(--uff-text-mute)",
              textTransform: "uppercase",
            }}
          >
            Total / Target
          </div>
          <div
            className="mono"
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--uff-text)",
              marginTop: 2,
            }}
          >
            {t.total}m <span style={{ color: "var(--uff-text-mute)" }}>/ {t.target}m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Block edit card ────────────────────────────────────────────────────
function BlockEditCard({
  block,
  blockIndex,
  expandedDrillKey,
  setExpandedDrillKey,
  onUpdate,
  onUpdateDrill,
  onRemoveDrill,
  onReorderDrill,
  onAddDrill,
  onPairParallel,
  onReorderBlock,
  onRemoveBlock,
}: {
  block: EditBlock;
  blockIndex: number;
  expandedDrillKey: string | null;
  setExpandedDrillKey: (k: string | null) => void;
  onUpdate: (patch: Partial<EditBlock>) => void;
  onUpdateDrill: (dk: string, patch: Partial<EditDrill>) => void;
  onRemoveDrill: (dk: string) => void;
  onReorderDrill: (dk: string, dir: -1 | 1) => void;
  onAddDrill: () => void;
  onPairParallel: () => void;
  onReorderBlock: (dir: -1 | 1) => void;
  onRemoveBlock: () => void;
}) {
  const c = blockColor(block.name);
  const [collapsed, setCollapsed] = useState(false);

  // Group drills by parallel_group
  type Group = { kind: "solo"; drills: EditDrill[] } | { kind: "parallel"; drills: EditDrill[] };
  const groups: Group[] = [];
  const seen = new Set<number>();
  for (const d of block.drills) {
    if (d.parallel_group == null) {
      groups.push({ kind: "solo", drills: [d] });
      continue;
    }
    if (seen.has(d.parallel_group)) continue;
    seen.add(d.parallel_group);
    const siblings = block.drills.filter((x) => x.parallel_group === d.parallel_group);
    groups.push({ kind: "parallel", drills: siblings });
  }
  const blockMin = blockMinutes(block);

  return (
    <div
      style={{
        background: "var(--uff-surface)",
        border: "1px solid var(--uff-line-soft)",
        borderLeft: `4px solid ${c.accent}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px 12px 12px",
          background: c.tint,
          borderBottom: collapsed ? "none" : `1px solid ${c.border}`,
        }}
      >
        <button type="button" onClick={() => setCollapsed((v) => !v)} style={iconBtnStyle()}>
          {collapsed ? <PIcon.chevR size={13} /> : <PIcon.chevDn size={13} />}
        </button>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: c.accent,
            color: "#1a0f08",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10.5,
            fontWeight: 800,
          }}
        >
          {String(blockIndex + 1).padStart(2, "0")}
        </span>
        <input
          type="text"
          value={block.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: 0,
            outline: "none",
            color: "var(--uff-text)",
            fontFamily: "inherit",
            fontSize: 14.5,
            fontWeight: 700,
            letterSpacing: "-0.005em",
            padding: "4px 2px",
          }}
        />
        <span
          style={{
            fontSize: 10.5,
            color: "var(--uff-text-mute)",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            letterSpacing: ".04em",
          }}
        >
          {block.drills.length} drill{block.drills.length === 1 ? "" : "s"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            className="mono"
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 13,
              fontWeight: 700,
              color: c.accent,
            }}
          >
            {blockMin}m
          </span>
          <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>/</span>
          <DurStepper
            value={block.target_minutes ?? 0}
            onChange={(v) => onUpdate({ target_minutes: v })}
            step={5}
            accent={c.accent}
            width={106}
            min={0}
          />
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {groups.map((g, gi) => {
              if (g.kind === "solo") {
                const d = g.drills[0];
                const expanded = expandedDrillKey === d.key;
                return (
                  <DrillEditRow
                    key={d.key}
                    d={d}
                    accent={c.accent}
                    expanded={expanded}
                    onToggle={() => setExpandedDrillKey(expanded ? null : d.key)}
                    onChange={(patch) => onUpdateDrill(d.key, patch)}
                    onRemove={() => onRemoveDrill(d.key)}
                    onReorder={(dir) => onReorderDrill(d.key, dir)}
                  />
                );
              }
              return (
                <ParallelGroup
                  key={"pg" + gi}
                  drills={g.drills}
                  accent={c.accent}
                  expandedDrillKey={expandedDrillKey}
                  setExpandedDrillKey={setExpandedDrillKey}
                  onChange={onUpdateDrill}
                  onRemove={onRemoveDrill}
                  onReorder={onReorderDrill}
                />
              );
            })}
            {block.drills.length === 0 && (
              <div
                style={{
                  padding: "14px 12px",
                  border: "1px dashed var(--uff-line)",
                  borderRadius: 10,
                  color: "var(--uff-text-mute)",
                  fontSize: 12.5,
                  textAlign: "center",
                }}
              >
                No drills yet — add one from your library below.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={onAddDrill} style={quickActionBtn("var(--uff-orange)")}>
              <PIcon.plus size={13} /> Add drill
            </button>
            <button
              type="button"
              onClick={onPairParallel}
              disabled={block.drills.length < 2}
              style={{ ...quickActionBtn("#B89BFF"), opacity: block.drills.length < 2 ? 0.4 : 1 }}
            >
              <PIcon.split size={13} /> Pair as parallel
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => onReorderBlock(-1)} className="icon-btn" style={{ width: 30, height: 30 }} title="Move block up">
              <PIcon.up size={13} />
            </button>
            <button type="button" onClick={() => onReorderBlock(1)} className="icon-btn" style={{ width: 30, height: 30 }} title="Move block down">
              <PIcon.dn size={13} />
            </button>
            <button
              type="button"
              onClick={onRemoveBlock}
              className="icon-btn"
              style={{ width: 30, height: 30, color: "var(--uff-red)" }}
              title="Delete block"
            >
              <PIcon.trash size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Drill edit row (collapsed + expanded inline) ────────────────────────
function DrillEditRow({
  d,
  accent,
  expanded,
  onToggle,
  onChange,
  onRemove,
  onReorder,
  isParallelSibling,
  onUnpair,
}: {
  d: EditDrill;
  accent: string;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<EditDrill>) => void;
  onRemove: () => void;
  onReorder: (dir: -1 | 1) => void;
  isParallelSibling?: boolean;
  onUnpair?: () => void;
}) {
  if (!expanded) {
    return (
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--uff-line-soft)",
          borderRadius: 10,
          borderLeft: `3px solid ${accent}`,
          cursor: "pointer",
        }}
      >
        <span style={{ color: "var(--uff-text-mute)", display: "flex" }}>
          <PIcon.drag size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--uff-text)",
              letterSpacing: "-0.005em",
            }}
          >
            {d.drill_name ?? "Drill"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
            {d.category_name && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--uff-text-mute)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                {d.category_name}
              </span>
            )}
            {d.reps_count != null && d.reps_count > 0 && (
              <span
                className="mono"
                style={{
                  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                  fontSize: 10.5,
                  color: "var(--uff-text-dim)",
                  letterSpacing: ".04em",
                }}
              >
                {d.reps_count} reps
              </span>
            )}
            {d.benchmark_types.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--uff-orange)" }}>
                <PIcon.bench size={9} />
                <span
                  className="mono"
                  style={{
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: ".12em",
                  }}
                >
                  BENCH
                </span>
              </span>
            )}
            {d.notes && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--uff-text-mute)",
                  fontStyle: "italic",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 220,
                }}
              >
                &ldquo;{d.notes}&rdquo;
              </span>
            )}
          </div>
        </div>
        <span
          className="mono"
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--uff-text)",
          }}
        >
          {d.duration_minutes}
          <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 1 }}>m</span>
        </span>
        <span style={{ color: "var(--uff-text-mute)" }}>
          <PIcon.chevDn size={13} />
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${accent}33`,
        borderRadius: 10,
        borderLeft: `3px solid ${accent}`,
        overflow: "hidden",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderBottom: "1px dashed var(--uff-line)",
          cursor: "pointer",
        }}
      >
        <span style={{ color: "var(--uff-text-mute)", display: "flex" }}>
          <PIcon.drag size={14} />
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            color: "var(--uff-text)",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          {d.drill_name ?? "Drill"}
        </span>
        <span style={{ color: "var(--uff-text-mute)" }}>
          <PIcon.chevUp size={13} />
        </span>
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        {d.description && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".14em",
                color: "var(--uff-text-mute)",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              From drill library
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--uff-line-soft)",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "var(--uff-text-dim)",
              }}
            >
              {d.description}
            </div>
            {d.drill_id && (
              <Link
                href={`/drills/${d.drill_id}`}
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  color: accent,
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: ".04em",
                  marginTop: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  textDecoration: "none",
                }}
              >
                Open full drill <PIcon.chevR size={10} />
              </Link>
            )}
          </div>
        )}

        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".14em",
              color: "var(--uff-text-mute)",
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            Cues for today
          </div>
          <textarea
            value={d.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Notes the team will see during practice…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              minHeight: 56,
              resize: "vertical",
              background: "var(--uff-surface-2)",
              border: "1px solid var(--uff-line-soft)",
              borderRadius: 8,
              color: "var(--uff-text)",
              fontFamily: "inherit",
              fontSize: 13,
              lineHeight: 1.55,
              padding: "10px 12px",
              outline: "none",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".14em",
                  color: "var(--uff-text-mute)",
                  textTransform: "uppercase",
                }}
              >
                Duration
              </span>
              <DurStepper value={d.duration_minutes} onChange={(v) => onChange({ duration_minutes: v })} accent={accent} width={104} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".14em",
                  color: "var(--uff-text-mute)",
                  textTransform: "uppercase",
                }}
              >
                Reps
              </span>
              <DurStepper
                value={d.reps_count ?? 0}
                onChange={(v) => onChange({ reps_count: v === 0 ? null : v })}
                accent="var(--uff-text)"
                suffix="×"
                width={94}
                min={0}
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => onReorder(-1)}>
              <PIcon.up size={13} />
            </button>
            <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => onReorder(1)}>
              <PIcon.dn size={13} />
            </button>
            {isParallelSibling && onUnpair ? (
              <button
                type="button"
                className="icon-btn"
                style={{ width: 30, height: 30, color: "#B89BFF" }}
                title="Un-pair from parallel"
                onClick={onUnpair}
              >
                <PIcon.split size={13} />
              </button>
            ) : null}
            <button
              type="button"
              className="icon-btn"
              style={{ width: 30, height: 30, color: "var(--uff-red)" }}
              onClick={onRemove}
            >
              <PIcon.trash size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParallelGroup({
  drills,
  accent,
  expandedDrillKey,
  setExpandedDrillKey,
  onChange,
  onRemove,
  onReorder,
}: {
  drills: EditDrill[];
  accent: string;
  expandedDrillKey: string | null;
  setExpandedDrillKey: (k: string | null) => void;
  onChange: (dk: string, patch: Partial<EditDrill>) => void;
  onRemove: (dk: string) => void;
  onReorder: (dk: string, dir: -1 | 1) => void;
}) {
  const maxMin = Math.max(...drills.map((d) => d.duration_minutes));
  return (
    <div
      style={{
        background: "rgba(184,155,255,0.04)",
        border: "1px solid rgba(184,155,255,0.25)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "rgba(184,155,255,0.06)",
          borderBottom: "1px dashed rgba(184,155,255,0.30)",
        }}
      >
        <span style={{ color: "#B89BFF", display: "flex" }}>
          <PIcon.split size={12} />
        </span>
        <span
          className="mono"
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: ".14em",
            color: "#B89BFF",
          }}
        >
          PARALLEL · counts once
        </span>
        <span style={{ flex: 1 }} />
        <span
          className="mono"
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 11,
            color: "var(--uff-text-dim)",
          }}
        >
          {maxMin}m slot · longest wins
        </span>
      </div>
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {drills.map((d) => {
          const expanded = expandedDrillKey === d.key;
          return (
            <DrillEditRow
              key={d.key}
              d={d}
              accent={accent}
              expanded={expanded}
              onToggle={() => setExpandedDrillKey(expanded ? null : d.key)}
              onChange={(patch) => onChange(d.key, patch)}
              onRemove={() => onRemove(d.key)}
              onReorder={(dir) => onReorder(d.key, dir)}
              isParallelSibling
              onUnpair={() => onChange(d.key, { parallel_group: null })}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Water break + insert rail ──────────────────────────────────────────
function WaterBreakRow({
  minutes,
  onChange,
  onRemove,
}: {
  minutes: number;
  onChange: (v: number) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        background: "rgba(110,168,255,0.05)",
        border: "1px dashed rgba(110,168,255,0.30)",
        borderRadius: 10,
        padding: "10px 14px 10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginLeft: 20,
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: "rgba(110,168,255,0.15)",
          color: "#6EA8FF",
          display: "grid",
          placeItems: "center",
        }}
      >
        <PIcon.water size={12} />
      </div>
      <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--uff-text-dim)" }}>Water break</div>
      <DurStepper value={minutes} onChange={onChange} accent="#6EA8FF" width={100} min={1} max={15} />
      <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} onClick={onRemove}>
        <span style={{ color: "var(--uff-red)" }}>
          <PIcon.trash size={12} />
        </span>
      </button>
    </div>
  );
}

function InsertBreakRail({ onInsert }: { onInsert: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onInsert}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: hover ? 32 : 12,
        marginLeft: 20,
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        transition: "height .14s",
      }}
    >
      {hover ? (
        <div
          style={{
            width: "100%",
            height: 28,
            background: "rgba(110,168,255,0.08)",
            border: "1px dashed rgba(110,168,255,0.40)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "#6EA8FF",
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: ".04em",
          }}
        >
          <PIcon.plus size={12} /> Insert water break
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: 1,
            background: "transparent",
            borderTop: "1px dashed var(--uff-line-soft)",
          }}
        />
      )}
    </div>
  );
}

function AddBlockRail({ onAddBlank, onAddFromLibrary }: { onAddBlank: () => void; onAddFromLibrary: () => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
      <button type="button" onClick={onAddBlank} style={addBlockBtn("var(--uff-orange)")}>
        <PIcon.plus size={14} />
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>New block</span>
          <span style={{ fontSize: 11, color: "var(--uff-text-mute)", fontWeight: 500 }}>
            Empty — name it, set target minutes, add drills
          </span>
        </span>
      </button>
      <button type="button" onClick={onAddFromLibrary} style={addBlockBtn("#7DDFD2")}>
        <PIcon.template size={14} />
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>From block library</span>
          <span style={{ fontSize: 11, color: "var(--uff-text-mute)", fontWeight: 500 }}>
            Reuse a Warm-up, Install or Scrimmage you&rsquo;ve saved
          </span>
        </span>
      </button>
    </div>
  );
}

function EmptyPlanState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        padding: "32px 24px",
        border: "1px dashed var(--uff-line)",
        borderRadius: 14,
        background: "rgba(255,255,255,0.015)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "rgba(255,106,26,0.10)",
          border: "1px solid rgba(255,106,26,0.30)",
          color: "var(--uff-orange)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <PIcon.template size={20} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Start with a block.</div>
        <div style={{ fontSize: 12.5, color: "var(--uff-text-dim)", marginTop: 4, maxWidth: 420 }}>
          A block is a named section of practice — warm-up, install, scrimmage. Add one to begin, then drop drills inside.
        </div>
      </div>
      <button type="button" onClick={onAdd} className="wbtn primary">
        <PIcon.plus size={13} /> Add first block
      </button>
    </div>
  );
}

// ── Side rail components ───────────────────────────────────────────────
function RsvpRailCard({
  rsvpIn,
  rsvpOut,
  rsvpNoResp,
  total,
  onManage,
}: {
  rsvpIn: number;
  rsvpOut: number;
  rsvpNoResp: number;
  total: number;
  onManage: () => void;
}) {
  const pct = total > 0 ? Math.round((rsvpIn / total) * 100) : 0;
  return (
    <div className="w-card" style={{ padding: 16 }}>
      <div className="sect-head" style={{ marginBottom: 12 }}>
        <div className="title">
          <span className="tk" />
          Who&rsquo;s coming
        </div>
        <button type="button" className="wbtn" style={{ height: 28, fontSize: 11, padding: "0 10px" }} onClick={onManage}>
          Set attendance
        </button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          className="mono"
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--uff-lime)",
            letterSpacing: "-0.02em",
          }}
        >
          {rsvpIn}
          <span style={{ fontSize: 13, color: "var(--uff-text-mute)" }}>/{total}</span>
        </span>
        <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>{pct}% confirmed</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          background: "rgba(255,255,255,0.05)",
          display: "flex",
          gap: 1,
          marginBottom: 12,
        }}
      >
        {rsvpIn > 0 && <div style={{ flex: rsvpIn, background: "var(--uff-lime)" }} />}
        {rsvpOut > 0 && <div style={{ flex: rsvpOut, background: "var(--uff-red)" }} />}
        {rsvpNoResp > 0 && <div style={{ flex: rsvpNoResp, background: "rgba(255,255,255,0.05)" }} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <RsvpKey color="var(--uff-lime)" label="In" count={rsvpIn} />
        <RsvpKey color="var(--uff-red)" label="Out" count={rsvpOut} />
        <RsvpKey color="rgba(255,255,255,0.15)" label="No response" count={rsvpNoResp} dim />
      </div>
    </div>
  );
}

function RsvpKey({ color, label, count, dim }: { color: string; label: string; count: number; dim?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        color: dim ? "var(--uff-text-mute)" : "var(--uff-text-dim)",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
      <span style={{ flex: 1 }}>{label}</span>
      <span
        className="mono"
        style={{
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 11.5,
          fontWeight: 700,
          color: dim ? "var(--uff-text-mute)" : "var(--uff-text)",
        }}
      >
        {count}
      </span>
    </div>
  );
}

function PlanTotalsCard({ plan }: { plan: PracticePlan }) {
  const t = planTotals(plan);
  return (
    <div className="w-card subdued" style={{ padding: 14 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Plan totals
      </div>
      <TotalsRow row="Blocks" v={plan.blocks.length} />
      <TotalsRow row="Drills" v={t.drillCount} />
      <TotalsRow row="Water breaks" v={t.breakCount} />
      <TotalsRow row="Parallel slots" v={t.parallelSlots} />
      <TotalsRow row="Total minutes" v={`${t.total}m`} accent />
    </div>
  );
}

function TotalsRow({ row, v, accent }: { row: string; v: React.ReactNode; accent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "4px 0",
        borderTop: "1px solid var(--uff-line-soft)",
      }}
    >
      <span style={{ fontSize: 11.5, color: "var(--uff-text-dim)" }}>{row}</span>
      <span
        className="mono"
        style={{
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 13,
          fontWeight: 700,
          color: accent ? "var(--uff-orange)" : "var(--uff-text)",
        }}
      >
        {v}
      </span>
    </div>
  );
}

function TipCard() {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "rgba(255,106,26,0.06)",
        border: "1px solid rgba(255,106,26,0.20)",
        borderRadius: 12,
        fontSize: 12,
        lineHeight: 1.6,
        color: "var(--uff-text-dim)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-orange)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Build 5.5 tip
      </div>
      Parallel drills count <b>once</b> toward the block&rsquo;s minute target — the longest of the pair sets the slot length. Water breaks live between blocks, never inside them.
    </div>
  );
}

// ── Sheets ─────────────────────────────────────────────────────────────
function SheetShell({
  children,
  width = 560,
  anchor = "center",
  onClose,
}: {
  children: React.ReactNode;
  width?: number;
  anchor?: "center" | "right";
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,9,11,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        justifyContent: anchor === "right" ? "flex-end" : "center",
        alignItems: anchor === "right" ? "stretch" : "center",
        padding: anchor === "right" ? 0 : "60px 24px",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxHeight: anchor === "right" ? "100vh" : "calc(100vh - 120px)",
          background: "var(--uff-surface)",
          border: "1px solid var(--uff-line)",
          borderRadius: anchor === "right" ? "14px 0 0 14px" : 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SheetHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--uff-line-soft)",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--uff-text-dim)", marginTop: 3 }}>{subtitle}</div>}
      </div>
      <button type="button" className="icon-btn" onClick={onClose}>
        <PIcon.close size={14} />
      </button>
    </div>
  );
}

function BlockLibrarySheet({
  templates,
  onClose,
  onPickBlank,
  onPickTemplate,
}: {
  templates: BlockTemplateEntry[];
  onClose: () => void;
  onPickBlank: () => void;
  onPickTemplate: (t: BlockTemplateEntry) => void;
}) {
  return (
    <SheetShell width={520} anchor="right" onClose={onClose}>
      <SheetHeader title="Add a block" subtitle="Pick a saved block to copy in, or start blank." onClose={onClose} />
      <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "auto" }}>
        <button
          type="button"
          onClick={onPickBlank}
          style={{
            padding: "12px 14px",
            border: "1px dashed var(--uff-line)",
            borderRadius: 10,
            background: "transparent",
            color: "var(--uff-text-dim)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "rgba(255,106,26,0.10)",
              border: "1px solid rgba(255,106,26,0.30)",
              color: "var(--uff-orange)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <PIcon.plus size={13} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--uff-text)" }}>Start with a blank block</div>
            <div style={{ fontSize: 11.5, color: "var(--uff-text-mute)", marginTop: 1 }}>
              Name it, set target minutes, then drop drills in
            </div>
          </div>
          <PIcon.chevR size={13} />
        </button>

        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".14em",
            color: "var(--uff-text-mute)",
            textTransform: "uppercase",
            marginTop: 4,
          }}
        >
          Saved blocks · {templates.length}
        </div>
        {templates.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--uff-text-mute)", textAlign: "center", padding: "20px 0" }}>
            No saved blocks yet. Save any block from a plan to add it here.
          </div>
        )}
        {templates.map((tpl) => {
          const c = blockColor(tpl.name);
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onPickTemplate(tpl)}
              style={{
                padding: "12px 14px",
                background: "var(--uff-surface-2)",
                border: "1px solid var(--uff-line-soft)",
                borderLeft: `3px solid ${c.accent}`,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--uff-text)" }}>{tpl.name}</div>
              </div>
              <span style={{ color: "var(--uff-text-mute)" }}>
                <PIcon.chevR size={13} />
              </span>
            </button>
          );
        })}
      </div>
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--uff-line-soft)",
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <button type="button" className="wbtn ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </SheetShell>
  );
}

function DrillPickerSheet({
  catalog,
  onClose,
  onPick,
}: {
  catalog: DrillCatalogEntry[];
  onClose: () => void;
  onPick: (d: DrillCatalogEntry) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = catalog.filter(
    (d) =>
      d.name.toLowerCase().includes(q.toLowerCase()) ||
      (d.category_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <SheetShell width={560} anchor="right" onClose={onClose}>
      <SheetHeader title="Add a drill" subtitle="Pick from your team library." onClose={onClose} />
      <div style={{ padding: "14px 20px", flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            height: 38,
            background: "var(--uff-surface-2)",
            border: "1px solid var(--uff-line-soft)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 12px",
          }}
        >
          <PIcon.search size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: 0,
              outline: "none",
              color: "var(--uff-text)",
              fontFamily: "inherit",
              fontSize: 13,
            }}
            placeholder="Search drills…"
          />
        </div>
        {filtered.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--uff-text-mute)", textAlign: "center", padding: "20px 0" }}>
            No drills match.
          </div>
        )}
        {filtered.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onPick(d)}
            style={{
              padding: "12px 14px",
              background: "var(--uff-surface-2)",
              border: "1px solid var(--uff-line-soft)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--uff-text)" }}>{d.name}</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                  fontSize: 11,
                  color: "var(--uff-text-dim)",
                }}
              >
                {d.category_name && <span>{d.category_name}</span>}
                {d.default_duration_min != null && (
                  <span
                    className="mono"
                    style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", color: "var(--uff-orange)", fontWeight: 700 }}
                  >
                    {d.default_duration_min}m
                  </span>
                )}
                {d.benchmark_types.length > 0 && (
                  <span style={{ color: "var(--uff-orange)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <PIcon.bench size={9} />
                    {d.benchmark_types.join(" · ")}
                  </span>
                )}
              </div>
            </div>
            <span style={{ color: "var(--uff-text-mute)" }}>
              <PIcon.chevR size={13} />
            </span>
          </button>
        ))}
      </div>
    </SheetShell>
  );
}

function AttendanceSheet({
  roster,
  attendees,
  dateLabel,
  onClose,
  onChange,
  onBulkIn,
  onReset,
  onSave,
}: {
  roster: RosterEntry[];
  attendees: Record<string, boolean | null>;
  dateLabel: string;
  onClose: () => void;
  onChange: (playerId: string, rsvp: boolean | null) => void;
  onBulkIn: () => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const inN = Object.values(attendees).filter((v) => v === true).length;
  const outN = Object.values(attendees).filter((v) => v === false).length;
  return (
    <SheetShell width={680} onClose={onClose}>
      <SheetHeader title={`Who's coming ${dateLabel}?`} subtitle="Tap a status for each player." onClose={onClose} />
      <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <span
          className="mono"
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10.5,
            color: "var(--uff-text-mute)",
            letterSpacing: ".06em",
          }}
        >
          BULK
        </span>
        <button type="button" className="wbtn" style={{ height: 30, fontSize: 12 }} onClick={onBulkIn}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--uff-lime)", display: "inline-block" }} /> Mark all in
        </button>
        <button type="button" className="wbtn" style={{ height: 30, fontSize: 12 }} onClick={onReset}>
          Reset
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--uff-text-dim)" }}>{roster.length} players · season roster</span>
      </div>
      <div style={{ padding: "12px 20px 20px", flex: 1, overflow: "auto" }}>
        <div
          style={{
            background: "var(--uff-surface-2)",
            border: "1px solid var(--uff-line-soft)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 240px",
              gap: 10,
              padding: "10px 14px",
              borderBottom: "1px solid var(--uff-line-soft)",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".14em",
              color: "var(--uff-text-mute)",
              textTransform: "uppercase",
            }}
          >
            <span>Player</span>
            <span>Position</span>
            <span>Status</span>
          </div>
          {roster.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 240px",
                gap: 10,
                padding: "10px 14px",
                borderBottom: i === roster.length - 1 ? "none" : "1px solid var(--uff-line-soft)",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: p.color,
                    color: "#1a0f08",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {p.initials}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--uff-text)" }}>{p.display_name}</span>
              </div>
              <span
                className="mono"
                style={{
                  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                  fontSize: 11,
                  color: "var(--uff-text-dim)",
                  letterSpacing: ".04em",
                }}
              >
                {p.position ?? "—"}
              </span>
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  background: "rgba(255,255,255,0.025)",
                  borderRadius: 8,
                  padding: 3,
                }}
              >
                <StatBtn active={attendees[p.id] === true} label="In" color="var(--uff-lime)" onClick={() => onChange(p.id, true)} />
                <StatBtn
                  active={attendees[p.id] === false}
                  label="Out"
                  color="var(--uff-red)"
                  onClick={() => onChange(p.id, false)}
                />
                <StatBtn
                  active={attendees[p.id] == null}
                  label="No reply"
                  color="rgba(255,255,255,0.4)"
                  onClick={() => onChange(p.id, null)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--uff-line-soft)",
          display: "flex",
          gap: 10,
          alignItems: "center",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 14, marginRight: "auto", fontSize: 11.5, color: "var(--uff-text-dim)" }}>
          <RsvpLegend color="var(--uff-lime)" label={`${inN} in`} />
          <RsvpLegend color="var(--uff-red)" label={`${outN} out`} />
        </span>
        <button type="button" className="wbtn ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="wbtn primary" onClick={onSave}>
          Save attendance
        </button>
      </div>
    </SheetShell>
  );
}

function StatBtn({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        height: 28,
        border: 0,
        padding: "0 10px",
        borderRadius: 6,
        background: active ? `${color}24` : "transparent",
        color: active ? color : "var(--uff-text-mute)",
        fontFamily: "inherit",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".04em",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        cursor: "pointer",
      }}
    >
      {active && <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />}
      {label}
    </button>
  );
}

function RsvpLegend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────
function iconBtnStyle(): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    padding: 0,
    border: 0,
    borderRadius: 6,
    background: "rgba(255,255,255,0.04)",
    color: "var(--uff-text-dim)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };
}

function quickActionBtn(color: string): React.CSSProperties {
  return {
    height: 32,
    padding: "0 12px",
    border: `1px dashed ${color}55`,
    borderRadius: 8,
    background: "transparent",
    color,
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function addBlockBtn(color: string): React.CSSProperties {
  return {
    padding: "12px 14px",
    border: `1px dashed ${color}55`,
    borderRadius: 12,
    background: "transparent",
    color,
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    textAlign: "left",
  };
}
