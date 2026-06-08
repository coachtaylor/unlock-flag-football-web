import type { SkillGroup } from "@/lib/types/skills";

export type PracticeFormat = "5v5" | "7v7";

/** A targeted skill the coach selected (or an auto-weakness). */
export type TargetSkill = {
  skillId: string;
  skillName: string;
  skillGroup: SkillGroup;
  avgScore: number | null; // 0..1 team composite; lower = weaker. null = unmeasured.
};

export type GenerateInput = {
  teamId: string;
  totalMinutes: number;
  format: PracticeFormat;
  /** Targeted skills. Empty => caller resolves to team auto-weaknesses before buildSkeleton. */
  skills: TargetSkill[];
};

export type BlockKind = "warmup" | "skill" | "team" | "cooldown";

export type SkeletonBlock = {
  key: string; // stable within one skeleton, e.g. "warmup", "skill-1", "team", "cooldown"
  name: string; // display name
  kind: BlockKind;
  skillIds: string[]; // [] for warmup/team/cooldown
  targetMinutes: number;
};

export type Skeleton = {
  blocks: SkeletonBlock[];
  totalMinutes: number; // == input.totalMinutes after rounding
  mergedSkillCount: number; // targeted skills packed beyond their own block
};

/** A drill eligible for a block, already joined to score + recency (pure-test friendly). */
export type CandidateDrill = {
  drillId: string;
  drillName: string;
  categoryName: string | null;
  benchmarkTypes: string[]; // subset of ["timed","rated"]
  defaultDurationMin: number | null;
  skillWeight: number; // 1.0 (primary) | 0.5 (secondary)
  drillScore: number | null; // 0..1 team avg; lower = weaker. null = unmeasured.
  lastRunISO: string | null; // most recent completed-practice date, or null
};

export type BlockCandidates = {
  blockKey: string;
  candidates: CandidateDrill[]; // ranked best-first
  gapSkillIds: string[]; // targeted skills in this block with zero candidates
};

// --- AI output (post-validation) ---
export type GeneratedDrill = { drillId: string; coachingCue: string };

export type GapProposal = {
  skillId: string;
  name: string;
  description: string;
  category: string;
};

export type GeneratedBlock = {
  blockKey: string;
  rationale: string;
  drills: GeneratedDrill[];
  gapProposals: GapProposal[];
};

export type GeneratedPlan = {
  blocks: GeneratedBlock[];
  usedFallback: boolean;
};
