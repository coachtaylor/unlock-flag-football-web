# AI Drill Drafter (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Pro coaches paste a drill video link (or upload a file) and have AI draft a source-credited drill (description, coaching cues, equipment, phase + skills) that the coach reviews in the existing drill form and publishes.

**Architecture:** Async job table (`ai_drill_jobs`) + Supabase Realtime status. A server action validates Pro/dedupe/cap, inserts a `queued` job, and invokes a Supabase Edge Function that runs the extract → AI-draft → validate pipeline and writes the draft JSON back to the job row. The client watches the row and, on `ready`, seeds the existing `DrillForm` (materialize-on-save: the `team_drills` row is only created when the coach saves).

**Tech Stack:** Next.js App Router (TS), `@supabase/ssr` + `supabase-js`, Supabase Postgres + RLS + Edge Functions (Deno), Anthropic API via `fetch`, Vitest (added here) for pure-logic unit tests.

**Spec:** `unlock-web/docs/2026-06-07-ai-drill-drafter-design.md`

---

## Scope & decomposition

This plan covers the **web + DB + worker vertical slice** — a complete, shippable feature for web users. Two pieces are **deliberately separate follow-on plans**, not part of this one:

- **Mobile parity** (`unlock-mobile`) — a follow-on plan after the web slice is proven.
- **AI diagram generation** — Phase 2 fast-follow (spec §10). **Do not build it here.**

## Grounded codebase facts (verified 2026-06-07)

- **Migrations:** `qb_supabase_full_package/sql/`, naming `NN_snake_name.sql`. Highest existing = `101`. **New migrations start at `102`.**
- **`team_drills`** (`qb_supabase_full_package/sql/06_coach_team_management.sql:113`): columns `id`, `team_id`, `created_by`(→`auth.users`), `drill_name`, `category_id`(NOT NULL →`drill_categories`), `description`, `source_url` (**exists**), `benchmark_type`, `setup_diagram` jsonb, `setup_instructions`, `equipment` jsonb (`{"cones":N,"other":[...]}`), `status` (`draft`|`published`, `archived` added in mig 90), `created_at`, `updated_at`. **No `coaching_cues`**, **no `source`/`source_platform`/`source_author`**.
- **Phase:** `team_drills.phase` text column (added in the mig-70 range). **Required to save** (enforced in form logic).
- **Skills:** join table `public.drill_skills(drill_id, skill_id)` (`qb_supabase_full_package/sql/66_skill_taxonomy_schema.sql:109`). Phase→skill scoping helper on the web: `src/lib/drills/skill-groups.ts` (`allowedSkillGroupsForPhases`).
- **RLS helpers:** `public.get_my_team_ids()` and `public.get_my_writable_team_ids()` are **SETOF** — always `team_id in (select get_my_*_ids())`, never `= ANY(...)`.
- **Activity:** `activity_events` written by DB triggers (`76_activity_event_triggers.sql`); a `team_drills` insert already logs an event. Actor resolved via `profiles`.
- **Web supabase clients:** server = `@/lib/supabase/server` (`createClient()` async), browser = `@/lib/supabase/client` (exported const `supabase`).
- **Drill form:** `src/app/(workspace)/dashboard/team/[teamId]/drills/DrillForm.tsx` — large client component, `save(targetStatus)` at ~line 453 writes `team_drills` + `drill_skills` via the **browser** client. Uses `SkillPicker`, phase state, `SetupDiagramSection`, `generateSetupInstructions`.
- **Drill routes:** list `…/drills/page.tsx` + `DrillsLibraryClient.tsx`; detail `…/drills/[id]/page.tsx`; edit `…/drills/[id]/edit/page.tsx`; preset actions `…/drills/library/actions.ts`; lifecycle `src/lib/drills/lifecycle-actions.ts`.
- **Access helper:** `src/lib/team/staff-roles.ts` (`memberCanManage`).
- **No test runner** (only `dev`/`build`/`lint`). **No `supabase/functions/`** dir.

---

## File structure (created / modified)

**Created**
- `qb_supabase_full_package/sql/102_ai_drill_jobs.sql` — job table + RLS + indexes.
- `qb_supabase_full_package/sql/103_team_drills_ai_columns.sql` — `team_drills` AI/credit/cues columns + `teams.plan`.
- `qb_supabase_full_package/sql/104_ai_drill_jobs_reaper.sql` — pg_cron stale-job reaper.
- `qb_supabase_full_package/sql/105_ai_drill_taxonomy_rpc.sql` — taxonomy RPC for the tool schema.
- `unlock-web/supabase/functions/draft-drill/index.ts` — Edge Function entrypoint (pipeline).
- `unlock-web/supabase/functions/draft-drill/extract.ts` — media→transcript/frames adapter (YouTube native + vendor seam).
- `unlock-web/supabase/functions/draft-drill/draft.ts` — Anthropic structured-output call + tag validation.
- `unlock-web/supabase/functions/_shared/platform.ts` — pure URL→platform resolver (Deno copy).
- `unlock-web/src/lib/ai-drill/platform.ts` — same resolver for web (single source; see Task 4).
- `unlock-web/src/lib/ai-drill/actions.ts` — `requestDrillDraft`, `retryDrillJob`, `setDrillJobFeedback` server actions.
- `unlock-web/src/lib/ai-drill/dedupe.ts` — pure dedupe-key + fair-use helpers (unit-tested).
- `unlock-web/src/lib/ai-drill/types.ts` — shared TS types for job + draft payload.
- `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/paste/PasteLinkClient.tsx` — paste-a-link card + live status.
- `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/paste/page.tsx` — route for the paste flow.
- `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/from-link/[jobId]/page.tsx` — loads job draft, renders seeded `DrillForm`.
- `unlock-web/vitest.config.ts`, `unlock-web/src/lib/ai-drill/__tests__/*.test.ts` — test infra + unit tests.

