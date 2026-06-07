# Gap Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the team dashboard's "This Week's Focus" and the scouting report's "This Week's Read" tell one consistent story by computing both from a single shared per-(player, drill) score base, and bridging skill ↔ group in the UI.

**Architecture:** Introduce one SQL view `v_player_drill_score` (latest per (player, drill) over 90 days, scored on the same rules — rating, made/attempts, and cohort-relative timed). Repoint the existing team-focus chain (`v_team_skill_player` → `v_team_skill_focus` → `v_team_skill_drill`) and the scouting base (`v_player_skill_profile`) onto it, so the dashboard skill ranking and the scouting group ranking are two roll-ups of identical numbers. Then add a skill-group tag to each dashboard focus row and a focus-skill bridge clause to the scouting headline.

**Tech Stack:** PostgreSQL views (Supabase, `security_invoker`), Next.js 16 / React server + client components, TypeScript. SQL migrations live in `qb_supabase_full_package/sql/` and are applied to the live Supabase project via the Supabase MCP (`apply_migration`). There is no SQL unit-test harness in this repo — SQL is verified with explicit result-checking queries; UI is verified by running the app and comparing the two surfaces.

**Branch:** `build-10-gap-reconciliation` (already created; the design doc is committed there).

---

## Pre-flight (do once before Task 1)

- [ ] **P1: Confirm the Supabase MCP points at the right project.** Multiple Supabase projects exist; the MCP can be aimed at the wrong one.

Run (MCP): `mcp__supabase__get_project_url`
Expected: a URL whose project ref matches the Unlock Flag Football project. If it doesn't, stop and fix the MCP target before applying any migration. (See memory: `feedback_verify_mcp_project`.)

- [ ] **P2: Capture the current (pre-change) baseline for the test team** so we can prove the fix changed the right numbers. Test team id: `5608bb33-83e1-49ac-a3d3-7397b4b5c7e1` (Purple F.).

Run (MCP `mcp__supabase__execute_sql`):
```sql
-- Current dashboard top-3 weakest skills (absolute-only today)
select skill_name, skill_group, avg_score, players_with_signal
from public.v_team_skill_focus
where team_id = '5608bb33-83e1-49ac-a3d3-7397b4b5c7e1'
order by avg_score asc
limit 3;
```
Save the output (skill names + scores) into the PR description. These percentages are expected to shift after Task 1 because timed drills will now be included.

---

## Task 1: Unified per-(player, drill) score base

**Files:**
- Create: `qb_supabase_full_package/sql/101_unified_skill_score_base.sql`

This is the trust fix. Today two scored bases disagree: the team-focus chain runs on `v_team_abs_latest` (absolute only, timed excluded), while `v_player_skill_profile` has its own inline `scored` CTE (absolute + cohort-relative timed). This migration creates ONE base view and rebuilds both chains on it. `v_team_skill_focus` and `v_team_focus_recommendations` need no body change — they already build on `v_team_skill_player`, so repointing that view propagates timed inclusion automatically.

- [ ] **Step 1: Write the migration file**

Create `qb_supabase_full_package/sql/101_unified_skill_score_base.sql` with exactly this content:

