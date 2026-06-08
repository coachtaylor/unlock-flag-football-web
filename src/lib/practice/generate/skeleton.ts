import type { GenerateInput, Skeleton, SkeletonBlock, TargetSkill } from "./types";

const MIN_SKILL_BLOCK = 12;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function buildSkeleton(input: GenerateInput): Skeleton {
  const total = Math.max(1, Math.round(input.totalMinutes));
  const skills = input.skills;

  const warmup = clamp(Math.round(total * 0.12), 5, 15);
  const cooldown = clamp(Math.round(total * 0.1), 5, 10);
  let team = clamp(Math.round(total * 0.2), 10, 30);

  let skillPool = total - warmup - cooldown - team;
  if (skillPool < MIN_SKILL_BLOCK) {
    team = 0;
    skillPool = total - warmup - cooldown;
  }
  if (skillPool < 1) skillPool = 1; // degenerate tiny practice

  const wanted = Math.max(1, skills.length);
  const nSkillBlocks = clamp(Math.floor(skillPool / MIN_SKILL_BLOCK), 1, wanted);
  const mergedSkillCount = Math.max(0, skills.length - nSkillBlocks);

  const buckets: TargetSkill[][] = Array.from({ length: nSkillBlocks }, () => []);
  skills.forEach((s, i) => buckets[i % nSkillBlocks].push(s));

  const base = Math.floor(skillPool / nSkillBlocks);
  let rem = skillPool - base * nSkillBlocks;

  const blocks: SkeletonBlock[] = [];
  blocks.push({ key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], targetMinutes: warmup });

  buckets.forEach((bucket, i) => {
    const minutes = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem -= 1;
    const names = bucket.map((s) => s.skillName);
    const name = bucket.length <= 1 ? (names[0] ?? "Skill Work") : `${names[0]} +${bucket.length - 1} more`;
    blocks.push({
      key: `skill-${i + 1}`,
      name,
      kind: "skill",
      skillIds: bucket.map((s) => s.skillId),
      targetMinutes: minutes,
    });
  });

  if (team > 0) {
    blocks.push({ key: "team", name: "Team / Situational", kind: "team", skillIds: [], targetMinutes: team });
  }
  blocks.push({ key: "cooldown", name: "Cool-Down", kind: "cooldown", skillIds: [], targetMinutes: cooldown });

  const sum = blocks.reduce((n, b) => n + b.targetMinutes, 0);
  const drift = total - sum;
  if (drift !== 0) blocks[blocks.length - 1].targetMinutes += drift;

  return { blocks, totalMinutes: total, mergedSkillCount };
}
