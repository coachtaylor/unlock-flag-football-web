# AI Practice Plan Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hybrid (rules + AI) practice-plan generator to the existing coach planner: deterministic rules build the block skeleton and gather candidate drills, one Claude call selects/orders drills + writes cues + per-block rationale, and the coach reviews in a per-block preview before accepting into the existing editor.

**Architecture:** A React-free engine (`lib/practice/generate/`) splits into pure, unit-tested logic (skeleton math, candidate ranking/gap detection, AI-output validation, save-payload mapping) and thin impure adapters (DB fetch, the Anthropic call). Server actions orchestrate engine → AI → `ai_plan_generations` log. UI (dialog + per-block preview) is built with `/frontend-design` against fixed data contracts. Accepting a plan reuses the existing `createPlanDraft` + `savePlan` path unchanged.

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), Supabase (Postgres + RLS), `@anthropic-ai/sdk`, vitest (new), Tailwind v4 (UFF tokens). Spec: `docs/2026-06-07-ai-practice-plan-generator-design.md`.

**Branch:** `build-12-ai-practice-plan-generator` (already created; spec already committed at `b2b5af8`).

---

## File Structure

**New — engine (`src/lib/practice/generate/`):**
- `types.ts` — all generator types (imports `PlanBlock`/`PlanDrill` from `plan-data.ts`, `SkillGroup` from `skill-groups.ts`; never redefines them).
- `skeleton.ts` — `buildSkeleton()` time-budget math (pure).
- `candidates.ts` — `assembleBlockCandidates()` ranking + gap detection (pure) **and** `fetchCandidatesBySkill()` / `recentlyRunDrills()` / `fetchDrillScores()` (impure DB adapters).
- `ai-contract.ts` — `buildPlanToolSchema()` + `validatePlanOutput()` (pure).
- `ai.ts` — `callPlanModel()` Anthropic call + `MODEL_ID` (impure).
- `to-payload.ts` — `toSavePayload()` maps engine output → `SavePlanPayload` (pure).
- `fallback.ts` — `buildFallbackPlan()` rules-only output (pure).
- `resolve-skills.ts` — `resolveTargetSkills()` (pure).
- `actions.ts` — server actions (`generatePlan`, `regenerateBlock`, `adoptGapDrill`, `createPlanFromGeneration`, `recordGenerationFeedback`).

**New — UI (`src/components/practice/generate/`):**
- `GenerateClient.tsx` — orchestrates dialog ↔ preview.
- `GenerateDialog.tsx` — inputs (time/format/skill multi-select).
- `PreviewClient.tsx` — per-block preview, swap/reject/regenerate, gap adoption, accept.
- `generate-view-types.ts` — props/view-model types shared by the components.

**New — route:**
- `src/app/(workspace)/dashboard/team/[teamId]/practice/generate/page.tsx`.

**New — tests (`src/lib/practice/generate/__tests__/`):**
- `skeleton.test.ts`, `candidates.test.ts`, `ai-contract.test.ts`, `fallback.test.ts`, `to-payload.test.ts`, `actions-validation.test.ts`.

**New — DB:**
- `qb_supabase_full_package/sql/102_ai_plan_generator.sql`.

**Modified:**
- `package.json` — add `@anthropic-ai/sdk`, `vitest`, test scripts.
- `src/lib/ai/anthropic.ts` (new shared client).
- `src/app/(workspace)/dashboard/team/[teamId]/practice/page.tsx` (+ its client) — "Generate with AI" entry.
- `src/app/(workspace)/dashboard/team/[teamId]/page.tsx` — "Plan this week" quick action.
- `src/components/practice/EditorClient.tsx` — "AI fill" entry.

---

## Phase 0 — Setup

### Task 1: Add vitest + test script

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run:
```bash
cd /Users/taylorpangilinan/Downloads/qb_supabase_database/unlock-web && npm i -D vitest@^3
```
Expected: `vitest` added to devDependencies.

- [ ] **Step 2: Add test scripts**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 4: Sanity test**

Create `src/lib/practice/generate/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => { it("runs", () => { expect(1 + 1).toBe(2); }); });
```
Run: `npm test`
Expected: PASS (1 test). Then delete `smoke.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test runner"
```

### Task 2: Add Anthropic SDK + shared client

**Files:**
- Modify: `package.json`
- Create: `src/lib/ai/anthropic.ts`
- Modify: `.env.local` (local only; not committed)

- [ ] **Step 1: Install SDK**

Run: `npm i @anthropic-ai/sdk`

- [ ] **Step 2: Create the shared client** (single source — Drill Drafter reuses this)

Create `src/lib/ai/anthropic.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Lazily-constructed server-only Anthropic client. Throws if the key is missing. */
export function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  client = new Anthropic({ apiKey });
  return client;
}
```

- [ ] **Step 3: Add the key locally**

Add `ANTHROPIC_API_KEY=...` to `.env.local` (do NOT commit; do NOT print the key in chat).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/ai/anthropic.ts
git commit -m "chore: add Anthropic SDK + shared server client"
```

### Task 3: Migration — `ai_plan_generations` + `practice_plans.origin` + idempotent `team_drills.source`

**Files:**
- Create: `qb_supabase_full_package/sql/102_ai_plan_generator.sql`

- [ ] **Step 1: Verify helper names exist first**

Run:
```bash
grep -rn "get_my_writable_team_ids\|get_my_team_ids" qb_supabase_full_package/sql | head
```
Expected: both functions defined in earlier migrations. If `get_my_writable_team_ids` is absent, use `get_my_team_ids` in the write policies below and note it.

- [ ] **Step 2: Write the migration**

Create `qb_supabase_full_package/sql/102_ai_plan_generator.sql`:
```sql
-- 102_ai_plan_generator.sql — AI Practice Plan Generator
-- Additive only. Idempotent where it overlaps the in-flight AI Drill Drafter (build-11).

-- 1. Mark AI-originated plans (unused in MVP UI; analytics only)
alter table public.practice_plans
  add column if not exists origin text not null default 'manual';
alter table public.practice_plans
  drop constraint if exists practice_plans_origin_chk;
alter table public.practice_plans
  add constraint practice_plans_origin_chk check (origin in ('manual','ai'));

-- 2. Drill provenance (shared with Drill Drafter; safe if it already added these)
alter table public.team_drills
  add column if not exists source text not null default 'manual';
alter table public.team_drills
  drop constraint if exists team_drills_source_chk;
alter table public.team_drills
  add constraint team_drills_source_chk check (source in ('manual','ai'));

-- 3. Generation log = feedback loop + cost tracking
create table if not exists public.ai_plan_generations (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams(id) on delete cascade,
  created_by       uuid not null references auth.users(id),
  practice_plan_id uuid references public.practice_plans(id) on delete set null,
  input_json       jsonb not null,
  output_json      jsonb,
  model            text,
  input_tokens     int,
  output_tokens    int,
  cost_usd         numeric(8,4),
  used_fallback    boolean not null default false,
  accepted         boolean not null default false,
  user_feedback    smallint check (user_feedback in (-1, 1)),
  created_at       timestamptz not null default now()
);

alter table public.ai_plan_generations enable row level security;

-- RLS: SETOF pattern (IN (SELECT ...)), never = ANY(...)
drop policy if exists ai_plan_generations_select on public.ai_plan_generations;
create policy ai_plan_generations_select on public.ai_plan_generations
  for select using (team_id in (select public.get_my_team_ids()));

drop policy if exists ai_plan_generations_insert on public.ai_plan_generations;
create policy ai_plan_generations_insert on public.ai_plan_generations
  for insert with check (
    team_id in (select public.get_my_writable_team_ids())
    and created_by = auth.uid()
  );

drop policy if exists ai_plan_generations_update on public.ai_plan_generations;
create policy ai_plan_generations_update on public.ai_plan_generations
  for update using (team_id in (select public.get_my_writable_team_ids()));
```

- [ ] **Step 3: Commit (Taylor runs the SQL by hand in Supabase)**

```bash
git add qb_supabase_full_package/sql/102_ai_plan_generator.sql
git commit -m "feat(db): ai_plan_generations + practice_plans.origin (mig 102)"
```

> **NOTE for executor:** This repo's SQL is applied manually by the user in the Supabase dashboard — do NOT auto-apply. After committing, tell the user to run migration 102.

---

## Phase 1 — Engine: types + skeleton (TDD)

### Task 4: Generator types

**Files:**
- Create: `src/lib/practice/generate/types.ts`

- [ ] **Step 1: Write the types**

Create `src/lib/practice/generate/types.ts`:
```ts
import type { SkillGroup } from "@/lib/drills/skill-groups";