```sql
-- =========================================================
-- 101_unified_skill_score_base.sql
-- Gap reconciliation: dashboard "This week's focus" and scouting
-- "This week's read" disagreed because they ran on two different scored
-- bases. This migration collapses them to ONE:
--
--   v_player_drill_score  : NEW single source of truth — latest scored rep
--                           per (player, drill), 90 days, incl. cohort-relative
--                           timed (the formula that previously lived inline in
--                           v_player_skill_profile + the absolute-only one in
--                           v_team_abs_latest).
--
-- Everything rolls up from it:
--   v_team_skill_player   : per (skill, player)  -> REBUILT on the base (now incl. timed)
--   v_team_skill_drill    : per (skill, drill)   -> REBUILT on the base (now incl. timed)
--   v_player_skill_profile: per (player, skill)  -> REBUILT on the base (DRY; same output)
--   v_team_skill_focus    : per (team, skill)    -> UNCHANGED body (builds on v_team_skill_player)
--   v_team_focus_recommendations                 -> UNCHANGED (builds on v_team_skill_focus)
--
-- Consequence: the dashboard skill ranking and the scouting group ranking are
-- two aggregations of identical numbers and cannot contradict each other.
--
-- Supersedes the timed-exclusion decision in migrations 98/99 and
-- v_team_abs_latest (dropped at the end -- no longer referenced).
-- =========================================================

-- ---------------------------------------------------------
-- Base: latest scored rep per (team, player, drill), last 90 days.
-- score = rating/5  OR  made/attempts  OR  cohort-relative timed
-- (timed: (max - t)/(max - min) over the (team, drill) cohort's latest-per-player
--  values, gated to >= 3 players with a time and a nonzero range). May be null
-- (e.g. a lone timed result); downstream views filter `where score is not null`.
-- ---------------------------------------------------------
create or replace view public.v_player_drill_score
with (security_invoker = true)
as
with latest_results as (
  select distinct on (br.player_id, br.drill_id)
    br.team_id,
    br.player_id,
    br.drill_id,
    br.rating,
    br.made_count,
    br.attempts_count,
    br.time_seconds,
    br.assessment_date
  from public.benchmark_results br
  where br.assessment_date >= current_date - interval '90 days'
  order by br.player_id, br.drill_id, br.assessment_date desc, br.created_at desc
),
timed_cohort as (
  select
    team_id,
    drill_id,
    min(time_seconds) as min_t,
    max(time_seconds) as max_t,
    count(distinct player_id) as timed_players
  from latest_results
  where time_seconds is not null
  group by team_id, drill_id
)
select
  l.team_id,
  l.player_id,
  l.drill_id,
  coalesce(
    l.rating::numeric / 5.0,
    case when l.attempts_count > 0
         then l.made_count::numeric / l.attempts_count::numeric
         else null end,
    case when l.time_seconds is not null
          and tc.timed_players >= 3
          and tc.max_t > tc.min_t
         then (tc.max_t - l.time_seconds) / (tc.max_t - tc.min_t)
         else null end
  ) as score,
  l.assessment_date
from latest_results l
left join timed_cohort tc
  on tc.team_id = l.team_id and tc.drill_id = l.drill_id;

comment on view public.v_player_drill_score is
  'Single source of truth: latest scored benchmark per (team, player, drill), last 90 days. score = rating/5 or made/attempts or cohort-relative timed (>=3 players per drill). Feeds v_team_skill_player/_drill, v_player_skill_profile.';

-- ---------------------------------------------------------
-- WHO: per (skill, player) composite, weighted across the player's drills.
-- Rebuilt on v_player_drill_score (was v_team_abs_latest). Same output columns.
-- ---------------------------------------------------------
create or replace view public.v_team_skill_player
with (security_invoker = true)
as
select
  b.team_id,
  ds.skill_id,
  b.player_id,
  tp.player_name,
  round((sum(b.score * ds.weight) / nullif(sum(ds.weight), 0))::numeric, 3) as player_score,
  count(distinct b.drill_id) as drill_sample,
  max(b.assessment_date)     as last_signal_date
from public.v_player_drill_score b
join public.drill_skills ds  on ds.drill_id = b.drill_id
join public.team_players tp  on tp.id = b.player_id
where b.score is not null
group by b.team_id, ds.skill_id, b.player_id, tp.player_name;

comment on view public.v_team_skill_player is
  'Who: per (team, skill, player) composite (incl. timed). Order player_score ASC for "who is dragging this skill down". Built on v_player_drill_score (DRY).';

-- ---------------------------------------------------------
-- WHICH DRILLS: per (skill, drill) team average. Rebuilt on the base.
-- Same output columns.
-- ---------------------------------------------------------
create or replace view public.v_team_skill_drill
with (security_invoker = true)
as
select
  b.team_id,
  ds.skill_id,
  b.drill_id,
  td.drill_name,
  round(avg(b.score)::numeric, 3) as avg_score,
  count(distinct b.player_id) as players_n,
  max(b.assessment_date)      as last_date
from public.v_player_drill_score b
join public.drill_skills ds on ds.drill_id = b.drill_id
join public.team_drills  td on td.id = b.drill_id
where b.score is not null
group by b.team_id, ds.skill_id, b.drill_id, td.drill_name;

comment on view public.v_team_skill_drill is
  'Which drills prove it: per (team, skill, drill) average (incl. timed). Order avg_score ASC for the weakest contributing drill. Built on v_player_drill_score (DRY).';

-- ---------------------------------------------------------
-- v_player_skill_profile: per (player, skill) composite. Rebuilt on the base
-- (was an inline scored CTE). Output columns unchanged -- widgets keep working.
-- ---------------------------------------------------------
create or replace view public.v_player_skill_profile
with (security_invoker = true)
as
select
  s.team_id,
  s.player_id,
  sk.id            as skill_id,
  sk.slug          as skill_slug,
  sk.skill_name,
  sk.skill_group,
  round((sum(s.score * ds.weight) / nullif(sum(ds.weight), 0))::numeric, 3) as composite_score,
  count(distinct s.drill_id) as drill_sample_size,
  max(s.assessment_date)     as last_signal_date
from public.v_player_drill_score s
join public.drill_skills ds on ds.drill_id = s.drill_id
join public.skills sk       on sk.id = ds.skill_id
where s.score is not null
group by s.team_id, s.player_id, sk.id, sk.slug, sk.skill_name, sk.skill_group;

comment on view public.v_player_skill_profile is
  'Composite player-skill scores, last 90 days, weighted by drill_skills, incl. cohort-relative timed. Built on v_player_drill_score (DRY) -- shares its base with v_team_skill_focus so the two surfaces cannot diverge.';

-- ---------------------------------------------------------
-- v_team_abs_latest is now unreferenced (v_team_skill_player + v_team_skill_drill
-- were repointed above). Drop it so the absolute-only base can't be reused.
-- ---------------------------------------------------------
drop view if exists public.v_team_abs_latest;
```

