"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { loadTeamFocus } from "@/lib/dashboard/team-home-data";
import { savePlan, createPlanDraft, type SavePlanPayload } from "@/lib/practice/actions";
import type { SkillGroup } from "@/lib/types/skills";
import { buildSkeleton } from "./skeleton";
import { assembleBlockCandidates, fetchCandidatesBySkill, fetchCandidatesByCategory } from "./candidates";
import { callPlanModel } from "./ai";
import { buildFallbackPlan } from "./fallback";
import { resolveTargetSkills } from "./resolve-skills";
import { computeWaterBreaks, type WaterBreak } from "./water-breaks";
import type { BlockCandidates, CandidateDrill, GeneratedPlan, Skeleton, TargetSkill, WizardInput } from "./types";

export type GenerateResult =
  | { ok: true; generationId: string; skeleton: Skeleton; blockCandidates: BlockCandidates[]; generated: GeneratedPlan; waterBreaks: WaterBreak[] }
  | { ok: false; error: string };

async function teamFocusSkills(supabase: SupabaseClient, teamId: string): Promise<TargetSkill[]> {
  const focus = await loadTeamFocus(supabase, teamId);
  return focus.skills.map((s) => ({
    skillId: s.skillId,
    skillName: s.skillName,
    skillGroup: s.skillGroup as SkillGroup,
    avgScore: s.avgScore,
  }));
}

export async function generatePlan(input: WizardInput): Promise<GenerateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  // Skills drive only the Skills block. If the coach included it but picked
  // nothing, fall back to the team's auto-weaknesses.
  let skills: TargetSkill[] = input.includeSkills ? input.skills : [];
  if (input.includeSkills && skills.length === 0) {
    skills = await teamFocusSkills(supabase, input.teamId);
  }

  const skeleton = buildSkeleton({ ...input, skills });

  // One candidate map carries skill-id-keyed entries (skill blocks) AND
  // block-key-keyed entries (category blocks). assembleBlockCandidates reads
  // the right keys per block kind.
  const candMap = new Map<string, CandidateDrill[]>(
    await fetchCandidatesBySkill(supabase, input.teamId, skills.map((s) => s.skillId)),
  );
  for (const b of skeleton.blocks) {
    if (b.kind !== "skill" && b.categorySlugs.length) {
      candMap.set(b.key, await fetchCandidatesByCategory(supabase, input.teamId, b.categorySlugs));
    }
  }
  const nowISO = new Date().toISOString();
  const blockCandidates = skeleton.blocks.map((b) => assembleBlockCandidates(b, candMap, nowISO));
  const waterBreaks = computeWaterBreaks(skeleton.blocks, { everyMin: 30, durationMin: 3, enabled: input.autoWaterBreaks });

  let generated: GeneratedPlan;
  let model: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  try {
    const r = await callPlanModel({ skeleton, blockCandidates, skills, format: input.format });
    generated = r.plan;
    model = r.model;
    inputTokens = r.inputTokens;
    outputTokens = r.outputTokens;
  } catch {
    generated = buildFallbackPlan(skeleton, blockCandidates, input.drillsPerBlock);
  }

  const { data: logRow, error: logErr } = await supabase
    .from("ai_plan_generations")
    .insert({
      team_id: input.teamId,
      created_by: user.id,
      input_json: {
        title: input.title,
        practiceDate: input.practiceDate,
        totalMinutes: input.totalMinutes,
        format: input.format,
        skillIds: skills.map((s) => s.skillId),
        drillsPerBlock: input.drillsPerBlock,
        autoWaterBreaks: input.autoWaterBreaks,
      },
      output_json: { skeleton, generated, waterBreaks },
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      used_fallback: generated.usedFallback,
    })
    .select("id")
    .single();
  if (logErr) return { ok: false, error: logErr.message };

  return { ok: true, generationId: logRow.id as string, skeleton, blockCandidates, generated, waterBreaks };
}

