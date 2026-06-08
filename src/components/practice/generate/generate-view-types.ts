import type { BlockCandidates, GeneratedPlan, Skeleton, TargetSkill } from "@/lib/practice/generate/types";

export type GeneratePageData = {
  teamId: string;
  defaultMinutes: number; // last practice length or 90
  defaultFormat: "5v5" | "7v7";
  availableSkills: TargetSkill[]; // from team scouting focus (selectable)
};

export type PreviewState = {
  generationId: string;
  skeleton: Skeleton;
  blockCandidates: BlockCandidates[];
  generated: GeneratedPlan;
};