**Modified**
- `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/DrillForm.tsx` — accept optional `initialDraft` + `aiJobId`; write `source`, `source_platform`, `source_author`, `coaching_cues` on save.
- `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/DrillsLibraryClient.tsx` — "Add a drill" now offers **Paste a link** vs **Build by hand**.
- `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/[id]/page.tsx` — render "VIA {platform} · {author}" credit + coaching-cues bullets.
- `unlock-web/package.json` — add `vitest`, `test` script.

---

## Phase A — Database & RLS

### Task 1: `teams.plan` + `team_drills` AI/credit/cues columns

**Files:**
- Create: `qb_supabase_full_package/sql/103_team_drills_ai_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 103_team_drills_ai_columns.sql
-- Pro entitlement flag (per team) + AI-drafter provenance, source credit,
-- and first-class coaching_cues (so manual + AI drills render cues identically).

begin;

-- Entitlement (per team). Manual flip for MVP; Stripe sets it later.
alter table public.teams
  add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro'));

-- Provenance + visible source credit.
alter table public.team_drills
  add column if not exists source text not null default 'manual'
  check (source in ('manual', 'ai'));
alter table public.team_drills
  add column if not exists source_platform text;   -- youtube|tiktok|instagram|upload
alter table public.team_drills
  add column if not exists source_author text;      -- '@handle' / channel name

-- Coaching cues as a first-class array (was previously folded into description).
alter table public.team_drills
  add column if not exists coaching_cues text[] not null default '{}';

commit;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use the Supabase MCP `apply_migration` (name: `team_drills_ai_columns`) against project `cclkmoczomakkxfvavkw`, OR run the SQL in the Supabase SQL editor. Expected: success, no errors.

- [ ] **Step 3: Verify columns exist**

```sql
select column_name from information_schema.columns
where table_name='team_drills'
  and column_name in ('source','source_platform','source_author','coaching_cues');
```
Expected: 4 rows.

- [ ] **Step 4: Commit**

```bash
cd /Users/taylorpangilinan/Downloads/qb_supabase_database
git add qb_supabase_full_package/sql/103_team_drills_ai_columns.sql
git commit -m "feat(db): teams.plan + team_drills AI/credit/coaching_cues columns (Build 11)"
```

---

### Task 2: `ai_drill_jobs` table + RLS

**Files:**
- Create: `qb_supabase_full_package/sql/102_ai_drill_jobs.sql`

> Numbered 102 but depends on nothing in 103; either order works (neither references the other's new objects).

- [ ] **Step 1: Write the migration**

```sql
-- 102_ai_drill_jobs.sql
-- Async job queue + provenance + draft payload + feedback for the AI drill drafter.
-- Materialize-on-save: draft lives here as JSON; a team_drills row is only created
-- when the coach saves in the form.

begin;

create table if not exists public.ai_drill_jobs (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams(id) on delete cascade,
  created_by     uuid not null references auth.users(id),
  source_kind    text not null check (source_kind in ('youtube','tiktok','instagram','upload','other')),
  source_url     text,
  storage_path   text,
  status         text not null default 'queued'
    check (status in ('queued','extracting','drafting','ready','no_signal','failed')),
  draft_json     jsonb,
  drill_id       uuid references public.team_drills(id) on delete set null,
  raw_transcript text,
  raw_ocr        text,
  signal_sources text[] not null default '{}',
  model          text,
  input_tokens   int,
  output_tokens  int,
  cost_usd       numeric(8,4),
  field_confidence jsonb,
  user_feedback  smallint check (user_feedback in (-1, 1)),
  error_detail   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  finished_at    timestamptz,
  constraint ai_drill_jobs_source_present
    check (source_url is not null or storage_path is not null)
);

create index if not exists idx_ai_drill_jobs_team_created
  on public.ai_drill_jobs (team_id, created_at desc);
create index if not exists idx_ai_drill_jobs_status
  on public.ai_drill_jobs (status) where status in ('queued','extracting','drafting');
create index if not exists idx_ai_drill_jobs_team_url
  on public.ai_drill_jobs (team_id, source_url);

drop trigger if exists trg_ai_drill_jobs_updated_at on public.ai_drill_jobs;
create trigger trg_ai_drill_jobs_updated_at
  before update on public.ai_drill_jobs
  for each row execute function public.set_updated_at();

alter table public.ai_drill_jobs enable row level security;

-- READ: any member of the team.
drop policy if exists ai_drill_jobs_select on public.ai_drill_jobs;
create policy ai_drill_jobs_select on public.ai_drill_jobs
  for select using (team_id in (select public.get_my_team_ids()));

-- INSERT: writable members of a PRO team, inserting as themselves.
drop policy if exists ai_drill_jobs_insert on public.ai_drill_jobs;
create policy ai_drill_jobs_insert on public.ai_drill_jobs
  for insert with check (
    created_by = auth.uid()
    and team_id in (select public.get_my_writable_team_ids())
    and exists (select 1 from public.teams t where t.id = team_id and t.plan = 'pro')
  );

-- UPDATE: writable members (feedback/retry). The Edge Function uses the
-- service-role key and bypasses RLS for its status writes.
drop policy if exists ai_drill_jobs_update on public.ai_drill_jobs;
create policy ai_drill_jobs_update on public.ai_drill_jobs
  for update using (team_id in (select public.get_my_writable_team_ids()));

commit;
```

- [ ] **Step 2: Apply** via Supabase MCP `apply_migration` (name `ai_drill_jobs`). Expected: success.

- [ ] **Step 3: Verify RLS + policies**

```sql
select relrowsecurity from pg_class where relname = 'ai_drill_jobs';   -- expect: t
select count(*) from pg_policies where tablename = 'ai_drill_jobs';    -- expect: 3
```

- [ ] **Step 4: Enable Realtime on the table**

Dashboard → Database → Replication → add `public.ai_drill_jobs` to the `supabase_realtime` publication. Verify:
```sql
select 1 from pg_publication_tables
where pubname='supabase_realtime' and tablename='ai_drill_jobs';   -- expect: 1 row
```

- [ ] **Step 5: Commit**

```bash
git add qb_supabase_full_package/sql/102_ai_drill_jobs.sql
git commit -m "feat(db): ai_drill_jobs queue table + RLS + realtime (Build 11)"
```

---

### Task 3: Stale-job reaper (pg_cron)

**Files:**
- Create: `qb_supabase_full_package/sql/104_ai_drill_jobs_reaper.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 104_ai_drill_jobs_reaper.sql
-- Mark jobs stuck in a non-terminal state for >10 min as failed, so a dead
-- worker never leaves an infinite spinner.