export async function regenerateBlock(args: {
  teamId: string;
  generationId: string;
  blockKey: string;
  excludeDrillIds: string[];
}): Promise<{ ok: true; block: GeneratedPlan["blocks"][number] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: gen, error } = await supabase
    .from("ai_plan_generations")
    .select("output_json, input_json")
    .eq("id", args.generationId)
    .single();
  if (error || !gen) return { ok: false, error: "generation_not_found" };

  const skeleton: Skeleton = gen.output_json.skeleton;
  const block = skeleton.blocks.find((b) => b.key === args.blockKey);
  if (!block) return { ok: false, error: "block_not_found" };

  const focus = await teamFocusSkills(supabase, args.teamId);
  const skills = resolveTargetSkills(gen.input_json.skillIds ?? [], focus).filter((s) =>
    block.skillIds.includes(s.skillId),
  );

  // Build candidates for just this block, by its kind (skill vs category).
  const candMap = new Map<string, CandidateDrill[]>();
  if (block.kind === "skill") {
    for (const [k, v] of await fetchCandidatesBySkill(supabase, args.teamId, block.skillIds)) candMap.set(k, v);
  } else if (block.categorySlugs?.length) {
    candMap.set(block.key, await fetchCandidatesByCategory(supabase, args.teamId, block.categorySlugs));
  }
  const blockCandidates = [assembleBlockCandidates(block, candMap, new Date().toISOString())];
  const drillsPerBlock = gen.input_json.drillsPerBlock ?? 2;

  const emptyBlock = { blockKey: args.blockKey, rationale: "", drills: [], gapProposals: [] };
  try {
    const r = await callPlanModel({
      skeleton: { ...skeleton, blocks: [block] },
      blockCandidates,
      skills,
      format: gen.input_json.format ?? "7v7",
      excludeDrillIds: args.excludeDrillIds,
    });
    return { ok: true, block: r.plan.blocks.find((b) => b.blockKey === args.blockKey) ?? emptyBlock };
  } catch {
    const fb = buildFallbackPlan({ ...skeleton, blocks: [block] }, blockCandidates, drillsPerBlock);
    return { ok: true, block: fb.blocks[0] ?? emptyBlock };
  }
}

export async function adoptGapDrill(args: {
  teamId: string;
  name: string;
  description: string;
  category: string;
  phaseSkillIds: string[];
}): Promise<{ ok: true; drillId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: cat } = await supabase
    .from("drill_categories")
    .select("id")
    .eq("name", args.category)
    .maybeSingle();
  const { data: drill, error } = await supabase
    .from("team_drills")
    .insert({
      team_id: args.teamId,
      created_by: user.id,
      drill_name: args.name,
      description: args.description,
      category_id: cat?.id ?? null,
      status: "draft",
      source: "ai",
    })
    .select("id")
    .single();
  if (error || !drill) return { ok: false, error: error?.message ?? "insert_failed" };

  if (args.phaseSkillIds.length) {
    await supabase
      .from("drill_skills")
      .insert(args.phaseSkillIds.map((skill_id) => ({ drill_id: drill.id, skill_id, weight: 1 })));
  }
  revalidatePath(`/dashboard/team/${args.teamId}/drills`);
  return { ok: true, drillId: drill.id as string };
}

export async function createPlanFromGeneration(args: {
  teamId: string;
  generationId: string;
  payload: Omit<SavePlanPayload, "plan_id">;
}): Promise<{ ok: true; planId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const planId = await createPlanDraft(args.teamId);
  const saved = await savePlan({ ...args.payload, plan_id: planId }, args.teamId);
  if (!saved.ok) return { ok: false, error: saved.error };

  await supabase.from("practice_plans").update({ origin: "ai" }).eq("id", planId);
  await supabase
    .from("ai_plan_generations")
    .update({ accepted: true, practice_plan_id: planId })
    .eq("id", args.generationId);

  revalidatePath(`/dashboard/team/${args.teamId}/practice`);
  return { ok: true, planId };
}

export async function recordGenerationFeedback(args: {
  generationId: string;
  feedback: -1 | 1;
}): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_plan_generations")
    .update({ user_feedback: args.feedback })
    .eq("id", args.generationId);
  return { ok: !error };
}