export type PracticeFormat = "5v5" | "7v7";

/** A targeted skill the coach selected (or an auto-weakness). */
export type TargetSkill = {
  skillId: string;
  skillName: string;
  skillGroup: SkillGroup;
  avgScore: number | null; // 0..1 team composite; lower = weaker. null = unmeasured.
};

export type GenerateInput = {
  teamId: string;
  totalMinutes: number;
  format: PracticeFormat;
  /** Targeted skills. Empty => caller resolves to team auto-weaknesses before buildSkeleton. */
  skills: TargetSkill[];
};

export type BlockKind = "warmup" | "skill" | "team" | "cooldown";

export type SkeletonBlock = {
  key: string;        // stable within one skeleton, e.g. "warmup", "skill-1", "team", "cooldown"
  name: string;       // display name
  kind: BlockKind;
  skillIds: string[]; // [] for warmup/team/cooldown
  targetMinutes: number;
};

export type Skeleton = {
  blocks: SkeletonBlock[];
  totalMinutes: number;     // == input.totalMinutes after rounding
  mergedSkillCount: number; // targeted skills packed beyond their own block
};

/** A drill eligible for a block, already joined to score + recency (pure-test friendly). */
export type CandidateDrill = {
  drillId: string;
  drillName: string;
  categoryName: string | null;
  benchmarkTypes: string[];      // subset of ["timed","rated"]
  defaultDurationMin: number | null;
  skillWeight: number;           // 1.0 (primary) | 0.5 (secondary)
  drillScore: number | null;     // 0..1 team avg; lower = weaker. null = unmeasured.
  lastRunISO: string | null;     // most recent completed-practice date, or null
};

export type BlockCandidates = {
  blockKey: string;
  candidates: CandidateDrill[];  // ranked best-first
  gapSkillIds: string[];         // targeted skills in this block with zero candidates
};