begin;

create or replace function public.reap_stale_ai_drill_jobs()
returns void language sql security definer set search_path = public as $$
  update public.ai_drill_jobs
  set status = 'failed',
      error_detail = coalesce(error_detail, 'Timed out — worker did not finish.'),
      finished_at = now()
  where status in ('queued','extracting','drafting')
    and updated_at < now() - interval '10 minutes';
$$;

commit;

-- Schedule every 5 minutes (pg_cron). Run after pg_cron is enabled.
select cron.schedule(
  'reap-stale-ai-drill-jobs',
  '*/5 * * * *',
  $$select public.reap_stale_ai_drill_jobs();$$
);
```

- [ ] **Step 2: Ensure pg_cron is enabled** — MCP `list_extensions`; if absent, enable via Dashboard → Database → Extensions → `pg_cron`, then run the `cron.schedule(...)` statement.

- [ ] **Step 3: Verify**

```sql
select jobname, schedule from cron.job where jobname = 'reap-stale-ai-drill-jobs';  -- expect 1 row
```

- [ ] **Step 4: Commit**

```bash
git add qb_supabase_full_package/sql/104_ai_drill_jobs_reaper.sql
git commit -m "feat(db): pg_cron reaper for stale ai_drill_jobs (Build 11)"
```

---

## Phase B — Pure logic + test infra (TDD)

### Task 4: Test runner + platform resolver

**Files:**
- Modify: `unlock-web/package.json`
- Create: `unlock-web/vitest.config.ts`
- Create: `unlock-web/src/lib/ai-drill/platform.ts`
- Test: `unlock-web/src/lib/ai-drill/__tests__/platform.test.ts`

- [ ] **Step 1: Add Vitest**

```bash
cd /Users/taylorpangilinan/Downloads/qb_supabase_database/unlock-web
npm install -D vitest@^2
```

- [ ] **Step 2: Add the test script** — edit `package.json` `"scripts"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 4: Write the failing test** — `src/lib/ai-drill/__tests__/platform.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { resolvePlatform } from "../platform";

describe("resolvePlatform", () => {
  it("detects youtube watch + short + youtu.be", () => {
    expect(resolvePlatform("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(resolvePlatform("https://youtu.be/abc")).toBe("youtube");
    expect(resolvePlatform("https://youtube.com/shorts/abc")).toBe("youtube");
  });
  it("detects tiktok", () => {
    expect(resolvePlatform("https://www.tiktok.com/@coach/video/123")).toBe("tiktok");
    expect(resolvePlatform("https://vm.tiktok.com/ZABC/")).toBe("tiktok");
  });
  it("detects instagram reels", () => {
    expect(resolvePlatform("https://www.instagram.com/reel/abc/")).toBe("instagram");
  });
  it("falls back to other for unknown hosts", () => {
    expect(resolvePlatform("https://example.com/x")).toBe("other");
  });
  it("returns null for non-urls", () => {
    expect(resolvePlatform("not a url")).toBeNull();
  });
});
```

- [ ] **Step 5: Run it, expect FAIL** — `npm test -- platform` → FAIL ("Cannot find module '../platform'").

- [ ] **Step 6: Implement `src/lib/ai-drill/platform.ts`**

```ts
export type SourcePlatform = "youtube" | "tiktok" | "instagram" | "other";

/** Pure URL → platform classifier. Returns null when the string isn't a URL. */
export function resolvePlatform(raw: string): SourcePlatform | null {
  let host: string;
  try {
    host = new URL(raw.trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host === "vm.tiktok.com" || host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("instagram.com")) return "instagram";
  return "other";
}
```

- [ ] **Step 7: Run it, expect PASS** — `npm test -- platform` → PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add package.json vitest.config.ts src/lib/ai-drill/platform.ts src/lib/ai-drill/__tests__/platform.test.ts
git commit -m "test(ai-drill): vitest + platform resolver (Build 11)"
```

> The Edge Function copies this logic into `supabase/functions/_shared/platform.ts` (Deno can't import from `src/`). Keep the two byte-identical; they're tiny and pure.

---

### Task 5: Dedupe key + fair-use helpers

**Files:**
- Create: `unlock-web/src/lib/ai-drill/dedupe.ts`
- Test: `unlock-web/src/lib/ai-drill/__tests__/dedupe.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { canonicalSourceKey, FAIR_USE_MONTHLY_CAP, isOverCap } from "../dedupe";

describe("canonicalSourceKey", () => {
  it("strips tracking params + trailing slash + lowercases host", () => {
    expect(canonicalSourceKey("https://YouTube.com/watch?v=abc&utm_source=x"))
      .toBe(canonicalSourceKey("https://youtube.com/watch?v=abc"));
  });
  it("returns null for junk", () => {
    expect(canonicalSourceKey("nope")).toBeNull();
  });
});

