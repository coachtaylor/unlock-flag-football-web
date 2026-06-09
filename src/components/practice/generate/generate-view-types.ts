import type { BlockCandidates, GeneratedPlan, Skeleton, TargetSkill } from "@/lib/practice/generate/types";
import type { WaterBreak } from "@/lib/practice/generate/water-breaks";

export type GeneratePageData = {
  teamId: string;
  defaultMinutes: number; // last practice length or 90
  defaultFormat: "5v5" | "7v7";
  defaultTitle: string; // prefilled plan title
  defaultDate: string; // ISO yyyy-mm-dd (next Sunday)
  availableSkills: TargetSkill[]; // from team scouting focus (selectable)
};

export type PreviewState = {
  generationId: string;
  skeleton: Skeleton;
  blockCandidates: BlockCandidates[];
  generated: GeneratedPlan;
  waterBreaks: WaterBreak[];
};
