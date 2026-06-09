import type { WizardInput, Skeleton, SkeletonBlock, TargetSkill } from "./types";
import { TEAM_SITUATIONAL_SLUGS } from "./types";
import type { CatSlug } from "@/components/uff-web/drills/atoms";

const MIN_SKILL_BLOCK = 12;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

type Pending = { key: string; name: string; kind: SkeletonBlock["kind"]; skillIds: string[]; categorySlugs: CatSlug[]; share: number };

export function buildSkeleton(input: WizardInput): Skeleton {
  const total = Math.max(1, Math.round(input.totalMinutes));
  const warmup = input.includeWarmup ? clamp(Math.round(total * 0.12), 5, 15) : 0;

  // Skill buckets (round-robin) for the Skills block.
  const skills = input.includeSkills ? input.skills : [];
  const remainderPool = total - warmup;
  const nSkillBlocks = (input.includeSkills && skills.length)
    ? clamp(Math.floor(remainderPool / MIN_SKILL_BLOCK), 1, skills.length)
    : 0;
  const buckets: TargetSkill[][] = Array.from({ length: nSkillBlocks }, () => []);
  skills.forEach((s, i) => buckets[i % Math.max(1, nSkillBlocks)].push(s));
  const mergedSkillCount = Math.max(0, skills.length - nSkillBlocks);

  // Build the ordered list of share-weighted blocks (excluding warm-up's fixed slice).
  const pending: Pending[] = [];
  buckets.forEach((bucket, i) => {
    const names = bucket.map((s) => s.skillName);
    const name = bucket.length <= 1 ? (names[0] ?? "Skill Work") : `${names[0]} +${bucket.length - 1} more`;
    pending.push({ key: `skill-${i + 1}`, name, kind: "skill", skillIds: bucket.map((s) => s.skillId), categorySlugs: [], share: 1 });
  });
  if (input.includeTeamSituational) {
    pending.push({ key: "team", name: "Team / Situational", kind: "team", skillIds: [], categorySlugs: TEAM_SITUATIONAL_SLUGS, share: 1.5 });
  }
  input.customBlocks.forEach((cb, i) => {
    pending.push({
      key: `custom-${i + 1}`, name: cb.name || `Block ${i + 1}`, kind: "custom",
      skillIds: [], categorySlugs: cb.source === "manual" ? [] : [cb.source], share: Math.max(0.1, cb.share),
    });
  });

  const pool = Math.max(0, total - warmup);
  const shareSum = pending.reduce((n, p) => n + p.share, 0) || 1;

  const blocks: SkeletonBlock[] = [];
  if (warmup > 0) blocks.push({ key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], categorySlugs: ["warmup"], targetMinutes: warmup });
  pending.forEach((p) =>
    blocks.push({ key: p.key, name: p.name, kind: p.kind, skillIds: p.skillIds, categorySlugs: p.categorySlugs, targetMinutes: Math.max(1, Math.round((pool * p.share) / shareSum)) }),
  );
  if (blocks.length === 0) blocks.push({ key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], categorySlugs: ["warmup"], targetMinutes: total });

  const drift = total - blocks.reduce((n, b) => n + b.targetMinutes, 0);
  if (drift !== 0) blocks[blocks.length - 1].targetMinutes += drift;

  return { blocks, totalMinutes: total, mergedSkillCount };
}
