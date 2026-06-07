# Team Scouting Report (Web) — Spec + Architecture

**Product:** Unlock Flag Football — Coach MVP · **Surface:** Web (`unlock-web`)
**Status:** Planned, not built · **Created:** 2026-06-06
**Companion docs:** `WEB_PRD.md`, `WEB_SYSTEM_DESIGN.md`, `WEB_BUILD_PLAN.md`, `docs/ACTION_LAYER_SPEC.md`

> Completes the **benchmark** slice of the team-scoping work (the orphaned
> `(app)/benchmarks` write flow) by **reframing** it from a capture tool into a
> read-first analytical surface. Reuses the Build 7 dashboard data layer.

---

## 1. The strategic problem (why this page changes)

The current web `(app)/benchmarks` page is a **write flow** ("Run Assessment":
pick drill → pick players → log time/rating/tags). But benchmark *capture*
happens in-person/at practice — nobody runs a stopwatch from a laptop. So on
web the page is **a capture tool with no capture moment → orphaned.**

Meanwhile the data it produces (`benchmark_results`) is the richest signal in
the app, and the Build 7 dashboard only *teases* it (movers, pulses). And the
qualitative context web uniquely captures — `player_notes` observations,
benchmark `tags[]` — lives nowhere near the numbers.

**Decision:** web is the *reflection & planning* surface; mobile/in-person is
*capture*. The benchmark destination on web becomes the **Team Scouting
Report** — the "identify weakness" station of the coaching loop
(`assess → identify weakness → plan → run → log → reassess`).

### Job-to-be-done
> *"When I sit down to plan Sunday's practice, I want a defensible read on where
> my team and each player actually stand — backed by the numbers AND what I
> observed — so I can target the right work and prove we're improving."*

### The differentiating move
**Corroborate the number with the tag.** "Footwork 2.4/5" is ignorable.
"Footwork 2.4/5 *and* 6 captains independently tagged 'needs help with
footwork'" is **defensible** to three calibrating captains. Quant + qual
agreeing is the one thing only web can do (web is where the qual is entered).

---

## 2. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Synthesis hub** = player report cards + team heat map fused with practice feedback | The only direction that uses web's unique qual data instead of re-skinning the dashboard |
| D2 | **Complement** the dashboard by **reusing** `team-home-data.ts` (`loadTeamFocus`, `loadTeamSkillRadar`) + views `vw_team_strength_weakness`, `vw_player_progression`. **No new SQL views.** Aggregate in JS (roster ~15). | Numbers can't drift across surfaces (DRY, structurally enforced) |
| D3 | **Read-first**, but allow **edit/correct a result** + **add note/tag**. No new-result-from-memory path. | Capture stays mobile; web gets the desk-work corrections awkward on a phone |
| D4 | **Observations source = `player_notes` only**, NOT post-practice log free-text | Post-practice logs are team-level (no player FK); per-player threading needs noisy name-matching. `player_notes` is the semantically correct, already-joined table |
| D5 | **Pragmatic architecture**: extract only `computeMovers` from `team-home-data.ts`; inline the rest | Satisfies DRY without gold-plating a 1,495-line file outside this feature's blast radius |
| D6 | **Heat-scale helper supports BOTH absolute and relative**; framing decided during build with real data | See §6 — absolute (honest) vs relative (always-a-worst) tells a different story |

### Design-critique changes already folded in
- **§0 headline is a self-sufficient answer card with the CTA inside it** → quick-scan never scrolls; the deep arc rewards the planning session.
- **Every heat cell carries an A–F letter grade; color only reinforces** → kills colorblind-failure and the player-swatch palette collision in one move. Heat scale **never imports `team-colors`**.
- **Report cards → tap opens a side sheet** (not accordion) → no layout thrash across 15 players. **Avatars muted** in the report-card zone so grade is the only "meaning" color there.
- **Edit/correct lives inside the sheet**, one level deep → clean read surface, no accidental edits.
- **Movement section leads with regressed/stalled**; risers framed as progress proof.

