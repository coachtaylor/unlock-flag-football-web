import type { DrillDraft, DrillJobStatus } from "./types";

/**
 * Dev-only mock for the AI drill drafter (build-11).
 *
 * The real pipeline (the `draft-drill` edge function + an extraction vendor +
 * Realtime on `ai_drill_jobs`) isn't stood up yet, and no extraction vendor has
 * been chosen — so there's no way to exercise the "draft fills the form" UX
 * against a live link. This mock lets a coach test that UX end to end in dev:
 * it steps a fake job through the SAME status states the real Realtime updates
 * would emit and hands back a realistic `DrillDraft`. No network, no edge
 * function, no Realtime, no API key.
 *
 * Prod-safe: disabled whenever the build is production. To test the REAL
 * pipeline in dev once it's deployed, set `NEXT_PUBLIC_AI_DRILL_REAL=1`.
 */
export function isAiDrillMockEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_AI_DRILL_REAL !== "1"
  );
}

/**
 * A realistic sample of what the AI returns. Phase/skills are intentionally left
 * null/empty: they're the lowest-priority fields and the model often can't infer
 * them, so the mock mirrors that. Description + coaching cues + equipment are the
 * high-value fields under test and are fully populated.
 */
export const MOCK_DRILL_DRAFT: DrillDraft = {
  name: "5-10-5 Pro Agility Shuttle",
  description:
    "Set three cones five yards apart in a straight line. The player straddles " +
    "the middle cone, sprints five yards to one side and touches the line, " +
    "changes direction and sprints ten yards to the far cone and touches, then " +
    "finishes by sprinting five yards back through the middle. Trains short-area " +
    "burst, change of direction, and the hip drop a QB needs to escape pressure " +
    "and reset to throw.",
  coaching_cues: [
    "Stay low through every cut — drop the hips, don't stand up",
    "Touch the line with the near hand, not the foot",
    "Drive the first step off the back foot, no false step",
    "Eyes up the whole rep so it transfers to scanning the field",
  ],
  category: null,
  phase: null,
  skill_ids: [],
  equipment: { cones: 3, other: ["Stopwatch"] },
  source_author: "@flagqbtraining",
  confidence: { description: 0.9, coaching_cues: 0.85, equipment: 0.8 },
};

// The pre-"ready" status sequence, with delays that feel like a real job. The
// caller applies the draft and flips to "ready" itself, exactly as the live
// Realtime handler does.
const MOCK_STEPS: { status: DrillJobStatus; delayMs: number }[] = [
  { status: "queued", delayMs: 350 },
  { status: "extracting", delayMs: 1100 },
  { status: "drafting", delayMs: 1200 },
];

/**
 * Drive the mock through the real status sequence, calling `onStatus` at each
 * step, then resolve with the draft. The caller applies the draft + sets
 * "ready" so there's still exactly one apply path (see DrillForm.runTranscribe).
 */
export async function runMockDraft(
  onStatus: (status: DrillJobStatus) => void,
): Promise<DrillDraft> {
  for (const step of MOCK_STEPS) {
    onStatus(step.status);
    await new Promise((resolve) => setTimeout(resolve, step.delayMs));
  }
  return MOCK_DRILL_DRAFT;
}