describe("isOverCap", () => {
  it("true at/over the cap, false under", () => {
    expect(isOverCap(FAIR_USE_MONTHLY_CAP)).toBe(true);
    expect(isOverCap(FAIR_USE_MONTHLY_CAP - 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npm test -- dedupe` → FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/ai-drill/dedupe.ts`**

```ts
export const FAIR_USE_MONTHLY_CAP = 50;

/** Normalize a source URL so two pastes of the same video collide. */
export function canonicalSourceKey(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.protocol = "https:";
  u.hash = "";
  for (const p of [...u.searchParams.keys()]) {
    if (p.startsWith("utm_") || p === "si" || p === "feature") u.searchParams.delete(p);
  }
  let s = u.toString();
  if (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

export function isOverCap(usedThisMonth: number): boolean {
  return usedThisMonth >= FAIR_USE_MONTHLY_CAP;
}
```

- [ ] **Step 4: Run, expect PASS** — `npm test -- dedupe` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-drill/dedupe.ts src/lib/ai-drill/__tests__/dedupe.test.ts
git commit -m "test(ai-drill): canonical dedupe key + fair-use cap (Build 11)"
```

---

### Task 6: Shared types

**Files:**
- Create: `unlock-web/src/lib/ai-drill/types.ts`

- [ ] **Step 1: Write the types**

```ts
import type { SourcePlatform } from "./platform";

export type DrillJobStatus =
  | "queued" | "extracting" | "drafting" | "ready" | "no_signal" | "failed";

/** The AI's structured output, stored in ai_drill_jobs.draft_json. */
export interface DrillDraft {
  name: string;
  description: string;
  coaching_cues: string[];
  category: string | null;          // resolved to category_id in the form
  phase: string | null;             // phase id/value; null when no_signal
  skill_ids: string[];              // validated against taxonomy server/worker-side
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
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` (expect no new errors from this file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai-drill/types.ts
git commit -m "feat(ai-drill): shared job + draft types (Build 11)"
```

---

## Phase C — Edge Function pipeline

> Edge Functions run in Deno and use the **service-role** key (bypasses RLS) to update job rows. Set function secrets before deploy: `ANTHROPIC_API_KEY`, `EXTRACT_VENDOR_URL`, `EXTRACT_VENDOR_KEY` (vendor chosen at build time — spec §13). The vendor is isolated behind `extract.ts` so swapping it never touches the rest.

### Task 7: Edge Function scaffold + platform copy

**Files:**
- Create: `unlock-web/supabase/functions/_shared/platform.ts`
- Create: `unlock-web/supabase/functions/draft-drill/index.ts`

- [ ] **Step 1: Copy the resolver for Deno** — `supabase/functions/_shared/platform.ts` = byte-identical contents of `src/lib/ai-drill/platform.ts` (Task 4 Step 6).

- [ ] **Step 2: Write the entrypoint** — `supabase/functions/draft-drill/index.ts`

```ts
// Deno Edge Function: runs the extract → draft → validate pipeline for one job.
// Invoked (no await) by the requestDrillDraft server action. Updates the job row
// via the service-role client; the client watches the row over Realtime.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractSignals } from "./extract.ts";
import { draftDrill } from "./draft.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function setStatus(id: string, patch: Record<string, unknown>) {
  await supabase.from("ai_drill_jobs").update(patch).eq("id", id);
}

Deno.serve(async (req) => {
  const { jobId } = await req.json().catch(() => ({ jobId: null }));
  if (!jobId) return new Response("missing jobId", { status: 400 });

  const run = (async () => {
    const { data: job } = await supabase
      .from("ai_drill_jobs").select("*").eq("id", jobId).single();
    if (!job) return;
    try {
      await setStatus(jobId, { status: "extracting" });
      const signals = await extractSignals(job);
      if (!signals.transcript && signals.frames.length === 0) {
        await setStatus(jobId, {
          status: "no_signal",
          signal_sources: signals.sources,
          finished_at: new Date().toISOString(),
        });
        return;
      }
      await setStatus(jobId, {
        status: "drafting",
        raw_transcript: signals.transcript ?? null,
        signal_sources: signals.sources,
      });

      const { data: taxonomy } = await supabase.rpc("ai_drill_taxonomy", { p_team_id: job.team_id });
      const result = await draftDrill(signals, taxonomy);

      await setStatus(jobId, {
        status: "ready",
        draft_json: result.draft,
        field_confidence: result.confidence,
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: result.costUsd,
        finished_at: new Date().toISOString(),
      });
    } catch (e) {
      await setStatus(jobId, {
        status: "failed",
        error_detail: String(e instanceof Error ? e.message : e),
        finished_at: new Date().toISOString(),
      });
    }
  })();

  // @ts-ignore — EdgeRuntime keeps the function alive until the work finishes.
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(run);
  else await run;

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
});
```

- [ ] **Step 3: Commit**

```bash
cd /Users/taylorpangilinan/Downloads/qb_supabase_database/unlock-web
git add supabase/functions/_shared/platform.ts supabase/functions/draft-drill/index.ts
git commit -m "feat(edge): draft-drill function scaffold (Build 11)"
```

---

### Task 8: Taxonomy RPC (for the AI tool schema)

**Files:**
- Create: `qb_supabase_full_package/sql/105_ai_drill_taxonomy_rpc.sql`

- [ ] **Step 1: Inspect the real taxonomy shape first**

```sql
select distinct phase from public.team_drills where phase is not null limit 20;
select column_name from information_schema.columns where table_name='skills';
```
Use the actual table/column names from `66_skill_taxonomy_schema.sql` and `src/lib/drills/skill-groups.ts`. If the skills table isn't named `skills` or its label column isn't `name`, fix the RPC body below to match before applying.

- [ ] **Step 2: Write the RPC**

```sql
-- 105_ai_drill_taxonomy_rpc.sql
-- Returns the phase list, skills (id + label), and categories so the Edge
-- Function can build a taxonomy-constrained tool schema that can't drift.
create or replace function public.ai_drill_taxonomy(p_team_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'phases', (select coalesce(jsonb_agg(distinct phase), '[]'::jsonb)
               from public.team_drills where phase is not null),
    'skills', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'label', s.name)), '[]'::jsonb)
               from public.skills s),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'label', c.name)), '[]'::jsonb)
               from public.drill_categories c)
  );
$$;
```

- [ ] **Step 3: Apply + verify** — `select public.ai_drill_taxonomy('<a real team id>');` returns phases/skills/categories arrays.

- [ ] **Step 4: Commit**

```bash
cd /Users/taylorpangilinan/Downloads/qb_supabase_database
git add qb_supabase_full_package/sql/105_ai_drill_taxonomy_rpc.sql
git commit -m "feat(db): ai_drill_taxonomy RPC for constrained generation (Build 11)"
```

---

### Task 9: Extraction adapter (YouTube native + vendor seam)

**Files:**
- Create: `unlock-web/supabase/functions/draft-drill/extract.ts`

- [ ] **Step 1: Write the adapter**

```ts
// Media → signals. YouTube uses the free public timedtext track; everything else
// (and uploads' frames) goes through a configurable vendor. Swapping the vendor
// only touches this file. Long-video guard: cap transcript length + frame count.
import { resolvePlatform } from "../_shared/platform.ts";

export interface Signals {
  transcript: string | null;
  frames: string[];          // base64 data URLs (on-screen text source)
  sources: string[];         // e.g. ["youtube-captions","vendor-frames"]
}

const MAX_TRANSCRIPT_CHARS = 6000;   // ~1 drill; protects cost on long videos
const MAX_FRAMES = 6;

export async function extractSignals(job: {
  source_url: string | null; storage_path: string | null;
}): Promise<Signals> {
  const sources: string[] = [];
  let transcript: string | null = null;
  let frames: string[] = [];

  if (job.source_url) {
    const platform = resolvePlatform(job.source_url);
    if (platform === "youtube") {
      transcript = await fetchYouTubeCaptions(job.source_url);
      if (transcript) sources.push("youtube-captions");
    }
  }

  if (!transcript || frames.length === 0) {
    const vendor = await fetchFromVendor(job);
    if (vendor.transcript && !transcript) { transcript = vendor.transcript; sources.push("vendor-transcript"); }
    if (vendor.frames?.length) { frames = vendor.frames; sources.push("vendor-frames"); }
  }

  if (transcript && transcript.length > MAX_TRANSCRIPT_CHARS) {
    transcript = transcript.slice(0, MAX_TRANSCRIPT_CHARS);
  }
  frames = frames.slice(0, MAX_FRAMES);
  return { transcript, frames, sources };
}

async function fetchYouTubeCaptions(url: string): Promise<string | null> {
  const id = new URL(url).searchParams.get("v")
    ?? url.split("youtu.be/")[1]?.split(/[?&/]/)[0]
    ?? url.split("/shorts/")[1]?.split(/[?&/]/)[0];
  if (!id) return null;
  const res = await fetch(`https://video.google.com/timedtext?lang=en&v=${id}`);
  if (!res.ok) return null;
  const xml = await res.text();
  if (!xml.trim()) return null;                       // no caption track
  const text = xml.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return text || null;
}

async function fetchFromVendor(job: { source_url: string | null; storage_path: string | null })
  : Promise<{ transcript?: string; frames?: string[] }> {
  const base = Deno.env.get("EXTRACT_VENDOR_URL");
  const key = Deno.env.get("EXTRACT_VENDOR_KEY");
  if (!base || !key) return {};                       // vendor not configured yet → degrade
  const res = await fetch(base, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ url: job.source_url, storage_path: job.storage_path, want: ["transcript", "frames"], max_frames: MAX_FRAMES }),
  });
  if (!res.ok) return {};
  const data = await res.json().catch(() => ({}));
  // Adapt the vendor's response to our shape here (only place that knows the vendor).
  return { transcript: data.transcript ?? undefined, frames: data.frames ?? undefined };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/taylorpangilinan/Downloads/qb_supabase_database/unlock-web
git add supabase/functions/draft-drill/extract.ts
git commit -m "feat(edge): extraction adapter (youtube native + vendor seam) (Build 11)"
```

> NOTE (spec §13): pick the extraction vendor and fill the response mapping in `fetchFromVendor`. Until `EXTRACT_VENDOR_URL` is set, non-YouTube links with no captions resolve to `no_signal` — acceptable for a YouTube-first soft launch.

---

### Task 10: Anthropic structured draft + tag validation

**Files:**
- Create: `unlock-web/supabase/functions/draft-drill/draft.ts`

- [ ] **Step 1: Write the draft call**

```ts
// Single Claude call with a taxonomy-constrained tool. Reads transcript + frames
// (on-screen text) and returns a structured drill draft. Validates tags against
// the taxonomy and the phase->skill scope; drops anything invalid.
import type { Signals } from "./extract.ts";

interface Taxonomy {
  phases: string[];
  skills: { id: string; label: string }[];
  categories: { id: string; label: string }[];
}

export async function draftDrill(signals: Signals, taxonomy: Taxonomy) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  const model = "claude-sonnet-4-5";

  const tool = {
    name: "draft_drill",
    description: "Return a structured flag-football drill drafted from the clip.",
    input_schema: {
      type: "object",
      required: ["name", "description", "coaching_cues", "phase", "skill_ids"],
      properties: {
        name: { type: "string" },
        description: { type: "string", maxLength: 600 },
        coaching_cues: { type: "array", items: { type: "string" }, maxItems: 5 },
        category_id: { type: ["string", "null"], enum: [...taxonomy.categories.map(c => c.id), null] },
        phase: { type: ["string", "null"], enum: [...taxonomy.phases, null] },
        skill_ids: { type: "array", items: { type: "string", enum: taxonomy.skills.map(s => s.id) } },
        equipment: { type: "object", properties: { cones: { type: ["integer", "null"] }, other: { type: "array", items: { type: "string" } } } },
        source_author: { type: ["string", "null"] },
        confidence: { type: "object" },
      },
    },
  };

  const system =
    "You draft FLAG FOOTBALL drills only. Output must be specific to flag football " +
    "(5v5/7v7), never generic or other-sport. Use ONLY the provided phase and skill " +
    "ids. Read both the transcript and any on-screen text in the frames. If the clip " +
    "doesn't describe a runnable drill, set phase=null and keep description short. " +
    "Skills must belong to the chosen phase.";

  const content: unknown[] = [];
  if (signals.transcript) content.push({ type: "text", text: `Transcript:\n${signals.transcript}` });
  for (const f of signals.frames) {
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.replace(/^data:[^,]+,/, "") } });
  }
  content.push({ type: "text", text: `Available phases: ${JSON.stringify(taxonomy.phases)}\nAvailable skills: ${JSON.stringify(taxonomy.skills)}\nAvailable categories: ${JSON.stringify(taxonomy.categories)}` });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: [tool],
      tool_choice: { type: "tool", name: "draft_drill" },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const block = data.content?.find((b: { type: string }) => b.type === "tool_use");
  if (!block) throw new Error("no tool_use in response");
  const raw = block.input as Record<string, unknown>;

  // Validate tags against taxonomy (defense in depth — schema enum already constrains).
  const validSkillIds = new Set(taxonomy.skills.map((s) => s.id));
  const skill_ids = ((raw.skill_ids as string[]) ?? []).filter((id) => validSkillIds.has(id));
  const phase = taxonomy.phases.includes(raw.phase as string) ? (raw.phase as string) : null;

  const draft = {
    name: String(raw.name ?? "").slice(0, 200) || "Untitled drill",
    description: String(raw.description ?? ""),
    coaching_cues: ((raw.coaching_cues as string[]) ?? []).slice(0, 5),
    category: (raw.category_id as string) ?? null,
    phase,
    skill_ids,
    equipment: {
      cones: (raw.equipment as { cones?: number })?.cones ?? null,
      other: (raw.equipment as { other?: string[] })?.other ?? [],
    },
    source_author: (raw.source_author as string) ?? null,
    confidence: (raw.confidence as Record<string, number>) ?? {},
  };

  const inT = data.usage?.input_tokens ?? 0;
  const outT = data.usage?.output_tokens ?? 0;
  const costUsd = (inT / 1e6) * 3 + (outT / 1e6) * 15;   // Sonnet approx
  return { draft, model, inputTokens: inT, outputTokens: outT, costUsd, confidence: draft.confidence };
}
```

- [ ] **Step 2: Deploy + set secrets**

```bash
supabase functions deploy draft-drill --project-ref cclkmoczomakkxfvavkw
supabase secrets set ANTHROPIC_API_KEY=... --project-ref cclkmoczomakkxfvavkw
# EXTRACT_VENDOR_URL / EXTRACT_VENDOR_KEY once the vendor is chosen.
```
(Or deploy via the Supabase MCP `deploy_edge_function`.)

- [ ] **Step 3: Smoke test** with a captioned YouTube drill link:

```bash
curl -i -X POST "https://cclkmoczomakkxfvavkw.functions.supabase.co/draft-drill" \
  -H "authorization: Bearer <service-key>" -H "content-type: application/json" \
  -d '{"jobId":"<a queued job id>"}'