---

## 3. Goals / Non-goals

### Goals
1. **Drive the plan:** ≥1 in 2 visits ends in a click into the practice planner.
2. **Defensible read:** every surfaced weakness backed by *both* a number and a corroborating tag.
3. **Prove progress:** "are we improving on X?" answerable in <10s for any player/category.
4. **Zero number drift:** figures byte-identical to the dashboard (same data layer).
5. **Retire the orphan:** web benchmark destination becomes read-first.

### Non-goals
1. Running live assessments on web (capture is mobile/in-person).
2. New SQL views / new aggregation math (reuse only).
3. Bulk re-grading or new-result-from-memory.
4. AI insight cards (separate post-MVP initiative).
5. Cross-team / league-wide scouting (single `[teamId]` scope).

---

## 4. Layout = narrative spine (top → bottom)

Each section is one story and **degrades independently** (cold / sparse / populated).

- **§0 Headline answer-card** — computed "so what": weakest category + its
  most-frequent corroborating tag + biggest gain + **primary CTA into planner**.
  Accent card. Self-sufficient for quick-scan.
- **§1 Team heat map** — strength/weakness by skill category. **Grade-paired
  cells** (A–F in every cell). Diverging scale that **never reuses the 8 player
  swatches**.
- **§2 Movement** — since last assessment: **regressed/stalled lead**, risers
  framed as progress proof.
- **§3 Player report cards** — compact grid, **muted avatars**. Tap → **side
  sheet**: trend sparkline (arrow + delta, not color-only) + tags/observations
  evidence + **inline edit/correct & add-note** (P1).
- **§4 "Do this next"** — weakest category → one-click into the practice planner.