- [ ] **Step 2: Apply the migration**

Run (MCP): `mcp__supabase__apply_migration` with `name: "101_unified_skill_score_base"` and `query` = the full file contents above.
Expected: success, no error. If it errors with "cannot drop ... other objects depend on it" on the final `drop view`, a view still references `v_team_abs_latest` — grep `qb_supabase_full_package/sql` for `v_team_abs_latest`, repoint that view in this migration above the drop, and re-apply.

- [ ] **Step 3: Verify the base view exists and includes timed**

Run (MCP `execute_sql`):
```sql
select count(*) as scored_rows,
       count(*) filter (where score is not null) as non_null,
       count(distinct drill_id) as drills
from public.v_player_drill_score
where team_id = '5608bb33-83e1-49ac-a3d3-7397b4b5c7e1';
```
Expected: `non_null` > 0 and `drills` greater than the count of purely rating/made-attempts drills (i.e. timed drills now contribute). If `non_null` is 0, the team has no recent benchmarks — pick another team id from `select distinct team_id from public.benchmark_results`.

- [ ] **Step 4: Verify the dashboard chain still returns and now reflects timed**

Run (MCP `execute_sql`):
```sql
select skill_name, skill_group, avg_score, players_with_signal
from public.v_team_skill_focus
where team_id = '5608bb33-83e1-49ac-a3d3-7397b4b5c7e1'
order by avg_score asc
limit 3;
```
Expected: 3 rows. Compare to the P2 baseline — at least one score should differ (timed now folded in). No crash, columns identical to before (`skill_name, skill_group, avg_score, players_with_signal`).

