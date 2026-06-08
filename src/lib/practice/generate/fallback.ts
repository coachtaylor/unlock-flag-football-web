import type { BlockCandidates, GeneratedBlock, GeneratedPlan, Skeleton } from "./types";

/** PURE: rules-only plan used when the AI call is unavailable/fails. */
export function buildFallbackPlan(skeleton: Skeleton, blockCandidates: BlockCandidates[]): GeneratedPlan {
  const byKey = new Map(blockCandidates.map((b) => [b.blockKey, b]));
  const blocks: GeneratedBlock[] = skeleton.blocks
    .filter((b) => b.kind === "skill")
    .map((b) => {
      const top = byKey.get(b.key)?.candidates[0];
      return {
        blockKey: b.key,
        rationale: `Targets ${b.name} (auto-selected)`,
        drills: top ? [{ drillId: top.drillId, coachingCue: "" }] : [],
        gapProposals: [],
      };
    });
  return { blocks, usedFallback: true };
}
