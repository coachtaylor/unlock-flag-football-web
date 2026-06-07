# Gap Reconciliation — Dashboard ↔ Scouting Report

**Date:** 2026-06-07
**Status:** Approved design, pre-implementation
**Author:** Taylor + Claude (brainstorming session)
**Repo:** `unlock-web`

## Problem

The team dashboard's **"This Week's Focus"** widget and the scouting report's **"Position Rooms"** section name *different* team weaknesses for the same team, in the same week. A coach reading both can't tell what to actually plan practice around — the app appears to contradict itself.

Example (Purple F., Week 24):
- Dashboard: weakest = **Zone Coverage (51%)**, Throw on the Run (52%), Assignment Discipline (57%) — named **skills**.
- Scouting: **Defense** is the weakest room, **Football IQ** is the gap; **Athleticism** shared by 7 players — named **skill groups**.

### Root cause

The two surfaces are **two unsynchronized computations over the same benchmark data**, differing on three axes:

| Axis | Dashboard "This Week's Focus" | Scouting "Position Rooms" |
|---|---|---|
| Unit ranked | individual **skills** | **skill groups** |
| Players averaged | whole team, no position filter | per position room, position-relevant groups only |
| Benchmark types | rating + made/attempts **only — timed excluded** | rating + made/attempts **+ cohort-relative timed** |
| Source view | `v_team_skill_focus` | `v_player_skill_profile` |

Because they run different math on different inputs, matching the wording alone would not durably fix it — a future assessment could re-introduce disagreement. The fix must unify the underlying computation.

### Current code references (pre-change)

- Dashboard widget: `src/components/dashboard/widgets/WeeklyFocusCard.tsx` (`FocusSkillRow`)
- Dashboard loader: `src/lib/dashboard/team-home-data.ts` → `loadTeamFocus()` (~L1185–1306)
- Dashboard view: `sql/99_skill_focus_evidence.sql` → `v_team_skill_focus` (absolute-only, 90d, ≥3 players), built on `v_team_abs_latest`, `v_team_skill_player`
- Scouting section: `src/components/dashboard/scouting/ScoutingSections.tsx` → `PositionRooms`
- Scouting loader: `src/lib/dashboard/team-scouting-data.ts` → `loadTeamScoutingData()` (~L558–1010)
- Scouting view: `sql/98_timed_normalization_team_focus.sql` → `v_player_skill_profile` (absolute + relative timed, per skill_group)
- Taxonomy: `src/lib/drills/skill-groups.ts` (5 groups: `athletic`, `offense`, `qb`, `defense`, `iq`); `skills.skill_group` column

## Priorities (user-stated)

The UX must be **clear**, **actionable**, and **trustworthy** — in that spirit, "trustworthy" is the binding constraint: the two surfaces must be *structurally incapable* of printing contradictory rankings.

## Solution

Direction: **Dashboard leads with skills; Scouting headline is derived from the same ranking; both read one shared projection.** (= "Direction 1 as the spine + one borrowed piece from Direction 2", on top of a unified data spine.)

### Section A — The data spine (single source of truth)

Introduce **one base view** that both surfaces aggregate up from. This is the actual trust fix; B and C are presentation on top of it.

```
v_player_skill   ← NEW single source of truth
  per (player, skill): composite score 0–1, last 90 days,
  absolute (rating/5, made/attempts) + cohort-relative timed
  (reuses the timed normalization already in sql/98)
        │
        ├──►  team skill focus   = avg over players, per skill  → top-3 weakest SKILLS  (Dashboard)
        └──►  group / room score = weighted avg of member skill scores → weakest GROUP  (Scouting)
```

- `v_team_skill_focus` is **refactored to aggregate from `v_player_skill`** rather than from its own absolute-only base.
- The scouting per-group composite is **refactored to roll up from the same per-(player,skill) scores** (group score = weighted avg of its member skill scores).
- Consequence: a group's score is *by construction* the average of the skill scores the dashboard shows. They cannot diverge.

**Decision — new base view, not a narrow patch.** Chosen over merely extending `v_team_skill_focus` to include timed, because the new base view is the real single-source-of-truth and avoids two views drifting out of sync (DRY).

**Accepted tradeoff:** timed drills now influence the **dashboard** focus numbers (today excluded). This is intentional — timed results are real evidence the scouting page already counts; excluding them on the dashboard is itself a source of distrust. Cohort-relative normalization (already built in `sql/98`) keeps timed on the same 0–1 scale so it stays comparable. Some dashboard percentages will shift on ship; this is expected and correct.

**Scope:** one new SQL view + refactor of the two existing views to share it; repoint the two data loaders. No new tables.

### Section B — Dashboard "This Week's Focus" card

Keeps current shape (3 weakest skills, drillable). Two additions:

1. **Room · group tag** per skill row, e.g. `Zone Coverage · Defense / IQ`. The bridge that makes a skill and its group read as the same thing at two zoom levels. Source: `skills.skill_group` + position room mapping (`skill-groups.ts`). No new data.
2. **Drill-to-fix** under each skill (borrowed from Direction 2): the single weakest drill for that skill (already in `v_team_skill_drill`), rendered as a `+ <drill name>` add-to-practice line. Makes gap → Sunday's drill one tap.

Unchanged: "3 team gaps" count, `See the evidence →`, `Build a practice`.

### Section C — Scouting "This Week's Read" headline

Position-room cards, grades, players, movers below stay as-is (the scouting page's real value). Only the **top headline** reconciles:

1. Lead line **derived from the same top-3 focus skills** — e.g. *"2 of your 3 focus skills live in Defense — that's your weakest room."* Cannot name a gap the dashboard doesn't.
2. Rooms/grades keep computing from the spine, so grades are consistent with the focus skills by construction.
3. Subtle cross-links: each focus skill in the read ↔ its drill on the dashboard.

## Non-goals

- Hero `0.0% squad benchmark` stat (separate metric, not part of this mismatch).
- Redesign of position-room cards, movers, donut, attendance, etc.
- AI insight engine.
- Mobile parity (web-first; mobile follows after web validates, per project convention).

## Success criteria

- For any team/week, the gap named in the dashboard focus card and the gap named in the scouting headline **roll up to each other** — never contradict. (Verifiable: scouting headline group ⊇ at least one dashboard focus skill's group; group score = avg of member skill scores within tolerance.)
- Both surfaces read from `v_player_skill` (same window, same benchmark types, same player set). No second projection remains.
- Dashboard focus rows show room · group tag and a one-tap drill-to-fix.
- Coach can go gap → drill in one hop on the dashboard, and gap → "why" in one hop to scouting.

## Open questions

_None at design time. Timed-inclusion tradeoff resolved (include). View strategy resolved (new base view)._