**States:** cold-start hero (no data) — a single "run your first assessment"
card, *not* four locked cards. Sparse — per-section locked-insight copy ("Assess
3 more players on a footwork drill to unlock the team gap view"). Populated — the
full arc.

---

## 5. Data map (reuse vs new)

| Need | Source | Reuse / New |
|---|---|---|
| Team heat map by category | `vw_team_strength_weakness` / `loadTeamSkillRadar` | Reuse |
| Weakness + evidence for §0/§4 | `loadTeamFocus` | Reuse |
| Movement deltas (§2) | `vw_player_progression` + extracted `computeMovers` | Reuse (extract) |
| Player report rows + evidence | `vw_player_progression` + `benchmark_results.tags` + `player_notes` | New aggregator |
| Page loader | `lib/dashboard/team-scouting-data.ts` | New (thin) |
| Edit/correct a result | inner widgets of `BenchmarkLogClient` (`TypeCard`/`RatingButtons`/`NumberField`) | Reuse (P1) |
| Add note/tag | `player_notes` insert via server action | New (light) |
| Plan CTA | navigate `/dashboard/team/[teamId]/practice/new?focusSkill=<id>` | Reuse |

**No new SQL views.** ~900 rows all-time at MVP scale → JS aggregation is sub-ms.

---

## 6. The one open product decision: heat scoring (decide during build)

Build the helper to do **both**; pick after seeing real data.

- **Absolute** (recommended default): grade from the documented 1–5 anchors
  (3 = "gets it done" = C). Honest — a strong team reads green; sort by weakness
  to still surface priorities. Won't demoralize or contradict the letter.
- **Relative** (cohort-normalized): `(avg − teamMin)/(teamMax − teamMin)`. Weakest
  category always red. Maximizes "what to work on" framing but a good team sees a
  wall of red.

Helper contract must accept a mode flag so the call site flips it without
touching cell rendering.

---

## 7. Architecture (pragmatic)

### New abstractions worth creating now
1. `lib/dashboard/team-scouting-data.ts` — the loader.
2. `lib/dashboard/heat-scale.ts` — `heatScaleColor(score, mode)` + `heatScaleGrade(score)`. **Single source of truth for heat colors. Never imports `team-colors`.**
3. `PlayerScoutSheet.tsx` — the side sheet.

### The one refactor that pays off (DRY, not gold-plating)
- **Extract `computeMovers(...)`** from inside `loadTeamDashboard` in
  `team-home-data.ts` into an exported function. The dashboard keeps calling it;
  the scouting loader calls it with an all-time slice (vs the 8-week window).
  Prevents a second mover computation that would drift.
- **Consolidate `initialsOf`** into the existing `lib/format/initials.ts` and
  update both call sites in the same commit (5-line fn, already has a peer).
- **Do NOT** extract `aggregateSlice` / `categoryColor` / date constants — no DRY
  benefit here, pure scope.

### Access gating
Copy the ~30-line block from
`(workspace)/dashboard/team/[teamId]/page.tsx` **verbatim**: `team_members` →
`league_members` (`role='league_admin'`) fallback →
`canManage = memberCanManage(role, captain_view_only) || isLeagueAdmin`.
`notFound()` if `!canView`. `canManage` gates write controls only, not visibility.
Do not abstract it (each page's `notFound` call sites vary; abstraction is P2).

### Loader return type (target shape)
```ts
export async function loadTeamScoutingData(
  supabase: SupabaseClient, teamId: string
): Promise<TeamScoutingData>

export type TeamScoutingData = {
  headline: ScoutingHeadline;          // §0
  heatMap: HeatCell[];                 // §1  (avg + grade + color + locked)
  movers: MoverRow[];                  // §2  (movementClass: riser|stalled|regressed)
  players: PlayerReportCard[];         // §3  (composites + recentTags + observations + series)
  focusSkillId: string | null;         // §4 CTA target
  focusDrillSuggestions: { drillId: string; drillName: string }[];
  rosterSize: number;
  anyData: boolean;                    // false → cold-start hero
};
```
Internals: one `Promise.all` of `loadTeamFocus`, `loadTeamSkillRadar`,
all-time `benchmark_results`, `team_players`, `player_notes` (last ~100, with
`practice_plans` join), `vw_team_strength_weakness`. All grading / movement /
card assembly in JS.

### Per-section degradation thresholds (named constants in the loader)
```
MIN_PLAYERS_FOR_HEATMAP = 3      // §1 cell locked below this
MIN_ASSESSMENTS_FOR_MOVEMENT = 2 // §2 needs 2 dates on a (player,drill)
STALE_THRESHOLD_DAYS = 21
```
§0 sparse if minimal data · §1 locked per-cell · §2 empty if no qualifying movers
· §3 card shows avatar+positions only when `benchmarkCount === 0` · §4 hidden if
`focusSkill` is null.

---

## 8. File tree (P0 = one PR · P1 = fast-follow)

```
unlock-web/src/
  lib/
    dashboard/
      team-home-data.ts                      [MODIFY P0 — export computeMovers]
      team-scouting-data.ts                  [CREATE P0 — loader]
      heat-scale.ts                          [CREATE P0 — color/grade helper, both modes]
    format/
      initials.ts                            [MODIFY P0 — export initialsOf; rewire call sites]

  app/(workspace)/dashboard/team/[teamId]/benchmarks/
    page.tsx                                 [CREATE P0 — server: gate + load + shell]
    ScoutingPageClient.tsx                   [CREATE P0 — selectedPlayerId state]
    HeadlineCard.tsx                         [CREATE P0 — §0]
    HeatMapSection.tsx                       [CREATE P0 — §1 grid]
    HeatTile.tsx                             [CREATE P0 — §1 cell]
    MoversSection.tsx                        [CREATE P0 — §2]
    PlayerGridSection.tsx                    [CREATE P0 — §3 grid]
    PlayerCompactCard.tsx                    [CREATE P0 — §3 card]
    actions.ts                               [CREATE P1 — addPlayerNote server action]
    loading.tsx                              [CREATE P1 — shimmer skeleton]

  components/dashboard/
    PlayerScoutSheet.tsx                      [CREATE P0 — read sheet; P1 adds inline edit + AddNote]

  app/(app)/benchmarks/log/BenchmarkLogClient.tsx
                                             [MODIFY P1 — export TypeCard/RatingButtons/NumberField]
```
Also: `components/dashboard/TeamSidebar.tsx` — confirm/add `active="benchmarks"`.

§4 CTA is one `<Link>` — inline in `page.tsx`, no own file.

---

## 9. Build order

**Phase 1 — Data layer (unblocks all)**
1. Extract `computeMovers` from `team-home-data.ts`; dashboard still calls it. Grep for leftover inline defs.
2. Create `heat-scale.ts` (both modes).
3. Create `team-scouting-data.ts` + types; one `Promise.all`; JS aggregation.
4. Consolidate `initialsOf` into `lib/format/initials.ts`; rewire.
5. Sanity: log loader shape for cold-start and populated.

**Phase 2 — Static sections**
6. `page.tsx` — copy access gate verbatim; `Promise.all([loadTeamScoutingData, loadSidebarWorkspaces])`; `TeamSidebar active="benchmarks"` + `DashTopBar`.
7. §0 `HeadlineCard`, §1 `HeatTile`/`HeatMapSection`, §2 `MoversSection` (reuse `Spark`), §3 `PlayerCompactCard`/`PlayerGridSection` (sheet stubbed), §4 inline CTA.

**Phase 3 — Side sheet (P0 read)**
8. `PlayerScoutSheet` — conditional mount, pre-loaded data (no fetch-on-tap), Recharts/`Spark` sparkline, skill mini-grid, tags, observations.
9. Wire `ScoutingPageClient` `selectedPlayerId`.

**Phase 4 — Writes (P1)**
10. `actions.ts` `addPlayerNote` → `player_notes` insert + `router.refresh()`.
11. Export inner widgets from `BenchmarkLogClient`; mount inline in sheet for edit/correct.

**Phase 5 — Polish (P1)**
12. `loading.tsx` skeleton.
13. `?focusSkill=` read in `practice/new` drill picker.
14. Demote/redirect legacy `(app)/benchmarks`; point sidebar here.

---

## 10. Acceptance criteria

**P0**
- [ ] Route `(workspace)/dashboard/team/[teamId]/benchmarks` gated by the team access model (member + league-admin fallback).
- [ ] §0 computes weakest category + top corroborating tag + biggest gain from reused loaders; renders planner CTA.
- [ ] Every heat cell shows an A–F grade; no cell relies on color alone; scale uses zero of the 8 player swatches.
- [ ] Heat helper supports absolute AND relative via a mode flag.
- [ ] §3 cards open a side sheet (no accordion layout shift); avatars muted; sparkline shows arrow+delta.
- [ ] Cold-start hero + per-section sparse states render; never a broken/empty chart.
- [ ] Spot-check: a team/category figure here equals the dashboard's for the same team.

**P1**
- [ ] Add note/tag from the sheet (`player_notes` insert).
- [ ] Edit/correct a result inline from the sheet.
- [ ] §4 deep-links the planner with the category/drill prefilled.
- [ ] Sidebar points here; legacy `(app)/benchmarks` demoted/redirected.

---

## 11. Risks

1. **Number drift vs dashboard** → mitigated structurally by D2/D5 (shared loaders + extracted `computeMovers`).
2. **Heat framing demoralizes** (relative = wall of red) → D6 ships both, decide on real data; absolute is the safer default.
3. **Data sparsity early** → cold-start hero + per-section locked-insight, never broken charts.
4. **Palette collision** → heat scale never imports `team-colors`; grade letter carries meaning.
5. **Scope creep into edit flows** → all writes are P1; P0 ships read + cold/sparse states.
6. **Legacy `(app)/benchmarks` coupling** → P0 leaves it intact (reachable by URL); demotion is P1.
