import type { SavePlanPayload, SaveBlockInput, SaveDrillInput, SaveBreakInput } from "@/lib/practice/actions";
import type { GeneratedPlan, Skeleton } from "./types";
import type { WaterBreak } from "./water-breaks";

/** PURE: stretch the blocks that actually have drills so they absorb the whole
 *  practice time — no leftover minutes. A block with zero drills contributes 0
 *  (its minutes flow into the drill-bearing blocks, proportional to each
 *  block's original target). When every block already has drills this is a
 *  no-op (each block's share rounds back to its own target). Returns effective
 *  minutes per block key, summing to `total`. */
export function distributeBlockMinutes(
  blocks: { key: string; targetMinutes: number }[],
  drillCountByKey: Map<string, number>,
  total: number,
): Map<string, number> {
  const out = new Map<string, number>(blocks.map((b) => [b.key, 0]));
  const populated = blocks.filter((b) => (drillCountByKey.get(b.key) ?? 0) > 0);
  if (populated.length === 0) {
    // Nothing to stretch into — keep original targets so the plan isn't blanked.
    for (const b of blocks) out.set(b.key, b.targetMinutes);
    return out;
  }
  const popSum = populated.reduce((n, b) => n + b.targetMinutes, 0) || 1;
  let assigned = 0;
  for (const b of populated) {
    const m = Math.max(1, Math.round((total * b.targetMinutes) / popSum));
    out.set(b.key, m);
    assigned += m;
  }
  // Push rounding drift onto the largest populated block so the sum hits `total`.
  const drift = total - assigned;
  if (drift !== 0) {
    const largest = [...populated].sort((a, b) => out.get(b.key)! - out.get(a.key)!)[0];
    out.set(largest.key, Math.max(1, out.get(largest.key)! + drift));
  }
  return out;
}

/** PURE: map skeleton + generated output into the existing SavePlanPayload shape. */
export function toSavePayload(args: {
  planId: string;
  title: string;
  practiceDate: string;
  skeleton: Skeleton;
  generated: GeneratedPlan;
  waterBreaks?: WaterBreak[];
  startTime?: string | null;
  endTime?: string | null;
}): SavePlanPayload {
  const genByKey = new Map(args.generated.blocks.map((b) => [b.blockKey, b]));

  // Effective per-block minutes: drill-bearing blocks stretch to fill the
  // whole practice; empty blocks (e.g. manual placeholders) sit at 0.
  const drillCountByKey = new Map(
    args.skeleton.blocks.map((b) => [b.key, genByKey.get(b.key)?.drills.length ?? 0]),
  );
  const effMin = distributeBlockMinutes(args.skeleton.blocks, drillCountByKey, args.skeleton.totalMinutes);

  const blocks: SaveBlockInput[] = args.skeleton.blocks.map((b, blockIndex) => {
    const genDrills = genByKey.get(b.key)?.drills ?? [];
    const target = effMin.get(b.key) ?? b.targetMinutes;
    // Distribute the block's minutes across its drills EXACTLY — the first
    // `rem` drills get +1 — so each block sums to its target with no leftover.
    const n = genDrills.length;
    const base = n ? Math.floor(target / n) : 0;
    const rem = n ? target - base * n : 0;
    const drills: SaveDrillInput[] = genDrills.map((d, i) => ({
      drill_id: d.drillId,
      drill_order: i,
      duration_minutes: base + (i < rem ? 1 : 0),
      reps_count: null,
      notes: d.coachingCue || null,
      parallel_group: null,
    }));
    return { name: b.name, block_order: blockIndex, target_minutes: target, drills };
  });

  // Water breaks live BETWEEN blocks (after_block_order = the block they follow).
  const orderByKey = new Map(args.skeleton.blocks.map((b, i) => [b.key, i]));
  const breaks: SaveBreakInput[] = (args.waterBreaks ?? [])
    .map((w, i) => {
      const after = orderByKey.get(w.afterBlockKey);
      return after == null ? null : { after_block_order: after, break_order: i, duration_minutes: w.minutes };
    })
    .filter((b): b is SaveBreakInput => b != null);

  return {
    plan_id: args.planId,
    title: args.title,
    practice_date: args.practiceDate,
    start_time: args.startTime ?? null,
    end_time: args.endTime ?? null,
    status: "draft",
    blocks,
    breaks,
  };
}
