import { getAnthropic } from "@/lib/ai/anthropic";
import { buildPlanToolSchema, validatePlanOutput } from "./ai-contract";
import type { BlockCandidates, GeneratedPlan, Skeleton, TargetSkill } from "./types";

// Verify against the current Claude model id at Task 21 (use the claude-api skill).
export const MODEL_ID = "claude-sonnet-4-5";

type CallResult = { plan: GeneratedPlan; inputTokens: number; outputTokens: number; model: string };

function buildPrompt(
  skeleton: Skeleton,
  blockCandidates: BlockCandidates[],
  skills: TargetSkill[],
  format: string,
  excludeDrillIds?: string[],
): string {
  return JSON.stringify({
    instruction:
      "You are a flag-football practice coach. For each SKILL block, choose the best 1-2 drills " +
      "ONLY from that block's candidate list (by drillId), write a <=120-char coaching cue per drill, " +
      "and a <=140-char rationale tying the block to the team's weakness. " +
      "For any skill in gapSkillIds, instead emit ONE gapProposal (name, <=400-char description, category). " +
      "Do not invent drillIds. Do not set durations. Warm-Up/Team/Cool-Down: rationale only, empty drills.",
    format,
    avoidDrillIds: excludeDrillIds ?? [],
    targetedSkills: skills.map((s) => ({ skillId: s.skillId, name: s.skillName, score: s.avgScore })),
    blocks: skeleton.blocks.map((b) => ({
      blockKey: b.key,
      name: b.name,
      kind: b.kind,
      targetMinutes: b.targetMinutes,
      candidates: (blockCandidates.find((c) => c.blockKey === b.key)?.candidates ?? []).map((c) => ({
        drillId: c.drillId,
        name: c.drillName,
        category: c.categoryName,
        score: c.drillScore,
      })),
      gapSkillIds: blockCandidates.find((c) => c.blockKey === b.key)?.gapSkillIds ?? [],
    })),
  });
}

/** IMPURE: one forced-tool generation. Throws on API error (caller falls back). */
export async function callPlanModel(args: {
  skeleton: Skeleton;
  blockCandidates: BlockCandidates[];
  skills: TargetSkill[];
  format: string;
  excludeDrillIds?: string[];
}): Promise<CallResult> {
  const tool = buildPlanToolSchema();
  const res = await getAnthropic().messages.create({
    model: MODEL_ID,
    max_tokens: 1500,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [tool as any],
    tool_choice: { type: "tool", name: tool.name },
    messages: [
      {
        role: "user",
        content: buildPrompt(args.skeleton, args.blockCandidates, args.skills, args.format, args.excludeDrillIds),
      },
    ],
  });
  const toolUse = res.content.find((c) => c.type === "tool_use") as { input: unknown } | undefined;
  const plan = validatePlanOutput(toolUse?.input ?? {}, args.skeleton, args.blockCandidates);
  return { plan, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, model: MODEL_ID };
}