// --- AI output (post-validation) ---
export type GeneratedDrill = { drillId: string; coachingCue: string };
export type GapProposal = {
  skillId: string;
  name: string;
  description: string;
  category: string;
};
export type GeneratedBlock = {
  blockKey: string;
  rationale: string;
  drills: GeneratedDrill[];
  gapProposals: GapProposal[];
};
export type GeneratedPlan = {
  blocks: GeneratedBlock[];
  usedFallback: boolean;
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from this file. (If `SkillGroup` is not exported from `@/lib/drills/skill-groups`, `grep -rn "export type SkillGroup\|export { SkillGroup" src` and import from the correct module.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/practice/generate/types.ts
git commit -m "feat(generate): engine types"
```

### Task 5: `buildSkeleton` — time-budget math (TDD)

**Files:**
- Create: `src/lib/practice/generate/skeleton.ts`
- Test: `src/lib/practice/generate/__tests__/skeleton.test.ts`

**Algorithm (constants at top of `skeleton.ts`):**
- `WARMUP = clamp(round(total*0.12), 5, 15)`
- `COOLDOWN = clamp(round(total*0.10), 5, 10)`
- `TEAM = clamp(round(total*0.20), 10, 30)` — dropped to 0 if `total - WARMUP - COOLDOWN - TEAM < MIN_SKILL_BLOCK`
- `MIN_SKILL_BLOCK = 12`
- `skillPool = total - WARMUP - COOLDOWN - (team kept ? TEAM : 0)`
- `nSkillBlocks = clamp(floor(skillPool / MIN_SKILL_BLOCK), 1, skills.length)`
- skills distributed round-robin across the N blocks; minutes = even split of `skillPool` with remainder to earlier blocks; merged block name = `"<first> +N more"`.
- Final pass: absorb rounding drift into the last block so the sum equals `total` exactly.

- [ ] **Step 1: Write the failing test**

Create `src/lib/practice/generate/__tests__/skeleton.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSkeleton } from "../skeleton";
import type { TargetSkill } from "../types";

const sk = (id: string, name: string): TargetSkill => ({
  skillId: id, skillName: name, skillGroup: "athletic", avgScore: 0.4,
});

describe("buildSkeleton", () => {
  it("90 min / 3 skills => warmup, 3 skill blocks, team, cooldown; sums to 90", () => {
    const s = buildSkeleton({
      teamId: "t", totalMinutes: 90, format: "7v7",
      skills: [sk("a", "Change of Direction"), sk("b", "Zone Coverage"), sk("c", "Route Running")],
    });
    expect(s.totalMinutes).toBe(90);
    expect(s.blocks.reduce((n, b) => n + b.targetMinutes, 0)).toBe(90);
    expect(s.blocks.map((b) => b.kind)).toEqual(["warmup", "skill", "skill", "skill", "team", "cooldown"]);
    expect(s.mergedSkillCount).toBe(0);
    expect(s.blocks.filter((b) => b.kind === "skill").every((b) => b.skillIds.length === 1)).toBe(true);
  });

  it("merges skills when minutes are tight (45 min / 4 skills)", () => {
    const s = buildSkeleton({
      teamId: "t", totalMinutes: 45, format: "5v5",
      skills: [sk("a", "A"), sk("b", "B"), sk("c", "C"), sk("d", "D")],
    });
    expect(s.blocks.reduce((n, b) => n + b.targetMinutes, 0)).toBe(45);
    const skillBlocks = s.blocks.filter((b) => b.kind === "skill");
    expect(skillBlocks.length).toBeLessThan(4);
    expect(s.mergedSkillCount).toBe(4 - skillBlocks.length);
    const covered = skillBlocks.flatMap((b) => b.skillIds).sort();
    expect(covered).toEqual(["a", "b", "c", "d"]);
  });

  it("always emits at least one skill block even for a very short practice", () => {
    const s = buildSkeleton({
      teamId: "t", totalMinutes: 25, format: "5v5", skills: [sk("a", "A"), sk("b", "B")],
    });
    expect(s.blocks.some((b) => b.kind === "skill")).toBe(true);
    expect(s.blocks.reduce((n, b) => n + b.targetMinutes, 0)).toBe(25);
    expect(s.blocks.every((b) => b.targetMinutes > 0)).toBe(true);
  });

  it("labels a merged skill block with '+N more'", () => {
    const s = buildSkeleton({
      teamId: "t", totalMinutes: 40, format: "5v5",
      skills: [sk("a", "Alpha"), sk("b", "Bravo"), sk("c", "Charlie")],
    });
    const merged = s.blocks.find((b) => b.kind === "skill" && b.skillIds.length > 1);
    if (merged) expect(merged.name).toMatch(/\+\d+ more/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/practice/generate/__tests__/skeleton.test.ts`
Expected: FAIL — `buildSkeleton` not exported.

- [ ] **Step 3: Implement `skeleton.ts`**

Create `src/lib/practice/generate/skeleton.ts`:
```ts
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
  if (skillPool < MIN_SKILL_BLOCK) { team = 0; skillPool = total - warmup - cooldown; }
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
      key: `skill-${i + 1}`, name, kind: "skill",
      skillIds: bucket.map((s) => s.skillId), targetMinutes: minutes,
    });
  });

  if (team > 0) blocks.push({ key: "team", name: "Team / Situational", kind: "team", skillIds: [], targetMinutes: team });
  blocks.push({ key: "cooldown", name: "Cool-Down", kind: "cooldown", skillIds: [], targetMinutes: cooldown });

  const sum = blocks.reduce((n, b) => n + b.targetMinutes, 0);
  const drift = total - sum;
  if (drift !== 0) blocks[blocks.length - 1].targetMinutes += drift;

  return { blocks, totalMinutes: total, mergedSkillCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/practice/generate/__tests__/skeleton.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/practice/generate/skeleton.ts src/lib/practice/generate/__tests__/skeleton.test.ts
git commit -m "feat(generate): buildSkeleton time-budget math + tests"
```

---

## Phase 2 — Engine: candidates

### Task 6: `assembleBlockCandidates` — ranking + gap detection (pure, TDD)

**Files:**
- Create: `src/lib/practice/generate/candidates.ts`
- Test: `src/lib/practice/generate/__tests__/candidates.test.ts`

**Ranking (deterministic), best-first:** (1) `skillWeight` desc, (2) not-run-recently before run-in-last-14-days, (3) `drillScore` asc with null treated as `0.5`, (4) `drillName` asc. Cap `MAX_CANDIDATES = 6`. `gapSkillIds` = targeted skills with zero tagged drills. Non-skill blocks → empty.

- [ ] **Step 1: Write the failing test**

Create `src/lib/practice/generate/__tests__/candidates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { assembleBlockCandidates } from "../candidates";
import type { CandidateDrill, SkeletonBlock } from "../types";

const NOW = "2026-06-07T00:00:00.000Z";
const cand = (p: Partial<CandidateDrill> & { drillId: string; drillName: string }): CandidateDrill => ({
  categoryName: "defense", benchmarkTypes: [], defaultDurationMin: 10,
  skillWeight: 1, drillScore: 0.5, lastRunISO: null, ...p,
});
const skillBlock: SkeletonBlock = {
  key: "skill-1", name: "Zone Coverage", kind: "skill", skillIds: ["zone"], targetMinutes: 20,
};

describe("assembleBlockCandidates", () => {
  it("ranks primary weight, then stale, then weaker score", () => {
    const bySkill = new Map<string, CandidateDrill[]>([
      ["zone", [
        cand({ drillId: "secondary", drillName: "Sec", skillWeight: 0.5, drillScore: 0.1 }),
        cand({ drillId: "recent", drillName: "Recent", skillWeight: 1, drillScore: 0.2, lastRunISO: NOW }),
        cand({ drillId: "weak-stale", drillName: "WeakStale", skillWeight: 1, drillScore: 0.2, lastRunISO: null }),
        cand({ drillId: "strong-stale", drillName: "StrongStale", skillWeight: 1, drillScore: 0.8, lastRunISO: null }),
      ]],
    ]);
    const out = assembleBlockCandidates(skillBlock, bySkill, NOW);
    expect(out.candidates.map((c) => c.drillId)).toEqual(["weak-stale", "strong-stale", "recent", "secondary"]);
    expect(out.gapSkillIds).toEqual([]);
  });

  it("flags a gap when a targeted skill has no drills", () => {
    const block: SkeletonBlock = { ...skillBlock, skillIds: ["zone", "press"] };
    const bySkill = new Map<string, CandidateDrill[]>([["zone", [cand({ drillId: "z", drillName: "Z" })]]]);
    const out = assembleBlockCandidates(block, bySkill, NOW);
    expect(out.gapSkillIds).toEqual(["press"]);
    expect(out.candidates.map((c) => c.drillId)).toEqual(["z"]);
  });

  it("dedups a drill tagged to two skills and caps at 6", () => {
    const block: SkeletonBlock = { ...skillBlock, skillIds: ["a", "b"] };
    const shared = cand({ drillId: "dup", drillName: "Dup" });
    const bySkill = new Map<string, CandidateDrill[]>([
      ["a", [shared, ...Array.from({ length: 5 }, (_, i) => cand({ drillId: `a${i}`, drillName: `A${i}` }))]],
      ["b", [shared, ...Array.from({ length: 5 }, (_, i) => cand({ drillId: `b${i}`, drillName: `B${i}` }))]],
    ]);
    const out = assembleBlockCandidates(block, bySkill, NOW);
    expect(out.candidates.filter((c) => c.drillId === "dup").length).toBe(1);
    expect(out.candidates.length).toBe(6);
  });

  it("returns empty for non-skill blocks", () => {
    const warm: SkeletonBlock = { key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], targetMinutes: 10 };
    const out = assembleBlockCandidates(warm, new Map(), NOW);
    expect(out.candidates).toEqual([]);
    expect(out.gapSkillIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/practice/generate/__tests__/candidates.test.ts`
Expected: FAIL — `assembleBlockCandidates` not exported.

- [ ] **Step 3: Implement the pure function**

Create `src/lib/practice/generate/candidates.ts`:
```ts
import type { BlockCandidates, CandidateDrill, SkeletonBlock } from "./types";

const MAX_CANDIDATES = 6;
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

function ranRecently(lastRunISO: string | null, nowISO: string): boolean {
  if (!lastRunISO) return false;
  return new Date(nowISO).getTime() - new Date(lastRunISO).getTime() < FOURTEEN_DAYS;
}

/** PURE: assemble + rank candidate drills for one skeleton block. */
export function assembleBlockCandidates(
  block: SkeletonBlock,
  candidatesBySkill: Map<string, CandidateDrill[]>,
  nowISO: string,
): BlockCandidates {
  if (block.kind !== "skill" || block.skillIds.length === 0) {
    return { blockKey: block.key, candidates: [], gapSkillIds: [] };
  }
  const gapSkillIds = block.skillIds.filter((id) => (candidatesBySkill.get(id)?.length ?? 0) === 0);

  const byId = new Map<string, CandidateDrill>();
  for (const id of block.skillIds) {
    for (const c of candidatesBySkill.get(id) ?? []) {
      const prev = byId.get(c.drillId);
      if (!prev || c.skillWeight > prev.skillWeight) byId.set(c.drillId, c);
    }
  }

  const ranked = [...byId.values()].sort((a, b) => {
    if (b.skillWeight !== a.skillWeight) return b.skillWeight - a.skillWeight;
    const aStale = ranRecently(a.lastRunISO, nowISO) ? 1 : 0;
    const bStale = ranRecently(b.lastRunISO, nowISO) ? 1 : 0;
    if (aStale !== bStale) return aStale - bStale;
    const as = a.drillScore ?? 0.5, bs = b.drillScore ?? 0.5;
    if (as !== bs) return as - bs;
    return a.drillName.localeCompare(b.drillName);
  });

  return { blockKey: block.key, candidates: ranked.slice(0, MAX_CANDIDATES), gapSkillIds };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/practice/generate/__tests__/candidates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/practice/generate/candidates.ts src/lib/practice/generate/__tests__/candidates.test.ts
git commit -m "feat(generate): candidate ranking + gap detection + tests"
```

### Task 7: DB adapters — fetch candidates, scores, recency (impure)

**Files:**
- Modify: `src/lib/practice/generate/candidates.ts` (append impure fetchers)

> **Verify-at-build:** confirm `drill_skills` columns (`drill_id`, `skill_id`, `weight`) and `drill_categories.name`:
> `grep -rn "create table.*drill_skills\|create table.*drill_categories" qb_supabase_full_package/sql`
> Confirm the per-drill score source/columns: `grep -rn "v_player_drill_score" qb_supabase_full_package/sql | head` (use its `drill_id` + score column names).

- [ ] **Step 1: Append the fetchers (integration-verified, no unit test)**

Append to `src/lib/practice/generate/candidates.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/** IMPURE: published team drills tagged to any of skillIds, keyed by skillId. */
export async function fetchCandidatesBySkill(
  supabase: SupabaseClient,
  teamId: string,
  skillIds: string[],
): Promise<Map<string, CandidateDrill[]>> {
  const out = new Map<string, CandidateDrill[]>();
  if (skillIds.length === 0) return out;

  const { data, error } = await supabase
    .from("drill_skills")
    .select("skill_id, weight, team_drills!inner(id, drill_name, status, team_id, benchmark_type, drill_categories(name))")
    .in("skill_id", skillIds)
    .eq("team_drills.team_id", teamId)
    .eq("team_drills.status", "published");
  if (error) throw error;

  const scores = await fetchDrillScores(supabase, teamId);
  const recent = await recentlyRunDrills(supabase, teamId);

  for (const row of (data ?? []) as any[]) {
    const d = row.team_drills;
    if (!d) continue;
    const c: CandidateDrill = {
      drillId: d.id,
      drillName: d.drill_name,
      categoryName: d.drill_categories?.name ?? null,
      benchmarkTypes: d.benchmark_type ? [d.benchmark_type] : [],
      defaultDurationMin: null,
      skillWeight: Number(row.weight ?? 1),
      drillScore: scores.get(d.id) ?? null,
      lastRunISO: recent.get(d.id) ?? null,
    };
    const list = out.get(row.skill_id) ?? [];
    list.push(c);
    out.set(row.skill_id, list);
  }
  return out;
}

/** IMPURE: per-drill team avg score (0..1) from the unified score view. Fails soft. */
export async function fetchDrillScores(supabase: SupabaseClient, teamId: string): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  const { data, error } = await supabase
    .from("v_player_drill_score").select("drill_id, score").eq("team_id", teamId);
  if (error) return m; // view name/shape may differ — ranking falls back to nulls
  const agg = new Map<string, { sum: number; n: number }>();
  for (const r of (data ?? []) as any[]) {
    if (r.score == null) continue;
    const a = agg.get(r.drill_id) ?? { sum: 0, n: 0 };
    a.sum += Number(r.score); a.n += 1; agg.set(r.drill_id, a);
  }
  for (const [id, a] of agg) m.set(id, a.sum / a.n);
  return m;
}

/** IMPURE: drillId -> most recent completed-practice ISO date. Fails soft. */
export async function recentlyRunDrills(supabase: SupabaseClient, teamId: string): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const { data, error } = await supabase
    .from("practice_plan_drills")
    .select("drill_id, practice_plans!inner(practice_date, team_id, status)")
    .eq("practice_plans.team_id", teamId)
    .eq("practice_plans.status", "completed");
  if (error) return m;
  for (const r of (data ?? []) as any[]) {
    if (!r.drill_id) continue;
    const date = r.practice_plans?.practice_date;
    if (!date) continue;
    const iso = new Date(date).toISOString();
    const prev = m.get(r.drill_id);
    if (!prev || iso > prev) m.set(r.drill_id, iso);
  }
  return m;
}
```

- [ ] **Step 2: Typecheck + re-run pure tests**

Run: `npx tsc --noEmit && npx vitest run src/lib/practice/generate/__tests__/candidates.test.ts`
Expected: no type errors; 4 tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/practice/generate/candidates.ts
git commit -m "feat(generate): candidate DB adapters (drills, scores, recency)"
```

---

## Phase 3 — Engine: AI contract, fallback, payload, call

### Task 8: `ai-contract.ts` — tool schema + output validation (pure, TDD)

**Files:**
- Create: `src/lib/practice/generate/ai-contract.ts`
- Test: `src/lib/practice/generate/__tests__/ai-contract.test.ts`

**`validatePlanOutput` rules:** keep only blocks whose `blockKey` is in the skeleton; drop drills whose `drillId` is not in that block's candidate set; clamp cue→120, rationale→140, gap description→400, name→80, category→40; keep gap proposals only for the block's `gapSkillIds`. Returns `GeneratedPlan{usedFallback:false}`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/practice/generate/__tests__/ai-contract.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validatePlanOutput } from "../ai-contract";
import type { BlockCandidates, Skeleton } from "../types";

const skeleton: Skeleton = {
  totalMinutes: 60, mergedSkillCount: 0,
  blocks: [
    { key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], targetMinutes: 8 },
    { key: "skill-1", name: "Zone", kind: "skill", skillIds: ["zone", "press"], targetMinutes: 40 },
    { key: "cooldown", name: "Cool-Down", kind: "cooldown", skillIds: [], targetMinutes: 12 },
  ],
};
const blockCandidates: BlockCandidates[] = [
  { blockKey: "warmup", candidates: [], gapSkillIds: [] },
  { blockKey: "skill-1", candidates: [
      { drillId: "d1", drillName: "D1", categoryName: null, benchmarkTypes: [], defaultDurationMin: 10, skillWeight: 1, drillScore: 0.3, lastRunISO: null },
    ], gapSkillIds: ["press"] },
  { blockKey: "cooldown", candidates: [], gapSkillIds: [] },
];

describe("validatePlanOutput", () => {
  it("drops unknown blocks and non-candidate drills", () => {
    const out = validatePlanOutput({
      blocks: [
        { blockKey: "ghost", rationale: "x", drills: [{ drillId: "d1", coachingCue: "c" }], gapProposals: [] },
        { blockKey: "skill-1", rationale: "Targets zone", drills: [
            { drillId: "d1", coachingCue: "Stay over the top" },
            { drillId: "hallucinated", coachingCue: "nope" },
          ], gapProposals: [] },
      ],
    }, skeleton, blockCandidates);
    const skill = out.blocks.find((b) => b.blockKey === "skill-1")!;
    expect(out.blocks.some((b) => b.blockKey === "ghost")).toBe(false);
    expect(skill.drills.map((d) => d.drillId)).toEqual(["d1"]);
    expect(out.usedFallback).toBe(false);
  });

  it("keeps gap proposals only for real gap skills and clamps text", () => {
    const out = validatePlanOutput({
      blocks: [{ blockKey: "skill-1", rationale: "r".repeat(200), drills: [], gapProposals: [
        { skillId: "press", name: "Press Bail", description: "d".repeat(900), category: "defense" },
        { skillId: "zone", name: "bogus", description: "zone has drills", category: "defense" },
      ] }],
    }, skeleton, blockCandidates);
    const skill = out.blocks.find((b) => b.blockKey === "skill-1")!;
    expect(skill.gapProposals.map((g) => g.skillId)).toEqual(["press"]);
    expect(skill.gapProposals[0].description.length).toBe(400);
    expect(skill.rationale.length).toBe(140);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `npx vitest run src/lib/practice/generate/__tests__/ai-contract.test.ts`

- [ ] **Step 3: Implement `ai-contract.ts`**

Create `src/lib/practice/generate/ai-contract.ts`:
```ts
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
                    skillId: { type: "string" }, name: { type: "string" },
                    description: { type: "string" }, category: { type: "string" },
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
  const rawBlocks = (raw as any)?.blocks;
  const blocks: GeneratedBlock[] = [];

  for (const rb of Array.isArray(rawBlocks) ? rawBlocks : []) {
    const key = rb?.blockKey;
    if (!keyExists.has(key)) continue;
    const bc = candByKey.get(key);
    const allowedDrillIds = new Set((bc?.candidates ?? []).map((c) => c.drillId));
    const gapSkills = new Set(bc?.gapSkillIds ?? []);

    const drills = (Array.isArray(rb.drills) ? rb.drills : [])
      .filter((d: any) => allowedDrillIds.has(d?.drillId))
      .map((d: any) => ({ drillId: d.drillId as string, coachingCue: clampStr(d.coachingCue, 120) }));

    const gapProposals = (Array.isArray(rb.gapProposals) ? rb.gapProposals : [])
      .filter((g: any) => gapSkills.has(g?.skillId))
      .map((g: any) => ({
        skillId: g.skillId as string,
        name: clampStr(g.name, 80),
        description: clampStr(g.description, 400),
        category: clampStr(g.category, 40),
      }));

    blocks.push({ blockKey: key, rationale: clampStr(rb.rationale, 140), drills, gapProposals });
  }
  return { blocks, usedFallback: false };
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `npx vitest run src/lib/practice/generate/__tests__/ai-contract.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/practice/generate/ai-contract.ts src/lib/practice/generate/__tests__/ai-contract.test.ts
git commit -m "feat(generate): AI tool schema + output validation + tests"
```

### Task 9: `fallback.ts` — rules-only plan (pure, TDD)

**Files:**
- Create: `src/lib/practice/generate/fallback.ts`
- Test: `src/lib/practice/generate/__tests__/fallback.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/practice/generate/__tests__/fallback.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildFallbackPlan } from "../fallback";
import type { BlockCandidates, Skeleton } from "../types";

const skeleton: Skeleton = {
  totalMinutes: 60, mergedSkillCount: 0,
  blocks: [
    { key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], targetMinutes: 8 },
    { key: "skill-1", name: "Zone", kind: "skill", skillIds: ["zone"], targetMinutes: 40 },
    { key: "cooldown", name: "Cool-Down", kind: "cooldown", skillIds: [], targetMinutes: 12 },
  ],
};
const bc: BlockCandidates[] = [
  { blockKey: "skill-1", gapSkillIds: [], candidates: [
    { drillId: "top", drillName: "Top", categoryName: null, benchmarkTypes: [], defaultDurationMin: 10, skillWeight: 1, drillScore: 0.2, lastRunISO: null },
    { drillId: "other", drillName: "Other", categoryName: null, benchmarkTypes: [], defaultDurationMin: 10, skillWeight: 1, drillScore: 0.5, lastRunISO: null },
  ] },
];

describe("buildFallbackPlan", () => {
  it("picks the top candidate per skill block and sets usedFallback", () => {
    const out = buildFallbackPlan(skeleton, bc);
    expect(out.usedFallback).toBe(true);
    const skill = out.blocks.find((b) => b.blockKey === "skill-1")!;
    expect(skill.drills.map((d) => d.drillId)).toEqual(["top"]);
    expect(skill.rationale).toContain("Zone");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/lib/practice/generate/__tests__/fallback.test.ts`

- [ ] **Step 3: Implement `fallback.ts`**

Create `src/lib/practice/generate/fallback.ts`:
```ts
import type { BlockCandidates, GeneratedBlock, GeneratedPlan, Skeleton } from "./types";

export function buildFallbackPlan(skeleton: Skeleton, blockCandidates: BlockCandidates[]): GeneratedPlan {
  const byKey = new Map(blockCandidates.map((b) => [b.blockKey, b]));
  const blocks: GeneratedBlock[] = skeleton.blocks
    .filter((b) => b.kind === "skill")
    .map((b) => {
      const top = byKey.get(b.key)?.candidates[0];
      return {
        blockKey: b.key,
        rationale: `Targets ${b.name} (auto-selected)`,
        drills: top ? [{ drillId: top.drillId, coachingCue: "" }] : [],
        gapProposals: [],
      };
    });
  return { blocks, usedFallback: true };
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/lib/practice/generate/__tests__/fallback.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/practice/generate/fallback.ts src/lib/practice/generate/__tests__/fallback.test.ts
git commit -m "feat(generate): rules-only fallback plan + test"
```

### Task 10: `to-payload.ts` — engine output → `SavePlanPayload` (pure, TDD)

**Files:**
- Create: `src/lib/practice/generate/to-payload.ts`
- Test: `src/lib/practice/generate/__tests__/to-payload.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/practice/generate/__tests__/to-payload.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toSavePayload } from "../to-payload";
import type { GeneratedPlan, Skeleton } from "../types";

const skeleton: Skeleton = {
  totalMinutes: 60, mergedSkillCount: 0,
  blocks: [
    { key: "warmup", name: "Warm-Up", kind: "warmup", skillIds: [], targetMinutes: 8 },
    { key: "skill-1", name: "Zone", kind: "skill", skillIds: ["zone"], targetMinutes: 40 },
    { key: "cooldown", name: "Cool-Down", kind: "cooldown", skillIds: [], targetMinutes: 12 },
  ],
};
const generated: GeneratedPlan = {
  usedFallback: false,
  blocks: [{ blockKey: "skill-1", rationale: "Targets zone", gapProposals: [], drills: [
    { drillId: "d1", coachingCue: "Eyes to the QB" }, { drillId: "d2", coachingCue: "Sink at the stem" },
  ] }],
};

describe("toSavePayload", () => {
  it("maps skeleton+generated into SavePlanPayload with split durations", () => {
    const p = toSavePayload({ planId: "plan-1", title: "AI practice", practiceDate: "2026-06-14", skeleton, generated });
    expect(p.plan_id).toBe("plan-1");
    expect(p.status).toBe("draft");
    expect(p.blocks.map((b) => b.name)).toEqual(["Warm-Up", "Zone", "Cool-Down"]);
    const zone = p.blocks[1];
    expect(zone.target_minutes).toBe(40);
    expect(zone.drills.map((d) => d.drill_id)).toEqual(["d1", "d2"]);
    expect(zone.drills[0].duration_minutes).toBe(20);
    expect(zone.drills[0].notes).toBe("Eyes to the QB");
    expect(zone.drills[0].drill_order).toBe(0);
    expect(p.breaks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/lib/practice/generate/__tests__/to-payload.test.ts`

- [ ] **Step 3: Implement `to-payload.ts`**

Create `src/lib/practice/generate/to-payload.ts`:
```ts
import type { SavePlanPayload, SaveBlockInput, SaveDrillInput } from "@/lib/practice/actions";
import type { GeneratedPlan, Skeleton } from "./types";

export function toSavePayload(args: {
  planId: string;
  title: string;
  practiceDate: string;
  skeleton: Skeleton;
  generated: GeneratedPlan;
  startTime?: string | null;
  endTime?: string | null;
}): SavePlanPayload {
  const genByKey = new Map(args.generated.blocks.map((b) => [b.blockKey, b]));

  const blocks: SaveBlockInput[] = args.skeleton.blocks.map((b, blockIndex) => {
    const genDrills = genByKey.get(b.key)?.drills ?? [];
    const per = genDrills.length ? Math.max(1, Math.floor(b.targetMinutes / genDrills.length)) : 0;
    const drills: SaveDrillInput[] = genDrills.map((d, i) => ({
      drill_id: d.drillId,
      drill_order: i,
      duration_minutes: per,
      reps_count: null,
      notes: d.coachingCue || null,
      parallel_group: null,
    }));
    return { name: b.name, block_order: blockIndex, target_minutes: b.targetMinutes, drills };
  });

  return {
    plan_id: args.planId,
    title: args.title,
    practice_date: args.practiceDate,
    start_time: args.startTime ?? null,
    end_time: args.endTime ?? null,
    status: "draft",
    blocks,
    breaks: [],
  };
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/lib/practice/generate/__tests__/to-payload.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/practice/generate/to-payload.ts src/lib/practice/generate/__tests__/to-payload.test.ts
git commit -m "feat(generate): engine output -> SavePlanPayload mapping + test"
```

### Task 11: `ai.ts` — the Anthropic call (impure)

**Files:**
- Create: `src/lib/practice/generate/ai.ts`

- [ ] **Step 1: Implement the call**

Create `src/lib/practice/generate/ai.ts`:
```ts
import { getAnthropic } from "@/lib/ai/anthropic";
import { buildPlanToolSchema, validatePlanOutput } from "./ai-contract";
import type { BlockCandidates, GeneratedPlan, Skeleton, TargetSkill } from "./types";

export const MODEL_ID = "claude-sonnet-4-5";

type CallResult = { plan: GeneratedPlan; inputTokens: number; outputTokens: number; model: string };

function buildPrompt(
  skeleton: Skeleton, blockCandidates: BlockCandidates[], skills: TargetSkill[],
  format: string, excludeDrillIds?: string[],
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
      blockKey: b.key, name: b.name, kind: b.kind, targetMinutes: b.targetMinutes,
      candidates: (blockCandidates.find((c) => c.blockKey === b.key)?.candidates ?? []).map((c) => ({
        drillId: c.drillId, name: c.drillName, category: c.categoryName, score: c.drillScore,
      })),
      gapSkillIds: blockCandidates.find((c) => c.blockKey === b.key)?.gapSkillIds ?? [],
    })),
  });
}

/** IMPURE: one forced-tool generation. Throws on API error (caller falls back). */
export async function callPlanModel(args: {
  skeleton: Skeleton; blockCandidates: BlockCandidates[]; skills: TargetSkill[];
  format: string; excludeDrillIds?: string[];
}): Promise<CallResult> {
  const tool = buildPlanToolSchema();
  const res = await getAnthropic().messages.create({
    model: MODEL_ID,
    max_tokens: 1500,
    tools: [tool as any],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: buildPrompt(args.skeleton, args.blockCandidates, args.skills, args.format, args.excludeDrillIds) }],
  });
  const toolUse = res.content.find((c) => c.type === "tool_use") as { input: unknown } | undefined;
  const plan = validatePlanOutput(toolUse?.input ?? {}, args.skeleton, args.blockCandidates);
  return { plan, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, model: MODEL_ID };
}
```

> **Verify-at-build:** confirm `MODEL_ID` against the current Claude model id (use the `claude-api` skill / Anthropic docs — do NOT assume). Adjust `tool_choice`/`usage` access if the installed SDK version differs.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the `as any` on the tool is acceptable; SDK tool typings are strict).

- [ ] **Step 3: Commit**

```bash
git add src/lib/practice/generate/ai.ts
git commit -m "feat(generate): Anthropic forced-tool plan call"
```

---

## Phase 4 — Server actions

### Task 12: Skill resolver (pure, TDD)

**Files:**
- Create: `src/lib/practice/generate/resolve-skills.ts`
- Test: `src/lib/practice/generate/__tests__/actions-validation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/practice/generate/__tests__/actions-validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveTargetSkills } from "../resolve-skills";
import type { TargetSkill } from "../types";

const focus: TargetSkill[] = [
  { skillId: "a", skillName: "A", skillGroup: "athletic", avgScore: 0.2 },
  { skillId: "b", skillName: "B", skillGroup: "defense", avgScore: 0.3 },
  { skillId: "c", skillName: "C", skillGroup: "qb", avgScore: 0.4 },
];

describe("resolveTargetSkills", () => {
  it("uses explicit selection when present, preserving order", () => {
    expect(resolveTargetSkills(["c", "a"], focus).map((s) => s.skillId)).toEqual(["c", "a"]);
  });
  it("falls back to team weaknesses when selection empty (capped at 3)", () => {
    expect(resolveTargetSkills([], focus).map((s) => s.skillId)).toEqual(["a", "b", "c"]);
  });
  it("ignores selected ids not in the focus set", () => {
    expect(resolveTargetSkills(["zzz", "b"], focus).map((s) => s.skillId)).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/lib/practice/generate/__tests__/actions-validation.test.ts`

- [ ] **Step 3: Implement `resolve-skills.ts`**

Create `src/lib/practice/generate/resolve-skills.ts`:
```ts
import type { TargetSkill } from "./types";

const MAX_AUTO = 3;

/** PURE: explicit ids win (in order); else top team weaknesses. */
export function resolveTargetSkills(selectedIds: string[], teamFocus: TargetSkill[]): TargetSkill[] {
  const byId = new Map(teamFocus.map((s) => [s.skillId, s]));
  if (selectedIds.length) return selectedIds.map((id) => byId.get(id)).filter(Boolean) as TargetSkill[];
  return teamFocus.slice(0, MAX_AUTO);
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/lib/practice/generate/__tests__/actions-validation.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/practice/generate/resolve-skills.ts src/lib/practice/generate/__tests__/actions-validation.test.ts
git commit -m "feat(generate): skill resolver + test"
```

### Task 13: Server actions (`actions.ts`)

**Files:**
- Create: `src/lib/practice/generate/actions.ts`

> **Verify-at-build (do these greps first):**
> - `grep -rn "export async function createPlanDraft\|export async function savePlan\|export type SavePlanPayload" src/lib/practice/actions.ts` — confirm names + that `createPlanDraft` returns a `string` id (adjust if it returns `{id}`).
> - `grep -rn "export async function loadTeamFocus" src/lib/dashboard/team-home-data.ts` and confirm `FocusSkill` fields (`skillId`,`skillName`,`skillGroup`,`avgScore`).
> - `grep -rn "memberCanManage" src | head` — add the same gate the practice editor page uses (membership lookup + `memberCanManage(role, captain_view_only) || isLeagueAdmin`).
> - `grep -rn "create table.*drill_categories" qb_supabase_full_package/sql` — confirm `name` column for category lookup in `adoptGapDrill`.

- [ ] **Step 1: Implement the actions**

Create `src/lib/practice/generate/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadTeamFocus } from "@/lib/dashboard/team-home-data";
import { savePlan, createPlanDraft, type SavePlanPayload } from "@/lib/practice/actions";
import { buildSkeleton } from "./skeleton";
import { assembleBlockCandidates, fetchCandidatesBySkill } from "./candidates";
import { callPlanModel } from "./ai";
import { buildFallbackPlan } from "./fallback";
import { resolveTargetSkills } from "./resolve-skills";
import type { BlockCandidates, GenerateInput, GeneratedPlan, Skeleton, TargetSkill } from "./types";

export type GenerateResult =
  | { ok: true; generationId: string; skeleton: Skeleton; blockCandidates: BlockCandidates[]; generated: GeneratedPlan }
  | { ok: false; error: string };

async function teamFocusSkills(supabase: any, teamId: string): Promise<TargetSkill[]> {
  const focus = await loadTeamFocus(supabase, teamId);
  return focus.skills.map((s: any) => ({
    skillId: s.skillId, skillName: s.skillName, skillGroup: s.skillGroup, avgScore: s.avgScore,
  }));
}

export async function generatePlan(input: {
  teamId: string; totalMinutes: number; format: "5v5" | "7v7"; skillIds: string[];
}): Promise<GenerateResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const focus = await teamFocusSkills(supabase, input.teamId);
  const skills = resolveTargetSkills(input.skillIds, focus);
  if (skills.length === 0) return { ok: false, error: "no_skills" };

  const genInput: GenerateInput = {
    teamId: input.teamId, totalMinutes: input.totalMinutes, format: input.format, skills,
  };
  const skeleton = buildSkeleton(genInput);

  const candidatesBySkill = await fetchCandidatesBySkill(supabase, input.teamId, skills.map((s) => s.skillId));
  const nowISO = new Date().toISOString();
  const blockCandidates = skeleton.blocks.map((b) => assembleBlockCandidates(b, candidatesBySkill, nowISO));

  let generated: GeneratedPlan; let model: string | null = null;
  let inputTokens: number | null = null; let outputTokens: number | null = null;
  try {
    const r = await callPlanModel({ skeleton, blockCandidates, skills, format: input.format });
    generated = r.plan; model = r.model; inputTokens = r.inputTokens; outputTokens = r.outputTokens;
  } catch {
    generated = buildFallbackPlan(skeleton, blockCandidates);
  }

  const { data: logRow, error: logErr } = await supabase
    .from("ai_plan_generations")
    .insert({
      team_id: input.teamId, created_by: user.id,
      input_json: { totalMinutes: input.totalMinutes, format: input.format, skillIds: skills.map((s) => s.skillId) },
      output_json: { skeleton, generated }, model, input_tokens: inputTokens,
      output_tokens: outputTokens, used_fallback: generated.usedFallback,
    })
    .select("id").single();
  if (logErr) return { ok: false, error: logErr.message };

  return { ok: true, generationId: logRow.id, skeleton, blockCandidates, generated };
}

export async function regenerateBlock(args: {
  teamId: string; generationId: string; blockKey: string; excludeDrillIds: string[];
}): Promise<{ ok: true; block: GeneratedPlan["blocks"][number] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: gen, error } = await supabase
    .from("ai_plan_generations").select("output_json, input_json").eq("id", args.generationId).single();
  if (error || !gen) return { ok: false, error: "generation_not_found" };

  const skeleton: Skeleton = gen.output_json.skeleton;
  const block = skeleton.blocks.find((b) => b.key === args.blockKey);
  if (!block) return { ok: false, error: "block_not_found" };

  const focus = await teamFocusSkills(supabase, args.teamId);
  const skills = resolveTargetSkills(gen.input_json.skillIds ?? [], focus).filter((s) => block.skillIds.includes(s.skillId));
  const candidatesBySkill = await fetchCandidatesBySkill(supabase, args.teamId, block.skillIds);
  const blockCandidates = [assembleBlockCandidates(block, candidatesBySkill, new Date().toISOString())];

  const emptyBlock = { blockKey: args.blockKey, rationale: "", drills: [], gapProposals: [] };
  try {
    const r = await callPlanModel({
      skeleton: { ...skeleton, blocks: [block] }, blockCandidates, skills,
      format: gen.input_json.format ?? "7v7", excludeDrillIds: args.excludeDrillIds,
    });
    return { ok: true, block: r.plan.blocks.find((b) => b.blockKey === args.blockKey) ?? emptyBlock };
  } catch {
    const fb = buildFallbackPlan({ ...skeleton, blocks: [block] }, blockCandidates);
    return { ok: true, block: fb.blocks[0] ?? emptyBlock };
  }
}

export async function adoptGapDrill(args: {
  teamId: string; name: string; description: string; category: string; phaseSkillIds: string[];
}): Promise<{ ok: true; drillId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: cat } = await supabase.from("drill_categories").select("id").eq("name", args.category).maybeSingle();
  const { data: drill, error } = await supabase
    .from("team_drills")
    .insert({
      team_id: args.teamId, created_by: user.id, drill_name: args.name,
      description: args.description, category_id: cat?.id ?? null, status: "draft", source: "ai",
    })
    .select("id").single();
  if (error || !drill) return { ok: false, error: error?.message ?? "insert_failed" };

  if (args.phaseSkillIds.length) {
    await supabase.from("drill_skills").insert(
      args.phaseSkillIds.map((skill_id) => ({ drill_id: drill.id, skill_id, weight: 1 })),
    );
  }
  revalidatePath(`/dashboard/team/${args.teamId}/drills`);
  return { ok: true, drillId: drill.id };
}

export async function createPlanFromGeneration(args: {
  teamId: string; generationId: string; payload: Omit<SavePlanPayload, "plan_id">;
}): Promise<{ ok: true; planId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const planId = await createPlanDraft(args.teamId);
  const saved = await savePlan({ ...args.payload, plan_id: planId }, args.teamId);
  if (!saved.ok) return { ok: false, error: saved.error };

  await supabase.from("practice_plans").update({ origin: "ai" }).eq("id", planId);
  await supabase.from("ai_plan_generations").update({ accepted: true, practice_plan_id: planId }).eq("id", args.generationId);

  revalidatePath(`/dashboard/team/${args.teamId}/practice`);
  return { ok: true, planId };
}

export async function recordGenerationFeedback(args: {
  generationId: string; feedback: -1 | 1;
}): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_plan_generations").update({ user_feedback: args.feedback }).eq("id", args.generationId);
  return { ok: !error };
}
```

- [ ] **Step 2: Typecheck + full test run**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all engine tests pass. (If `createPlanDraft` returns `{ id }`, change to `const { id: planId } = await createPlanDraft(...)`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/practice/generate/actions.ts
git commit -m "feat(generate): server actions (generate/regenerate/adopt/accept/feedback)"
```

---

## Phase 5 — UI (via /frontend-design)

> These tasks produce UI. **Invoke `/frontend-design`** for the visual implementation, passing the UFF design system (dark `surface-base`, orange CTAs, `globals.css` tokens, two font weights — 400/500 only) and the exact data contracts below. Wire components to the Phase-4 actions. Verify in-browser (screenshot loop), not with unit tests.

### Task 14: View-model types + Generate route

**Files:**
- Create: `src/components/practice/generate/generate-view-types.ts`
- Create: `src/app/(workspace)/dashboard/team/[teamId]/practice/generate/page.tsx`

- [ ] **Step 1: Define the view-model**

Create `src/components/practice/generate/generate-view-types.ts`:
```ts
import type { BlockCandidates, GeneratedPlan, Skeleton, TargetSkill } from "@/lib/practice/generate/types";

export type GeneratePageData = {
  teamId: string;
  defaultMinutes: number;        // last practice length or 90
  defaultFormat: "5v5" | "7v7";
  availableSkills: TargetSkill[]; // from team scouting focus (selectable)
};

export type PreviewState = {
  generationId: string;
  skeleton: Skeleton;
  blockCandidates: BlockCandidates[];
  generated: GeneratedPlan;
};
```

- [ ] **Step 2: Create the server page** (stub `GenerateClient` so it compiles)

Create `src/app/(workspace)/dashboard/team/[teamId]/practice/generate/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { loadTeamFocus } from "@/lib/dashboard/team-home-data";
import GenerateClient from "@/components/practice/generate/GenerateClient";

export default async function GeneratePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const supabase = await createClient();
  const focus = await loadTeamFocus(supabase, teamId);

  return (
    <GenerateClient
      data={{
        teamId,
        defaultMinutes: 90, // refine from last plan start/end at build time
        defaultFormat: "7v7",
        availableSkills: focus.skills.map((s: any) => ({
          skillId: s.skillId, skillName: s.skillName, skillGroup: s.skillGroup, avgScore: s.avgScore,
        })),
      }}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/practice/generate/generate-view-types.ts "src/app/(workspace)/dashboard/team/[teamId]/practice/generate/page.tsx"
git commit -m "feat(generate): view-model types + generate route"
```

### Task 15: `GenerateDialog` + `GenerateClient` — /frontend-design

**Files:**
- Create: `src/components/practice/generate/GenerateDialog.tsx`
- Create: `src/components/practice/generate/GenerateClient.tsx`

**Contract:** `GenerateClient` holds state: shows `GenerateDialog` until a `PreviewState` exists, then `<PreviewClient/>`. `GenerateDialog` renders a time stepper (default `defaultMinutes`), a `5v5`/`7v7` toggle, and a skill multi-select from `availableSkills` — each row = `skillName` + a grade chip from `avgScore` (reuse `scoreToGrade` from `@/lib/scouting/player-grade`). "Generate" calls `generatePlan({teamId, totalMinutes, format, skillIds})` with a loading state; on `ok` sets `PreviewState`. Empty `availableSkills` → empty state linking to `/dashboard/team/<id>/benchmarks`.

- [ ] **Step 1:** Invoke `/frontend-design` to build `GenerateDialog` + `GenerateClient` against the contract + UFF tokens.
- [ ] **Step 2:** Wire "Generate" → `generatePlan`; store `PreviewState`; render `PreviewClient`.
- [ ] **Step 3:** Verify in-browser at `/dashboard/team/<id>/practice/generate`: defaults populate, skills list with grades, Generate returns a preview (fallback plan if no API key).
- [ ] **Step 4: Commit**

```bash
git add src/components/practice/generate/GenerateDialog.tsx src/components/practice/generate/GenerateClient.tsx
git commit -m "feat(generate): GenerateDialog + client shell"
```

### Task 16: `PreviewClient` (per-block control) — /frontend-design

**Files:**
- Create: `src/components/practice/generate/PreviewClient.tsx`

**Contract — renders `PreviewState`:**
- Header: total vs budget, format, targeted-skill chips.
- Per block (`skeleton.blocks`): name, `targetMinutes`, matching `generated` block `rationale`, drills (name from `blockCandidates`, cue, category).
  - **↻ Regenerate block** → `regenerateBlock({teamId, generationId, blockKey, excludeDrillIds: currentDrillIds})`; replace that block in local state.
  - **Swap drill** → local picker over that block's `blockCandidates.candidates` not already chosen (NO server call).
  - **Reject drill** → remove from local state.
- **Gap block** (`generated` block `gapProposals`): show proposal + a skill/phase picker (skills in that block's `gapSkillIds`); **"Add to library & include"** → `adoptGapDrill(...)`, then insert returned `drillId` into the block; **"Skip"**.
- Footer: **Accept** → `toSavePayload({planId:"", title, practiceDate, skeleton, generated})` (omit `plan_id`; coach picks date, default next Sunday) → `createPlanFromGeneration({teamId, generationId, payload})` → route to `/dashboard/team/<id>/practice/<planId>/edit`. **Regenerate all** → back to dialog. **Discard** → leave. 👍/👎 → `recordGenerationFeedback`.

- [ ] **Step 1:** Invoke `/frontend-design` to build `PreviewClient` against the contract + UFF tokens.
- [ ] **Step 2:** Wire `regenerateBlock`, `adoptGapDrill`, `createPlanFromGeneration`, `recordGenerationFeedback` + local swap/reject state. Build the `SavePlanPayload` for accept by calling `toSavePayload` then stripping `plan_id` into the `Omit<SavePlanPayload,"plan_id">` the action expects.
- [ ] **Step 3:** Verify in-browser: regenerate one block leaves others intact; swap is instant; gap adoption creates a draft drill and slots it; Accept opens the editor with the generated plan; thumbs persist.
- [ ] **Step 4: Commit**

```bash
git add src/components/practice/generate/PreviewClient.tsx
git commit -m "feat(generate): per-block preview + accept flow"
```

---

## Phase 6 — Entry points

### Task 17: Practice list "Generate with AI"

**Files:**
- Modify: `src/app/(workspace)/dashboard/team/[teamId]/practice/page.tsx` (and its list client if the CTA lives there)

- [ ] **Step 1:** Add a secondary "Generate with AI" button beside the existing "New plan" CTA, linking to `/dashboard/team/${teamId}/practice/generate`. Match existing button styling (find the current "New plan" link first: `grep -rn "practice/new\|New plan" src/app/\(workspace\)/dashboard/team/\[teamId\]/practice`).
- [ ] **Step 2:** Verify in-browser the button appears + routes.
- [ ] **Step 3: Commit**

```bash
git add "src/app/(workspace)/dashboard/team/[teamId]/practice/page.tsx"
git commit -m "feat(generate): practice-list entry point"
```

### Task 18: Team dashboard "Plan this week" quick action

**Files:**
- Modify: `src/app/(workspace)/dashboard/team/[teamId]/page.tsx`

- [ ] **Step 1:** Add a quick-action linking to `/dashboard/team/${teamId}/practice/generate` near the Next-Practice card. Reuse the dashboard's existing quick-action/CTA component (`grep -rn "quick" src/components/dashboard | head`).
- [ ] **Step 2:** Verify in-browser.
- [ ] **Step 3: Commit**

```bash
git add "src/app/(workspace)/dashboard/team/[teamId]/page.tsx"
git commit -m "feat(generate): dashboard quick action"
```

### Task 19: Editor "AI fill"

**Files:**
- Modify: `src/components/practice/EditorClient.tsx`
- Create: `src/lib/practice/generate/to-editor.ts` (+ test)

**Why a helper:** the editor holds `PlanBlock[]`/`PlanDrill[]` (with `id` client ids, `benchmark_types`, `category_name`, etc.), not `SavePlanPayload`. Map generated output → editor types in a pure, tested function rather than inline.

- [ ] **Step 1: Write the failing test**

Create `src/lib/practice/generate/__tests__/to-editor.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toEditorBlocks } from "../to-editor";
import type { BlockCandidates, GeneratedPlan, Skeleton } from "../types";

const skeleton: Skeleton = {
  totalMinutes: 60, mergedSkillCount: 0,
  blocks: [{ key: "skill-1", name: "Zone", kind: "skill", skillIds: ["zone"], targetMinutes: 40 }],
};
const blockCandidates: BlockCandidates[] = [{ blockKey: "skill-1", gapSkillIds: [], candidates: [
  { drillId: "d1", drillName: "Zone Drop", categoryName: "defense", benchmarkTypes: ["rated"], defaultDurationMin: 10, skillWeight: 1, drillScore: 0.3, lastRunISO: null },
] }];
const generated: GeneratedPlan = { usedFallback: false, blocks: [
  { blockKey: "skill-1", rationale: "r", gapProposals: [], drills: [{ drillId: "d1", coachingCue: "Eyes up" }] },
] };

describe("toEditorBlocks", () => {
  it("maps to PlanBlock[] with resolved drill names + ids", () => {
    const blocks = toEditorBlocks(skeleton, generated, blockCandidates, (i) => `cid-${i}`);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe("Zone");
    expect(blocks[0].drills[0].drill_id).toBe("d1");
    expect(blocks[0].drills[0].drill_name).toBe("Zone Drop");
    expect(blocks[0].drills[0].notes).toBe("Eyes up");
    expect(blocks[0].drills[0].category_name).toBe("defense");
    expect(blocks[0].drills[0].benchmark_types).toEqual(["rated"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/lib/practice/generate/__tests__/to-editor.test.ts`

- [ ] **Step 3: Implement `to-editor.ts`**

Create `src/lib/practice/generate/to-editor.ts`:
```ts
import type { PlanBlock, PlanDrill } from "@/lib/practice/plan-data";
import type { BlockCandidates, GeneratedPlan, Skeleton } from "./types";

/** PURE: map generated output -> editor PlanBlock[]. `mkId(n)` supplies client-side ids. */
export function toEditorBlocks(
  skeleton: Skeleton, generated: GeneratedPlan, blockCandidates: BlockCandidates[], mkId: (n: number) => string,
): PlanBlock[] {
  const genByKey = new Map(generated.blocks.map((b) => [b.blockKey, b]));
  const candByKey = new Map(blockCandidates.map((b) => [b.blockKey, b]));
  let counter = 0;

  return skeleton.blocks.map((b, blockIndex) => {
    const gen = genByKey.get(b.key);
    const cands = candByKey.get(b.key)?.candidates ?? [];
    const genDrills = gen?.drills ?? [];
    const per = genDrills.length ? Math.max(1, Math.floor(b.targetMinutes / genDrills.length)) : 0;

    const drills: PlanDrill[] = genDrills.map((d, i) => {
      const c = cands.find((x) => x.drillId === d.drillId);
      return {
        id: mkId(counter++),
        drill_id: d.drillId,
        drill_name: c?.drillName ?? null,
        drill_order: i,
        duration_minutes: per,
        reps_count: null,
        notes: d.coachingCue || null,
        parallel_group: null,
        is_water_break: false,
        benchmark_types: c?.benchmarkTypes ?? [],
        category_name: c?.categoryName ?? null,
        description: null,
        log_note: null,
      };
    });

    return {
      id: mkId(counter++),
      name: b.name,
      block_order: blockIndex,
      target_minutes: b.targetMinutes,
      template_id: null,
      drills,
    };
  });
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/lib/practice/generate/__tests__/to-editor.test.ts`

- [ ] **Step 5:** In `EditorClient.tsx`, add an "AI fill" toolbar action opening `GenerateDialog` in a modal; on its `PreviewState`/accept, call `toEditorBlocks(skeleton, generated, blockCandidates, mkId)` (use the editor's existing client-id generator — `grep -rn "crypto.randomUUID\|nanoid\|makeId" src/components/practice/EditorClient.tsx`) and set the editor's block state. Existing save flow handles persistence.
- [ ] **Step 6:** Verify in-browser: "AI fill" on an empty plan populates blocks/drills; existing save works.
- [ ] **Step 7: Commit**

```bash
git add src/lib/practice/generate/to-editor.ts src/lib/practice/generate/__tests__/to-editor.test.ts src/components/practice/EditorClient.tsx
git commit -m "feat(generate): in-editor AI fill + editor mapping helper"
```

---

## Phase 7 — Finalize

### Task 20: Full verification + docs

- [ ] **Step 1:** `npx tsc --noEmit && npm test && npm run lint` — all clean.
- [ ] **Step 2:** Manual end-to-end in-browser for each of the 3 entry points → generate → per-block edits (regenerate/swap/reject) → gap adoption → accept → plan opens in editor → save → appears on practice list → feeds dashboard cadence/drill-mix.
- [ ] **Step 3:** Confirm the user ran migration 102 in Supabase (engine fails soft without it, but `ai_plan_generations` inserts error until applied).
- [ ] **Step 4:** Add "Web Build 12 — AI Practice Plan Generator" to `unlock-web/CLAUDE.md` Build status and the root `CLAUDE.md` Build Status.
- [ ] **Step 5: Commit**

```bash
git add unlock-web/CLAUDE.md CLAUDE.md
git commit -m "docs: record Web Build 12 — AI practice plan generator"
```

---

## Self-Review (completed during authoring)

**Spec coverage:** §2 control model → Tasks 12/15. Output landing → Task 16 + `createPlanFromGeneration`. Drill source / gap flags → `adoptGapDrill` (T13) + gap UI (T16). Entry points → Tasks 17–19. Hybrid architecture → Tasks 5–13. Persistence → Task 3 + `createPlanFromGeneration`. Feedback → `recordGenerationFeedback` (T13) + 👍/👎 (T16). Failure mode → `fallback.ts` (T9) + try/catch (T13). §4 engine → Tasks 5–13. §5 data model → Task 3. §6 structured output → Task 8. §7 preview → Task 16. §8 files → all New paths match. §9 errors → fallback (T9/T13), empty-library/no-scouting empty states (T15), gap (T16), invalid drill id (T8). §10 out-of-scope respected (no auto-schedule, no diagrams, no mobile, no billing). §11 verify-at-build → inline callouts in Tasks 3, 7, 11, 13, 14.

**Placeholder scan:** every code step has complete code; no TBD/TODO. Visual specifics in Tasks 15–16 are intentionally delegated to `/frontend-design` with explicit data contracts (not placeholders).

**Type consistency:** `GeneratedPlan`/`GeneratedBlock`/`BlockCandidates`/`Skeleton`/`TargetSkill`/`CandidateDrill` defined once in `types.ts`; `SavePlanPayload`/`SaveBlockInput`/`SaveDrillInput` imported from `@/lib/practice/actions`; `PlanBlock`/`PlanDrill` imported from `@/lib/practice/plan-data`. Function names consistent across tasks: `buildSkeleton`, `assembleBlockCandidates`, `fetchCandidatesBySkill`, `fetchDrillScores`, `recentlyRunDrills`, `validatePlanOutput`, `buildPlanToolSchema`, `buildFallbackPlan`, `toSavePayload`, `toEditorBlocks`, `resolveTargetSkills`, `callPlanModel`, and the 5 server actions.

**Known build-time unknowns (flagged inline, not placeholders):** exact `drill_skills`/`v_player_drill_score`/`drill_categories` column names, `createPlanDraft` return shape, `loadTeamFocus` field names, current Claude `MODEL_ID`, the editor's client-id generator, and the `memberCanManage` membership lookup — each has a `grep`/verify step at its task.
