import type { SavePlanPayload, SaveBlockInput, SaveDrillInput } from "@/lib/practice/actions";
import type { GeneratedPlan, Skeleton } from "./types";

/** PURE: map skeleton + generated output into the existing SavePlanPayload shape. */
export function toSavePayload(args: {
  planId: string;
  title: string;
  practiceDate: string;
  skeleton: Skeleton;
  generated: GeneratedPlan;
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

  return {
    plan_id: args.planId,
    title: args.title,
    practice_date: args.practiceDate,
    start_time: args.startTime ?? null,
    end_time: args.endTime ?? null,
    status: "draft",
    blocks,
    breaks: [],
  };
}
