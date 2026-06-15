import type { BlockCandidates, GeneratedPlan, Skeleton, TargetSkill } from "@/lib/practice/generate/types";
import type { WaterBreak } from "@/lib/practice/generate/water-breaks";

/** A skill row in the picker: the engine TargetSkill + a coach-facing blurb. */
export type SelectableSkill = TargetSkill & { description: string | null };

export type GeneratePageData = {
  teamId: string;
  defaultMinutes: number; // last practice length or 120
  defaultFormat: "5v5" | "7v7";
  defaultTitle: string; // prefilled plan title
  defaultDate: string; // ISO yyyy-mm-dd (next Sunday)
  availableSkills: SelectableSkill[]; // full skill taxonomy (all selectable)
  suggestedSkillIds: string[]; // weakest measured skills — highlighted as suggestions
};

export type PreviewState = {
  generationId: string;
  title: string; // from the wizard — carried through to the saved plan
  practiceDate: string; // ISO yyyy-mm-dd
  skeleton: Skeleton;
  blockCandidates: BlockCandidates[];
  generated: GeneratedPlan;
  waterBreaks: WaterBreak[];
};