- [ ] **Step 5: Commit**

```bash
git add qb_supabase_full_package/sql/101_unified_skill_score_base.sql
git commit -m "feat(sql): unify dashboard + scouting onto v_player_drill_score base

Both surfaces now roll up from one per-(player,drill) scored view
(incl. cohort-relative timed). Drops v_team_abs_latest. Migration 101."
```

Note: `qb_supabase_full_package/` is not git-tracked in the `unlock-web` repo (see memory: `reference_repo_topology`). If `git add` reports the path is outside the repo / ignored, skip the commit for this file and instead record in the PR description that migration 101 was authored at `qb_supabase_full_package/sql/101_unified_skill_score_base.sql` and applied via MCP. The SQL is the artifact; the DB is the source of truth.

---

## Task 2: Prove the two surfaces reconcile (data-level)

**Files:** none (verification only).

This task encodes the success criterion: the dashboard's weakest skill and the scouting report's weakest group must roll up to each other.

- [ ] **Step 1: Confirm the dashboard's #1 weakest skill's group appears among the weakest groups**

Run (MCP `execute_sql`):
```sql
-- Dashboard #1 weakest skill + its group
with focus as (
  select skill_name, skill_group, avg_score
  from public.v_team_skill_focus
  where team_id = '5608bb33-83e1-49ac-a3d3-7397b4b5c7e1'
  order by avg_score asc
  limit 1
),
-- Group averages from the SAME base, team-wide
grp as (
  select sk.skill_group, round(avg(p.composite_score)::numeric,3) as group_avg
  from public.v_player_skill_profile p
  join public.skills sk on sk.id = p.skill_id
  where p.team_id = '5608bb33-83e1-49ac-a3d3-7397b4b5c7e1'
    and p.composite_score is not null
  group by sk.skill_group
  order by group_avg asc
)
select 'dashboard_weakest_skill' as src, skill_name as label, skill_group, avg_score as score from focus
union all
select 'weakest_group', skill_group, skill_group, group_avg from grp limit 4;
```
Expected: the dashboard's weakest skill's `skill_group` is among the lowest-scoring groups. They are now arithmetic roll-ups of the same `v_player_drill_score` rows, so this should hold. Record the result in the PR description. (Exact rank can differ — a single very-weak skill need not make its whole group the weakest — but the group should never be a strong/top group while its member skill is the team's weakest. If it is, investigate `drill_skills` weights before proceeding.)

---

## Task 3: Dashboard — skill-group bridge tag + copy consistency

**Files:**
- Modify: `unlock-web/src/lib/drills/skill-groups.ts` (add `roomIdForSkillGroup` helper)
- Modify: `unlock-web/src/components/dashboard/widgets/FocusSkillRow.tsx` (render the tag)
- Modify: `unlock-web/src/components/dashboard/widgets/WeeklyFocusCard.tsx` (fix now-false unlock copy)
- Modify: `unlock-web/src/lib/dashboard/team-home-data.ts` (fix now-false doc comment on `loadTeamFocus`)

The bridge is a small pill on each focus row showing the skill's group via the **same** `skillAreaLabel()` the scouting rooms use (e.g. "Defensive skills", "Football IQ"). Identical label text on both surfaces is what makes "Zone Coverage" and the scouting "Defense room — Defensive skills" read as the same thing. No new data — `FocusSkill.skillGroup` already exists. The drill-to-fix the spec called for already exists in `FocusSkillRow` ("The fix · drills to close this gap") and now reflects timed via Task 1; no change needed there.

- [ ] **Step 1: Add the group→room helper (shared with Task 4)**

In `unlock-web/src/lib/drills/skill-groups.ts`, append after `roomForPrimaryPosition` (end of file):

```typescript
// The position room a skill group "belongs" to, for bridging the dashboard's
// skill view to the scouting report's room view. athletic + iq are universal
// (cut across every room) -> null. Used by the focus card tag and the scouting
// headline's focus-skill bridge. Single source so both stay in sync.
export function roomIdForSkillGroup(
  group: SkillGroup
): PositionRoom["id"] | null {
  const room = POSITION_ROOMS.find((r) => r.signature === group);
  return room ? room.id : null;
}
```

- [ ] **Step 2: Render the tag in `FocusSkillRow`**

In `unlock-web/src/components/dashboard/widgets/FocusSkillRow.tsx`:

Add the imports (after the existing `import Spark from "./Spark";` line, line 15):
```typescript
import { skillAreaLabel } from "@/lib/drills/skill-groups";
import type { SkillGroup } from "@/lib/types/skills";
```

Then, in the GAP header block, the skill name currently renders as (lines 108–118):
```tsx
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--uff-text)",
          }}
        >
          {skill.skillName}
        </span>
```
Replace that single `<span>` with a name + group-tag stack:
```tsx
        <span
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--uff-text)" }}>
            {skill.skillName}
          </span>
          <span
            style={{
              alignSelf: "flex-start",
              fontSize: 9.5,
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--uff-text-mute)",
              border: "1px solid var(--uff-line)",
              borderRadius: 999,
              padding: "1px 7px",
            }}
            title="Skill area — matches the room grouping on the Scouting report"
          >
            {skillAreaLabel(skill.skillGroup as SkillGroup)}
          </span>
        </span>
```

- [ ] **Step 3: Fix the now-false unlock copy in `WeeklyFocusCard`**

In `unlock-web/src/components/dashboard/widgets/WeeklyFocusCard.tsx`, the `UnlockState` text (lines 24–26) currently reads:
```tsx
      Rate players on a few skill drills to unlock your weekly focus. Skill gaps
      are scored from 1–5 ratings and made/attempts drills — timed drills build
      player speed but don&apos;t rank team skill gaps.
```
Replace with (timed now counts):
```tsx
      Rate or time players on a few skill drills to unlock your weekly focus.
      Skill gaps are scored from 1–5 ratings, made/attempts, and timed drills
      (timed scored against your team&apos;s range).
```

- [ ] **Step 4: Fix the now-false doc comment in `loadTeamFocus`**

In `unlock-web/src/lib/dashboard/team-home-data.ts`, the `loadTeamFocus` doc comment (lines 1181–1183) currently reads:
```typescript
 * NOTE: timed benchmarks are intentionally excluded from this ranking (they have
 * no absolute reference). They DO feed player-level widgets via
 * v_player_skill_profile. See docs/ACTION_LAYER_SPEC.md.
```
Replace with:
```typescript
 * NOTE: timed benchmarks ARE included as of migration 101 — both this ranking
 * and v_player_skill_profile now roll up from v_player_drill_score, so the
 * dashboard focus and the scouting report cannot diverge. Timed is scored
 * cohort-relative. See docs/2026-06-07-gap-reconciliation-design.md.
```

- [ ] **Step 5: Typecheck**

Run: `cd unlock-web && npx tsc --noEmit`
Expected: no new errors in `FocusSkillRow.tsx`, `WeeklyFocusCard.tsx`, `skill-groups.ts`, `team-home-data.ts`. (If `SkillGroup` import path differs, confirm with `grep -n "SkillGroup" src/lib/types/skills.ts`.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/drills/skill-groups.ts \
        src/components/dashboard/widgets/FocusSkillRow.tsx \
        src/components/dashboard/widgets/WeeklyFocusCard.tsx \
        src/lib/dashboard/team-home-data.ts
git commit -m "feat(dashboard): skill-group bridge tag on focus rows + timed-inclusive copy"
```

---

## Task 4: Scouting — focus-skill bridge clause in the headline

**Files:**
- Modify: `unlock-web/src/lib/dashboard/team-scouting-data.ts` (`buildTeamDecisions`, the `room_weakness` lead)

The scouting "This Week's Read" lead currently says "<Room> is your weakest room — <group> is the gap." `buildTeamDecisions` already receives `focus: TeamFocus` (the dashboard's top-3). Add a clause that names how many of those focus skills sit in the weakest room — the explicit bridge ("2 of your 3 dashboard focus skills sit here"). It degrades silently to no clause when none map, so it never lies.

- [ ] **Step 1: Import the shared helper**

In `unlock-web/src/lib/dashboard/team-scouting-data.ts`, find the existing import from skill-groups (confirm with `grep -n "drills/skill-groups" src/lib/dashboard/team-scouting-data.ts`). Add `roomIdForSkillGroup` to that import list. If there is no existing import from `@/lib/drills/skill-groups`, add near the other lib imports:
```typescript
import { roomIdForSkillGroup } from "@/lib/drills/skill-groups";
import type { SkillGroup } from "@/lib/types/skills";
```
(If `SkillGroup` is already imported in this file, do not duplicate the type import.)

- [ ] **Step 2: Compute and append the bridge clause**

In `buildTeamDecisions`, inside the `if (weakestRoom) {` block, immediately after `const conf = provisional ? ... : "";` (currently around line 475) and before `decisions.push({`, insert:

```typescript
    // Bridge to the dashboard: how many of the team's top focus skills live in
    // this room (by skill group -> room). Both surfaces now share one base
    // (migration 101), so this count is the explicit, honest tie between them.
    const focusInRoom = focus.skills.filter(
      (s) => roomIdForSkillGroup(s.skillGroup as SkillGroup) === weakestRoom.id
    );
    const focusBridge =
      focusInRoom.length > 0
        ? ` · ${focusInRoom.length} of your ${focus.skills.length} dashboard focus ${
            focusInRoom.length === 1 ? "skill sits" : "skills sit"
          } here`
        : "";
```

Then change the `evidence` line of the `room_weakness` push (currently line 483) from:
```typescript
      evidence: `Avg ${weakestRoom.grade ?? "—"} across ${weakestRoom.assessed} assessed${tagPart}${conf}.`,
```
to:
```typescript
      evidence: `Avg ${weakestRoom.grade ?? "—"} across ${weakestRoom.assessed} assessed${focusBridge}${tagPart}${conf}.`,
```

- [ ] **Step 3: Typecheck**

Run: `cd unlock-web && npx tsc --noEmit`
Expected: no new errors. Confirm `focus.skills[n].skillGroup` is typed `string` (it is — see `FocusSkill` in `team-home-data.ts`, `skillGroup: string`), hence the `as SkillGroup` cast.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dashboard/team-scouting-data.ts
git commit -m "feat(scouting): bridge clause tying the weakest-room read to dashboard focus skills"
```

---

## Task 5: Docs + build status

**Files:**
- Modify: `unlock-web/docs/ACTION_LAYER_SPEC.md` (note the timed-exclusion reversal)
- Modify: `/Users/taylorpangilinan/Downloads/qb_supabase_database/CLAUDE.md` (add a Shipped entry)

- [ ] **Step 1: Annotate the timed decision in ACTION_LAYER_SPEC.md**

Find the section in `unlock-web/docs/ACTION_LAYER_SPEC.md` that states timed benchmarks are excluded from the team skill ranking (grep: `grep -ni "timed" docs/ACTION_LAYER_SPEC.md`). Add a dated note directly beneath it:
```markdown
> **Update 2026-06-07 (migration 101):** Timed is no longer excluded. The team
> focus ranking and the scouting report now both roll up from
> `v_player_drill_score` (cohort-relative timed included) so the two surfaces
> cannot name contradictory gaps. See `2026-06-07-gap-reconciliation-design.md`.
```

- [ ] **Step 2: Add a Shipped entry to the project CLAUDE.md**

In `/Users/taylorpangilinan/Downloads/qb_supabase_database/CLAUDE.md`, under "### Shipped", append:
```markdown
- **Web Build 10 — Gap reconciliation** (2026-06-07): Dashboard "This Week's Focus" and scouting "This Week's Read" no longer disagree on team gaps. New `v_player_drill_score` base (migration 101) unifies the two scored bases — both now roll up from one per-(player,drill) view incl. cohort-relative timed (reverses the migration 98/99 timed exclusion on the dashboard). `v_team_abs_latest` dropped. Dashboard focus rows show a skill-area tag using the same `skillAreaLabel()` the scouting rooms use; scouting headline gained a "N of your 3 dashboard focus skills sit here" bridge clause. Branch: `build-10-gap-reconciliation`.
```

- [ ] **Step 3: Commit**

```bash
git add unlock-web/docs/ACTION_LAYER_SPEC.md
git -C /Users/taylorpangilinan/Downloads/qb_supabase_database add CLAUDE.md
git commit -m "docs: record gap reconciliation (migration 101 + UI bridges)"
```
(If `CLAUDE.md` is in a different repo/worktree than the staged docs, commit each in its own repo.)

---

## Task 6: End-to-end verification (run the app, compare both surfaces)

**Files:** none (manual verification — this project validates UI by screenshot, see memory `feedback_screenshot_driven_debugging`).

- [ ] **Step 1: Start the dev server**

Run: `cd unlock-web && npm run dev`
Expected: server on `http://localhost:3000`. If a stale build misbehaves after the branch switch, `rm -rf .next` and restart (memory: stale `.next` after merges).

- [ ] **Step 2: Compare the two surfaces for the test team**

Open `http://localhost:3000/dashboard/team/5608bb33-83e1-49ac-a3d3-7397b4b5c7e1` and `…/benchmarks`.
Expected:
- Each dashboard focus row shows a skill-area pill ("Defensive skills" / "Football IQ" / etc.).
- The scouting headline reads "<Room> is your weakest room — <area> is the gap" with "· N of your 3 dashboard focus skills sit here" when applicable.
- The skill area named on a dashboard focus row matches the area language used in the scouting weakest-room/room cards — no contradiction. The "Defense room" weakest group should correspond to where the dashboard's defense-group focus skills sit.

- [ ] **Step 3: Confirm the unlock/empty state copy**

If the test team has signal, temporarily check a team with no benchmarks (or read the code path): the `WeeklyFocusCard` unlock copy now mentions timed drills. Expected: no reference to timed drills "not ranking" gaps.

- [ ] **Step 4: Final commit (if any verification fixups were needed)**

Only if Step 2/3 surfaced a fix. Otherwise this task closes with no commit.

---

## Self-review notes (author)

- **Spec coverage:** Section A → Task 1. Trust criterion ("can't contradict") → Tasks 1+2. Section B skill+group tag → Task 3 (drill-to-fix already shipped in `FocusSkillRow`; noted, not rebuilt — DRY). Section C headline reconciliation → Task 4. Non-goals respected (no room-card redesign, hero `0.0%` stat untouched, no mobile). Consistency landmines from the timed reversal (unlock copy, loader doc comment, ACTION_LAYER_SPEC) → Tasks 3 & 5.
- **Shared helper:** `roomIdForSkillGroup` defined once in Task 3, reused in Task 4 (no duplication).
- **No placeholders:** every code step shows full code; SQL verified by result-checking queries (no SQL test harness exists).
- **Type consistency:** `skillAreaLabel(group: SkillGroup)` and `roomIdForSkillGroup(group: SkillGroup)` both take `SkillGroup`; `FocusSkill.skillGroup` is `string`, cast at both call sites.
- **Cross-links (subtle, spec §C item 3)** were scoped out of the task list to keep the change focused on the contradiction itself; if desired, add a follow-up linking each focus skill to its scouting room. Flagged here rather than silently dropped.
