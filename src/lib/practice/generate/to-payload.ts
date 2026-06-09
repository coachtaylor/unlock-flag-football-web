import type { SavePlanPayload, SaveBlockInput, SaveDrillInput, SaveBreakInput } from "@/lib/practice/actions";
import type { GeneratedPlan, Skeleton } from "./types";
import type { WaterBreak } from "./water-breaks";

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

  const blocks: SaveBlockInput[] = args.skeleton.blocks.map((b, blockIndex) => {
    const genDrills = genByKey.get(b.key)?.drills ?? [];
    const per = genDrills.length ? Math.max(1, Math.floor(b.targetMinutes / genDrills.length)) : 0;
    const drills: SaveDrillInput[] = genDrills.map((d, i) => ({
      drill_id: d.drillId,
      drill_order: i,
      duration_minutes: per,
      reps_count: null,
      notes: d.coachingCue || null,
      parallel_group: null,
    }));
    return { name: b.name, block_order: blockIndex, target_minutes: b.targetMinutes, drills };
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
