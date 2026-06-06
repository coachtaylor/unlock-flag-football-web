# Slice 1 — Coach Dashboard Action Layer

_Status: spec / not started. Branch: `build-N-action-layer` (one commit, per convention)._

## Context

The coach dashboard surfaces 12 widgets. An audit found **11 are purely descriptive**
(a number, a chart, a sparkline) and only the Drill Mix "underweight" warning is even
faintly prescriptive — and it's text with no button. A coach opening the app before
practice can't see **what to work on** or **who needs attention**. This matches the #1
complaint in the flag-football coaching market: tools show data, not decisions
("~70% of dashboard metrics never drive a decision").

A live data check (`cclkmoczomakkxfvavkw`, 2026-06-05) exposed the real root cause —
not a surfacing bug, not the wrong lens, but a **collection-vs-insight mismatch**:

| signal | count | seen by `v_player_skill_profile`? |
|---|---|---|
| rated (1–5) | 5 | ✅ |
| made/attempts | 10 | ✅ |
| **timed** | **38** | ❌ ignored ("timed normalization deferred", migration 66) |
| empty | 0 | — |

Roster: 13 active players, 10 benchmarked, 18 published drills, 28 drill→skill tags,
2 practice logs, 44 attendee rows. **The engine runs on 15 of 53 benchmarks; 72% of
captains' logging effort (timed) is invisible to the insight layer.**

### Design truth that constrains the focus card
- **Rated (x/5) and made/attempts (made÷attempts) are absolute** → comparable across
  skills → can answer *"which skill is the team weakest at"* (the thesis insight).
- **Timed has no absolute reference.** Normalizing times within the team is circular
  (every drill's team mean collapses to ~0.5). Timed can answer *"which **player** is
  slowest at drill X"* and *"is this player improving"* — **not** team-skill ranking.

→ **Team-weakness ranking is sourced only from absolute signal. Timed feeds
player-level widgets (needs-attention, movers).**

## Slice 1 scope — two prongs

### Prong 1 — Make timed data count + a clean team-focus source (DB)

**1a. Add timed normalization to `v_player_skill_profile`** (canonical view,
`qb_supabase_full_package/sql/66_skill_taxonomy_schema.sql`, lines 211–242).
Extend the `latest_results` CTE so a timed result gets a cohort-relative score, gated
to avoid noise. Keep one source of truth — do **not** re-derive in JS.

```sql
-- per (team, drill) cohort over the 90-day window:
--   score_timed = (cohort_max - t) / nullif(cohort_max - cohort_min, 0)
-- only when >= 3 distinct players have a time on that drill (else null → excluded)
-- final score = coalesce(rating/5.0, made/attempts, score_timed)
```
This nearly 4×'s the engine's fuel (15 → up to 53) for **player-level** composites.

**1b. New view `v_team_skill_focus`** — team weakness ranking from **absolute signal
only** (rating/5 + made/attempts; timed excluded here by design). One row per
(team, skill):
- `avg_score` (0–1), `players_with_signal` (distinct), `drill_count`, `last_signal_date`
- gate: `players_with_signal >= 3`; order ascending = weakest first.

**1c. Prescription join** (can live in the data layer or a view
`v_team_focus_recommendations`): weakest skills → published `team_drills` tagged with
that skill via `drill_skills` (weight desc), excluding drills overused in the last
~28 days (`vw_drill_usage`), limit ~3 per skill.

### Prong 2 — The Action Layer (frontend)

Data layer: `src/lib/dashboard/team-home-data.ts` (extend `loadTeamDashboard`).
Page: `src/app/(workspace)/dashboard/team/[teamId]/page.tsx`.
Widgets: `src/components/dashboard/widgets/`.

**2a. New `WeeklyFocusCard.tsx`** — the hero answer, top of the grid.
- Top 1–3 team skill gaps from `v_team_skill_focus`, each with its recommended drills
  (Prong 1c) and a primary CTA **"Add to practice plan"**.
- CTA deep-links the existing editor with the drill preselected (e.g.
  `…/practice/new?drill=<id>` or nearest draft `…/practice/[id]?addDrill=<id>`).
  **Save flows through `replace_practice_plan_blocks`** (`src/lib/practice/actions.ts`,
  `src/components/practice/EditorClient.tsx`) — no new insert path. The `[id]` route
  already reads `searchParams`.

**2b. Upgrade `NeedsAttentionCard.tsx`** — keep existing stale/absent/declining rules
(already computed in `team-home-data.ts`) but give each row a **contextual** CTA
instead of a generic link to `/roster`:
- stale (no benchmark 14d+) → **Run benchmark** (player preselected)
- declining (rating/score dropped) → **Coach this** → the drill that trains the weak skill
- absent (missed last 2) → **Mark / message** (uses `practice_plan_attendees`)
Add an `action: {label, href}` field per row in the data layer.

**2c. Conditional top-strip CTAs** (replace always-on topbar buttons as the primary path):
- no upcoming practice within N days **and** cadence low → **Plan this week's practice**
- compute `needsPractice` / `cadenceLow` in `team-home-data.ts`.

**2d. Honest low-data states (critical — designs for the data you actually have).**
When `v_team_skill_focus` returns no skill with ≥3 players (today's reality), the
WeeklyFocusCard shows a **pointed unlock**, not an empty box:
> "You've logged 38 timed results but only 15 skill ratings. Rate players on 3 skill
> drills to unlock your weekly focus." → CTA: **Start a skill benchmark**.

This turns the dashboard itself into the fix for the collection mismatch.

## Out of scope (later slices)
- **Slice 1.5 — collection funnel:** make rated skill assessments the default/low-friction
  path in the benchmark logging flow (the real fix for 5-rated-vs-38-timed).
- **Slice 2 — player goals/targets** (`player_goals` table) → "X away from goal" CTAs.
- **Slice 3 — rating calibration** (inter-rater spread) — moot until rated volume grows.
- **Slice 4 — game/scrimmage results** module → feed outcomes into the focus engine.
- AI insight engine (natural-language "why") — a later quality upgrade on top of the
  rules-based engine, not a prerequisite.

## Verification
- **DB:** apply 1a/1b on a Supabase branch (or local). Sanity queries:
  `select * from v_player_skill_profile where team_id=<t>` (row count should jump as
  timed lights up); `select * from v_team_skill_focus where team_id=<t> order by avg_score`.
  Note: the app-wired MCP token is read-limited — run via dashboard SQL editor or a
  service-role connection.
- **Frontend:** `npm run dev` in `unlock-web/`, open `/dashboard/team/<teamId>`.
  Confirm: WeeklyFocusCard renders the low-data unlock today; NeedsAttention rows show
  contextual CTAs; "Add to practice plan" deep-links the editor with the drill loaded
  and saves via `replace_practice_plan_blocks`.
- Seed 3+ rated benchmarks on one skill to confirm the focus card flips from unlock
  state to a real ranked gap + drill recommendations.

## Conventions
- One commit on `build-N-action-layer` (multi-file vertical slice).
- Tokens only — `.w-card` surface, no hex literals. `<Section>` wrappers on any form.
- New attribution/select columns need the schema-drift fallback pattern.
