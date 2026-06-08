import type { SourcePlatform } from "./platform";

export type DrillJobStatus =
  | "queued" | "extracting" | "drafting" | "ready" | "no_signal" | "failed";

/** The AI's structured output, stored in ai_drill_jobs.draft_json. */
export interface DrillDraft {
  name: string;
  description: string;
  coaching_cues: string[];
  category: string | null;
  phase: string | null;
  skill_ids: string[];
  equipment: { cones: number | null; other: string[] };
  source_author: string | null;
  confidence: Record<string, number>;
}

export interface DrillJob {
  id: string;
  team_id: string;
  status: DrillJobStatus;
  source_kind: SourcePlatform | "upload";
  source_url: string | null;
  draft_json: DrillDraft | null;
  drill_id: string | null;
  error_detail: string | null;
  user_feedback: -1 | 1 | null;
}
