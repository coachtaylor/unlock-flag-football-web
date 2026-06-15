import type { BlockCandidates, GeneratedBlock, GeneratedPlan, Skeleton } from "./types";

/** PURE: rules-only plan; fills EVERY block with up to drillsPerBlock top candidates. */
export function buildFallbackPlan(skeleton: Skeleton, blockCandidates: BlockCandidates[], drillsPerBlock = 2): GeneratedPlan {
  const byKey = new Map(blockCandidates.map((b) => [b.blockKey, b]));
  const blocks: GeneratedBlock[] = skeleton.blocks.map((b) => {
    const picks = (byKey.get(b.key)?.candidates ?? []).slice(0, Math.max(1, drillsPerBlock));
    return {
      blockKey: b.key,
      rationale: `Targets ${b.name} (auto-selected)`,
      drills: picks.map((c) => ({ drillId: c.drillId, coachingCue: "" })),
      gapProposals: [],
    };
  });
  return { blocks, usedFallback: true };
}