```
Then `select status, draft_json from ai_drill_jobs where id='<id>';` → `ready` + populated draft (or `no_signal` for a silent clip).

- [ ] **Step 4: Commit**

```bash
cd /Users/taylorpangilinan/Downloads/qb_supabase_database/unlock-web
git add supabase/functions/draft-drill/draft.ts
git commit -m "feat(edge): anthropic structured draft + tag validation (Build 11)"
```

> Confirm the current Anthropic model id + pricing at build time; update `model` and the `costUsd` constants if they've changed.

---

## Phase D — Web server actions + UI

### Task 11: `requestDrillDraft` / `retryDrillJob` / feedback actions

**Files:**
- Create: `unlock-web/src/lib/ai-drill/actions.ts`

- [ ] **Step 1: Write the server actions**

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { resolvePlatform } from "./platform";
import { canonicalSourceKey, FAIR_USE_MONTHLY_CAP, isOverCap } from "./dedupe";

type Result =
  | { ok: true; jobId: string }
  | { ok: false; error: string; existingDrillId?: string };

export async function requestDrillDraft(teamId: string, sourceUrl: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const key = canonicalSourceKey(sourceUrl);
  if (!key) return { ok: false, error: "That doesn't look like a valid link." };
  const platform = resolvePlatform(key) ?? "other";

  // Pro gate (RLS also enforces; this gives a friendly message).
  const { data: team } = await supabase.from("teams").select("plan").eq("id", teamId).single();
  if (team?.plan !== "pro") return { ok: false, error: "AI drafting is a Pro feature." };

  // Dedupe: already in the team library?
  const { data: dupeDrill } = await supabase
    .from("team_drills").select("id").eq("team_id", teamId).eq("source_url", key).maybeSingle();
  if (dupeDrill) return { ok: false, error: "This link is already in your library.", existingDrillId: dupeDrill.id };

  // Fair-use cap (this calendar month).
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("ai_drill_jobs").select("id", { count: "exact", head: true })
    .eq("team_id", teamId).gte("created_at", monthStart.toISOString());
  if (isOverCap(count ?? 0)) return { ok: false, error: `Monthly limit of ${FAIR_USE_MONTHLY_CAP} AI drafts reached.` };

  const { data: job, error } = await supabase
    .from("ai_drill_jobs")
    .insert({ team_id: teamId, created_by: user.id, source_kind: platform, source_url: key })
    .select("id").single();
  if (error || !job) return { ok: false, error: error?.message ?? "Could not start the job." };

  // Fire the worker (don't await completion — client watches Realtime).
  await supabase.functions.invoke("draft-drill", { body: { jobId: job.id } });
  return { ok: true, jobId: job.id };
}

export async function retryDrillJob(jobId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("ai_drill_jobs")
    .update({ status: "queued", error_detail: null, finished_at: null }).eq("id", jobId);
  if (error) return { ok: false, error: error.message };
  await supabase.functions.invoke("draft-drill", { body: { jobId } });
  return { ok: true, jobId };
}

export async function setDrillJobFeedback(jobId: string, feedback: -1 | 1): Promise<void> {
  const supabase = await createClient();
  await supabase.from("ai_drill_jobs").update({ user_feedback: feedback }).eq("id", jobId);
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` (expect no new errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai-drill/actions.ts
git commit -m "feat(ai-drill): requestDrillDraft + retry + feedback actions (Build 11)"
```

---

### Task 12: Paste-a-link card + live status

**Files:**
- Create: `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/paste/page.tsx`
- Create: `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/paste/PasteLinkClient.tsx`

- [ ] **Step 1: Read an existing drills page** (`drills/page.tsx`) for the team-access guard (`memberCanManage` from `src/lib/team/staff-roles.ts`) and shell; reuse them.

- [ ] **Step 2: Write the route** — `paste/page.tsx`

```tsx
import PasteLinkClient from "./PasteLinkClient";

export default async function PasteDrillPage({
  params,
}: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <PasteLinkClient teamId={teamId} />;
}
```

- [ ] **Step 3: Write the client** — `paste/PasteLinkClient.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { resolvePlatform } from "@/lib/ai-drill/platform";
import { requestDrillDraft, retryDrillJob } from "@/lib/ai-drill/actions";
import type { DrillJob, DrillJobStatus } from "@/lib/ai-drill/types";

const STATUS_COPY: Record<DrillJobStatus, string> = {
  queued: "Queued…",
  extracting: "Reading the clip…",
  drafting: "Drafting the drill…",
  ready: "Ready",
  no_signal: "This link doesn't look like a drill.",
  failed: "Couldn't read this clip.",
};

export default function PasteLinkClient({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<DrillJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const platform = url.trim() ? resolvePlatform(url) : null;

  useEffect(() => {
    if (!jobId) return;
    const channel = supabase
      .channel(`ai_drill_jobs:${jobId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "ai_drill_jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          const job = payload.new as DrillJob;
          setStatus(job.status);
          if (job.status === "ready" || job.status === "no_signal" || job.status === "failed") {
            // ready → seeded form; no_signal/failed → manual form carrying the link
            if (job.status !== "failed") {
              router.push(`/dashboard/team/${teamId}/drills/from-link/${jobId}`);
            }
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobId, teamId, router]);

  async function onSubmit() {
    setError(null);
    const res = await requestDrillDraft(teamId, url);
    if (!res.ok) { setError(res.error); return; }
    setJobId(res.jobId);
    setStatus("queued");
  }

  const running = !!jobId && status !== "failed" && status !== "no_signal";

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 20 }}>
      <h1>Paste a drill link</h1>
      <p className="uff-muted">Watch a link turn into a structured, source-credited drill.</p>

      <label className="uff-label">PASTE A DRILL LINK {platform && <span>· {platform.toUpperCase()}</span>}</label>
      <input className="uff-input" placeholder="youtube.com/watch?v=…" value={url}
        onChange={(e) => setUrl(e.target.value)} disabled={running} />
      <button className="uff-btn-primary" onClick={onSubmit} disabled={running || !url.trim()}>
        {running ? STATUS_COPY[status ?? "queued"] : "Read it in →"}
      </button>

      {error && <p className="uff-error">{error}</p>}

      {status === "failed" && (
        <div>
          <p>{STATUS_COPY.failed}</p>
          <button onClick={() => jobId && retryDrillJob(jobId)}>Try again</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify build** — `npm run build`; fix any style-token mismatches against the real UFF classes used in `DrillForm.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(workspace)/dashboard/team/[teamId]/drills/paste"
git commit -m "feat(ai-drill): paste-a-link card + realtime status (Build 11)"
```

> Match the visual treatment (orange CTA, mono labels) to the existing `drills/` components; the `uff-*` classes above stand in for the real UFF utility classes.

---

### Task 13: Seed `DrillForm` from the job (materialize-on-save)

**Files:**
- Create: `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/from-link/[jobId]/page.tsx`
- Modify: `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/DrillForm.tsx`

- [ ] **Step 1: Read `DrillForm.tsx`** fully to learn its create-mode props + initial-state shape and the `save()` body (~line 453). Identify the setters for: drill name, description, phase, selected skills, equipment.

- [ ] **Step 2: Add optional `initialDraft` + `aiJobId` props.** In the component prop type add:
```tsx
initialDraft?: import("@/lib/ai-drill/types").DrillDraft | null;
aiJobId?: string | null;
sourceUrl?: string | null;
sourcePlatform?: string | null;
```
In the state initializers, seed from `initialDraft` when present: name→drill-name state, `description`, `coaching_cues`→new cues state, `phase`, `skill_ids`→selected skills, `equipment.cones`/`other`. Manual behavior is unchanged when `initialDraft` is absent.

- [ ] **Step 3: Write `source` + credit + cues on save.** Extend the `team_drills` insert payload in `save()`:
```tsx
source: aiJobId ? "ai" : "manual",
source_url: sourceUrl ?? existingSourceUrlState ?? null,
source_platform: aiJobId ? (sourcePlatform ?? null) : null,
source_author: initialDraft?.source_author ?? null,
coaching_cues: coachingCues,   // new state array
```
After a successful save from a job, link the job to the drill:
```tsx
if (aiJobId && newDrillId) {
  await supabase.from("ai_drill_jobs").update({ drill_id: newDrillId }).eq("id", aiJobId);
}
```

- [ ] **Step 4: Write the `from-link` route**

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DrillForm from "../../DrillForm";

export default async function FromLinkPage({
  params,
}: { params: Promise<{ teamId: string; jobId: string }> }) {
  const { teamId, jobId } = await params;
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("ai_drill_jobs")
    .select("id, team_id, status, source_url, source_kind, draft_json")
    .eq("id", jobId).single();
  if (!job || job.team_id !== teamId) notFound();

  const draft = job.status === "ready" ? job.draft_json : null;  // no_signal/failed → manual

  return (
    <DrillForm
      teamId={teamId}
      initialDraft={draft}
      aiJobId={job.id}
      sourceUrl={job.source_url}
      sourcePlatform={job.source_kind}
      /* plus whatever create-mode props DrillForm already requires */
    />
  );
}
```

- [ ] **Step 5: Build + manual verify** — `npm run build`; paste a captioned YouTube drill link → status animates → pre-filled form → edit → Publish → drill in library with credit (Task 14); `ai_drill_jobs.drill_id` set.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(workspace)/dashboard/team/[teamId]/drills/from-link" "src/app/(workspace)/dashboard/team/[teamId]/drills/DrillForm.tsx"
git commit -m "feat(ai-drill): seed DrillForm from job + write source/credit/cues (Build 11)"
```

---

### Task 14: Source credit + coaching cues on the drill detail

**Files:**
- Modify: `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/[id]/page.tsx`

- [ ] **Step 1: Read the detail page** to find where name + description render, and extend the drill `select` to include `source_platform, source_author, source_url, coaching_cues`.

- [ ] **Step 2: Add the credit line + cues** in the header area:

```tsx
{drill.source_platform && (
  <p className="uff-credit">
    VIA {drill.source_platform.toUpperCase()}
    {drill.source_author ? ` · ${drill.source_author}` : ""}
    {drill.source_url && <a href={drill.source_url} target="_blank" rel="noreferrer"> ↗</a>}
  </p>
)}
{drill.coaching_cues?.length > 0 && (
  <ul className="uff-cues">
    {drill.coaching_cues.map((c: string, i: number) => <li key={i}>{c}</li>)}
  </ul>
)}
```

- [ ] **Step 3: Build + verify** — `npm run build`; a link-sourced drill shows the credit + cues; the source link opens the original (never re-hosted).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(workspace)/dashboard/team/[teamId]/drills/[id]/page.tsx"
git commit -m "feat(ai-drill): source credit + coaching cues on drill detail (Build 11)"
```

---

### Task 15: "Add a drill" entry → Paste a link vs Build by hand

**Files:**
- Modify: `unlock-web/src/app/(workspace)/dashboard/team/[teamId]/drills/DrillsLibraryClient.tsx`

- [ ] **Step 1: Read `DrillsLibraryClient.tsx`** to find the existing "Add a drill" / create entry.

- [ ] **Step 2: Make it a two-option choice** (Pro sees both; non-Pro sees only "Build by hand", with "Paste a link" shown as a disabled Pro upsell):

```tsx
<a href={`/dashboard/team/${teamId}/drills/paste`} className="uff-btn-primary">Paste a link</a>
<a href={/* existing create route */} className="uff-btn-secondary">Build by hand</a>
```
Fetch the team `plan` alongside existing team data to gate "Paste a link".

- [ ] **Step 3: Build + verify** — `npm run build`; the library shows both entries; "Paste a link" routes to the paste flow.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(workspace)/dashboard/team/[teamId]/drills/DrillsLibraryClient.tsx"
git commit -m "feat(ai-drill): add-a-drill entry (paste a link vs build by hand) (Build 11)"
```

---

## Phase E — Verification & wrap

### Task 16: End-to-end verification

- [ ] **Step 1: Unit tests** — `npm test` → all pass (platform + dedupe).
- [ ] **Step 2: Lint + build** — `npm run lint && npm run build` → clean.
- [ ] **Step 3: Flip a test team to Pro** — `update teams set plan='pro' where id='<test team>';`
- [ ] **Step 4: Happy path (YouTube w/ captions)** — paste → status animates → seeded form → Publish → library shows drill + "VIA YOUTUBE" credit + cues; `ai_drill_jobs.drill_id` set.
- [ ] **Step 5: `no_signal` path** — paste a silent/captionless clip → lands on the manual form carrying the link; no fabricated phase.
- [ ] **Step 6: Dedupe** — paste the same link again → "already in your library."
- [ ] **Step 7: Pro gate** — set team `plan='free'` → "Paste a link" disabled/upsell; `requestDrillDraft` returns the Pro error.
- [ ] **Step 8: Reaper** — insert a job, set `updated_at` back 11 min, run `select public.reap_stale_ai_drill_jobs();` → status `failed`.
- [ ] **Step 9: Commit fixes**, then verify the branch:

```bash
git -C /Users/taylorpangilinan/Downloads/qb_supabase_database/unlock-web log --oneline build-11-ai-drill-drafter -15
```

---

## Self-review against the spec

- §2 sources → Task 4 (platform), Task 9 (YouTube native + vendor seam, upload via storage_path). ✓
- §2 transcript+OCR fusion → Task 9 frames + Task 10 (model reads frames as on-screen text). ✓
- §2 Approach A / async / Realtime → Tasks 7, 11, 12. ✓
- §2 materialize-on-save → Task 13 (form creates the row on save). ✓
- §2 source crediting → Tasks 1, 13, 14. ✓
- §2 Pro flag + RLS + fair-use → Tasks 1, 2, 11. ✓
- §6 taxonomy-constrained, phase-then-skill, no fabricated phase → Tasks 8, 10. ✓
- §7 UX (entry, paste card, live status, not-a-drill, build by hand) → Tasks 12, 13, 15. ✓
- §7 feedback thumbs → action in Task 11; wire the UI onto the drafted-drill detail as a small add in Task 14 (known follow-up below). ✓
- §8 errors (dedupe, double-submit via disabled button, stale reaper) → Tasks 3, 11, 12. ✓
- §9 attribution → existing `team_drills` insert trigger fires on save (source='ai' recorded). ✓
- §10 diagram → **excluded** (Phase 2). ✓
- §13 verify-at-build-time → resolved: `drill_name`, `source_url` exists, `coaching_cues` added, skills = `drill_skills` join, phase = column, migrations 102+. ✓

**Known follow-ups (not gaps):** wire the thumbs up/down UI onto the drafted-drill detail (action exists, Task 11); pick + map the extraction vendor (Task 9 note); confirm Anthropic model id/pricing (Task 10 note); confirm the real skills table/column names in the taxonomy RPC (Task 8 Step 1). **Mobile parity** and **Phase 2 diagram** = separate plans.
