import type { BlockCandidates, GeneratedBlock, GeneratedPlan, Skeleton } from "./types";

const clampStr = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

/** Build the forced-tool JSON schema for one generation. */
export function buildPlanToolSchema() {
  return {
    name: "emit_practice_plan",
    description: "Return selected drills, cues, rationale, and any gap proposals per block.",
    input_schema: {
      type: "object",
      required: ["blocks"],
      properties: {
        blocks: {
          type: "array",
          items: {
            type: "object",
            required: ["blockKey", "rationale", "drills", "gapProposals"],
            properties: {
              blockKey: { type: "string" },
              rationale: { type: "string" },
              drills: {
                type: "array",
                items: {
                  type: "object",
                  required: ["drillId", "coachingCue"],
                  properties: { drillId: { type: "string" }, coachingCue: { type: "string" } },
                },
              },
              gapProposals: {
                type: "array",
                items: {
                  type: "object",
                  required: ["skillId", "name", "description", "category"],
                  properties: {
                    skillId: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  } as const;
}

/** PURE: sanitize raw model output against the skeleton + candidate sets. */
export function validatePlanOutput(
  raw: unknown,
  skeleton: Skeleton,
  blockCandidates: BlockCandidates[],
): GeneratedPlan {
  const candByKey = new Map(blockCandidates.map((b) => [b.blockKey, b]));
  const keyExists = new Set(skeleton.blocks.map((b) => b.key));
  const rawBlocks = (raw as { blocks?: unknown })?.blocks;
  const blocks: GeneratedBlock[] = [];

  for (const rb of Array.isArray(rawBlocks) ? rawBlocks : []) {
    const key = rb?.blockKey;
    if (!keyExists.has(key)) continue;
    const bc = candByKey.get(key);
    const allowedDrillIds = new Set((bc?.candidates ?? []).map((c) => c.drillId));
    const gapSkills = new Set(bc?.gapSkillIds ?? []);

    const drills = (Array.isArray(rb.drills) ? rb.drills : [])
      .filter((d: { drillId?: string }) => allowedDrillIds.has(d?.drillId ?? ""))
      .map((d: { drillId: string; coachingCue?: unknown }) => ({
        drillId: d.drillId,
        coachingCue: clampStr(d.coachingCue, 120),
      }));

    const gapProposals = (Array.isArray(rb.gapProposals) ? rb.gapProposals : [])
      .filter((g: { skillId?: string }) => gapSkills.has(g?.skillId ?? ""))
      .map((g: { skillId: string; name?: unknown; description?: unknown; category?: unknown }) => ({
        skillId: g.skillId,
        name: clampStr(g.name, 80),
        description: clampStr(g.description, 400),
        category: clampStr(g.category, 40),
      }));

    blocks.push({ blockKey: key, rationale: clampStr(rb.rationale, 140), drills, gapProposals });
  }
  return { blocks, usedFallback: false };
}
