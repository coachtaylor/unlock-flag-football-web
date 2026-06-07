# Team Scouting Report (Web) — Spec + Architecture

**Product:** Unlock Flag Football — Coach MVP · **Surface:** Web (`unlock-web`)
**Status:** P0 built (2026-06-06) · Phase 3 side sheet + Phase 4 writes built (2026-06-06) · **Created:** 2026-06-06

> **Build note (Phase 3/4):** The side sheet reuses the roster player page's
> `PlayerHistory` + `PlayerSkillProfileCard` + the new shared `ObservationsFeed`
> + the §3 atoms, fed by a new canonical `lib/benchmarks/player-history.ts`
> (`buildPlayerHistory`, extracted from the roster page so both surfaces share
> one benchmark→history transform). Per-player evidence is pre-loaded by the
> loader (no fetch-on-tap). Writes (`addPlayerNote`, `correctBenchmarkResult`)
> live in the route `actions.ts`, gated via the new `getTeamAccess` +
> `canManageTeam` helpers. The BenchmarkLogClient widget reuse (D-row in §5)
> was intentionally NOT taken — those widgets are welded to the capture flow's
> state model and the legacy `--color-*` palette; a lean UFF correct-editor in
> the sheet avoids dragging that palette in.
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

> **As-built note:** the implementation reframed §1 from a flat skill-category
> heat map into **position rooms** (QB/Receivers/Defense) — players graded only
> on position-relevant skill groups — per a mid-build product correction. §0–§3
> were inlined into `scouting/ScoutingSections.tsx` + the page rather than the
> per-file split named below; the loader is `team-scouting-data.ts`. `Spark`
> reuse became reuse of the roster page's `BenchmarkProgressChart` via the
> shared `PlayerHistory`.

**Phase 1 — Data layer (unblocks all)** ✅ DONE
1. ✅ `team-scouting-data.ts` loader; one `Promise.all`; JS aggregation; reuses `loadTeamFocus`.
2. ✅ `heat-scale.ts` (both absolute/relative modes via `SCOUTING_HEAT_MODE`).
3. ✅ `lib/benchmarks/metrics.ts` (canonical value-semantics) consolidated; `initialsOf`→`initialsFor`.
4. ✅ Position mapping (`skillGroupsForPositions` / `POSITION_ROOMS` / `roomForPrimaryPosition`) in `lib/drills/skill-groups.ts`.

**Phase 2 — Static sections** ✅ DONE
5. ✅ `page.tsx` — access gate copied verbatim; `Promise.all([loadTeamScoutingData, loadSidebarWorkspaces])`; `TeamSidebar active="benchmarks"` + `DashTopBar`; cold-start hero + `DoThisNext` CTA.
6. ✅ §0 `ScoutingHeadlineCard`, §1 `PositionRooms`, §2 `MovementStrips`, §3 `PlayerCardFace`/grid — all in `scouting/ScoutingSections.tsx`.

**Phase 3 — Side sheet (P0 read)** ✅ DONE (2026-06-06)
7. ✅ `scouting/PlayerScoutSheet.tsx` — right drawer, conditional mount, pre-loaded data (no fetch-on-tap). Reuses roster `PlayerHistory` (trend) + `PlayerSkillProfileCard` (skill grid) + shared `ObservationsFeed` (observations) + §3 atoms. Corroborating tags + group pills + overall grade in header.
8. ✅ `scouting/ScoutingPlayers.tsx` client island owns `selectedPlayerId`; §3 cards are tappable.
9. ✅ **DRY foundation:** extracted `lib/benchmarks/player-history.ts` (`buildPlayerHistory`) — one benchmark→history transform now shared by the roster page (rewired; inline copy deleted) and the sheet. `ObservationsFeed` extracted from the roster page too.

**Phase 4 — Writes (P1)** ✅ DONE (2026-06-06)
10. ✅ route `actions.ts` `addPlayerNote` → `player_notes` insert + `router.refresh()`.
11. ✅ `correctBenchmarkResult` → updates value cols; surfaced as a type-aware inline editor on the sheet's "Recent results" list. **BenchmarkLogClient widget reuse intentionally dropped** (welded to capture-flow state + legacy `--color-*` palette; a lean UFF editor avoids the palette pollution). Both actions gated by new `getTeamAccess()` + `canManageTeam()`.

**Phase 5 — Polish (P1)** ✅ (2026-06-06, uncommitted; tsc clean, no new lint)
12. ✅ `loading.tsx` skeleton — scouting `loading.tsx` mirrors the §0→§3 spine. **DRY:** extracted shared `components/dashboard/Skeleton.tsx` (`Skel`/`SkelStyles`/`SidebarSkeleton`/`TopbarSkeleton`/`SectionHeadSkeleton`) and refactored the Build-7 team-dashboard `loading.tsx` onto it (was an inline-local `.td-skel` shimmer — now one source, `.uff-skel`).
13. ✅ `?focusSkill=` threaded `practice/new` → editor. `edit/page.tsx` resolves the skill name + the team's drills that train it (reuses the `drill_skills` inner-join scope from team-home-data), marks `DrillCatalogEntry.trainsFocus`; the drill picker floats focus drills first, shows a "Planning focus: <skill>" banner + a "trains <skill>" chip. No hard filter (full library stays browsable). Honest empty state when no library drill is tagged to the skill.
14. ✅ Legacy `(app)/benchmarks` demoted to a redirect → new scouting page (auto-routes only when the team is unambiguous, else `/dashboard`; no "first team" guess). The now-dead hub/log/complete files flagged for a focused deletion task (not removed mid-pass).

---

## 10. Acceptance criteria

**P0**
- [x] Route `(workspace)/dashboard/team/[teamId]/benchmarks` gated by the team access model (member + league-admin fallback).
- [x] §0 computes weakest **room** + top corroborating tag + biggest gain from reused loaders; renders planner CTA.
- [x] Every room/group cell shows an A–F grade; no cell relies on color alone; scale uses zero of the 8 player swatches (`heat-scale.ts` palette isolated).
- [x] Heat helper supports absolute AND relative via a mode flag.
- [x] §3 cards open a side sheet (no accordion layout shift); avatars muted; trend shows arrow+delta.
- [x] Cold-start hero + per-section sparse/locked states render; never a broken/empty chart.
- [ ] Spot-check: a team/category figure here equals the dashboard's for the same team. *(pending — needs an authed visit with real data; not yet visually verified)*

**P1**
- [x] Add note from the sheet (`player_notes` insert via `addPlayerNote`).
- [x] Edit/correct a result inline from the sheet (`correctBenchmarkResult`, type-aware editor).
- [x] §4 / §0 deep-link the planner with `?focusSkill=` prefilled — **and the editor's drill picker now consumes it** (focus drills first + banner/chip; Phase 5 #13).
- [x] Sidebar points here (`TeamSidebar` Benchmarks → team-scoped route). Legacy `(app)/benchmarks` **demoted to a redirect** (Phase 5 #14).

**Verification status (2026-06-06):** `tsc --noEmit` clean · `eslint` clean on
all touched files · route returns 307 (gate runs) · client-imported shared
components confirmed server-only-free (RSC boundary sound). NOT visually verified
with real data (auth-gated; proxy short-circuits unauthenticated requests).

---

## 11. Risks

1. **Number drift vs dashboard** → mitigated structurally by D2/D5 (shared loaders + extracted `computeMovers`).
2. **Heat framing demoralizes** (relative = wall of red) → D6 ships both, decide on real data; absolute is the safer default.
3. **Data sparsity early** → cold-start hero + per-section locked-insight, never broken charts.
4. **Palette collision** → heat scale never imports `team-colors`; grade letter carries meaning.
5. **Scope creep into edit flows** → all writes are P1; P0 ships read + cold/sparse states.
6. **Legacy `(app)/benchmarks` coupling** → P0 leaves it intact (reachable by URL); demotion is P1.

---

## 12. Coaching-lens redesign — verdict-first, confidence-gated (2026-06-06)

> Triggered by a design critique of the live page (real/seed data, side sheet
> open). The P0–P1 build is structurally sound but reads as a **stats profile,
> not a scouting report**: it enumerates instead of concluding, scores
> absolutely instead of by role, and renders sparse/noisy data with the full
> authority of a finished assessment. This section is the redesign that makes it
> a coaching *decision* tool. We walk it slice by slice and check items off here.

### 12.1 Diagnosis (why this changes)
1. **Presents noise as signal (credibility killer).** A `0.4/5 (n2)` weakness and
   `needs reps 53×` tags read as verdicts. The n-badges exist but nothing
   downstream changes weight by confidence → a 2-drill read looks like a 5-drill
   read. A coach distrusts the whole page.
2. **Enumerates instead of concludes.** Six bars + five tags + a letter, and the
   coach has to synthesize — which is the one job the tool exists to do.
   "Top skills: 3.0" invents strengths for a player whose own anchor (3 =
   "inconsistent") says he has none.
3. **Absolute, not role-relative.** A "D" means nothing without "vs. whom?" The
   scouting question is "is Marley our *worst receiver*, or is the whole WR room
   a D?" — a cohort rank, not an absolute grade.
4. **Color encodes identity where it must encode performance.** Skill bars fill
   with the skill-GROUP color → weaknesses render green. (Covered in §6/critique.)

### 12.2 Principle
**Every surface resolves to `Claim → Confidence → Evidence → Action`.** That is the
unit, at both altitudes: per-player (verdict header) and per-team (the 2–3
decisions a captain makes this week). Lead with the conclusion; the bars/tags/
history move *below the fold* as the backing a skeptical coach can verify.

### 12.2a NON-NEGOTIABLE: valuable at practice 1 AND at high volume
This is the product's core "tiered data entry / locked insight" principle applied
here: **the page must deliver value from the very first benchmark, and get richer
with volume — never gate all value behind high volume.** Confidence tiering does
NOT hide low-volume data; it changes the *claim type*. There is always a unit of
value:

| Data | Claim type | Surface that carries it |
|---|---|---|
| **1 entry** | **Measurement / comparison** ("fastest 5-10-5: Steph 4.8s; Marley slowest 5.6s") | benchmark history (single point) + per-drill ranking |
| **2 entries** | **Direction** ("Steph −0.3s") | §2 Movement |
| **3+ entries** | **Verdict** ("reliable weakness: change of direction") | skill profile (gated) |

What gating stops is calling a **verdict** off one drill — it never hides the
**number**. A practice-1 coach still sees real measured results and a team
ranking on each drill; only the skill *abstraction* (composite strengths/
weaknesses) waits for ≥3 drills. Early reads render their **heat-colored number
(dimmed)** — a 0.4 reads "tentatively weak" from rep 1, useful, just provisional.
Copy is value-forward ("here's what you've measured so far… keep benchmarking to
lock it in"), never "not enough data."

**Build rule:** every surface must define its `1 / 2 / 3+` behavior. A surface
that's blank or useless at practice 1 is a bug, not a sparse state.

### 12.3 Architecture (scoring + synthesis layer — NO new SQL views)
| Capability | How | Reuse / New |
|---|---|---|
| **Confidence tiering** — every score is `no-read` / `early` (1–2 drills) / `reliable` (3+) | drive off `drill_sample_size` (already in `v_player_skill_profile`) + bench counts | reuse data, **new** ~15-line `lib/benchmarks/confidence.ts` (mirrors the AI-engine activation thresholds) |
| **Claim gating** — never crown "top skill" / condemn "needs work" from `early` data; show locked-insight instead | `reliable`-only filter before the strengths/weaknesses split | **new** gate in `PlayerSkillProfileCard`; reuses the locked-insight pattern |
| **Role-relative grade** — "D" → "bottom of the WR room" / percentile in cohort | per-primary-position cohort distributions computed in the loader (data already fetched) | **new** cohort pass in `team-scouting-data.ts` |
| **Per-player synthesis claim** — weakest *reliable* relevant skill + top corroborating tag + recommended drill | this is `loadTeamFocus`'s logic at player scope | **reuse** `loadTeamFocus`, scope to one player |
| **Honest empty states** — "not enough reps to grade Marley as a receiver" | falls out of the tier check | **new**, trivial once tiering exists |
| **Heat = performance, group = identity dot** | `scoreToHeatColor(composite)` for the bar fill | **reuse** `heat-scale.ts` |

**Keystone = confidence tiering.** It's small and it cascades: fixes the
noise-as-signal problem, kills the fake "top skills," and produces the honest
empty states for free. Build it first.

**Grading decision:** pair absolute + relative. *Absolute* (heat + 1–5 anchor) =
"is he good?"; *relative* (cohort rank) = "is he our problem at this position?"
Show absolute as the grade, relative as the context line.

### 12.4 Build slices (walk + check off)

**Slice 0 — Data sanity** ✅
- [x] Confirmed: live team **Purple F. (5608bb33…) is the demo seed** (`SEED_demo_team_data.sql`). High tag counts = seed simulating many weeks (not real-team noise). **Tags are score-derived** (`needs reps` ⇐ score<0.5, `inconsistent` ⇐ rated≤2…), so number+tag can't disagree in seed — the corroboration story holds only vs. *live* data. No seed fix needed; confidence tiering (Slice 1) is the right honest layer either way.

**Slice 1 — Confidence tiering + claim gating (the credibility unlock)** ✅ (2026-06-06, uncommitted; tsc/eslint clean)
- [x] `lib/benchmarks/confidence.ts` — `confidenceTier(sampleSize)` + `RELIABLE_MIN=3`/`EARLY_MIN=1` + `tierLabel` + `drillsToReliable`.
- [x] `PlayerSkillProfileCard`: strengths/weaknesses called from `reliable` (≥3 drills) only; split only when ≥4 reliable (else a flat "Reliable reads" list); `early` (1–2 drills) shown as "Early reads · building confidence" with their **heat-colored number (dimmed)** so a 0.4 still reads tentatively-weak at practice 1; value-forward copy ("here's what you've measured so far…"), never "not enough data". *(practice-1 correction per §12.2a)*
- [x] Skill bars: fill heat-colored by score (`scoreToHeatColor`) — weaknesses now read red, not green; group color demoted to the dot; 3.0/5 "inconsistent" midpoint tick on every track.
- [x] Tag pills: `MostTagged` sizes pills by frequency (font/weight/opacity scale to max count) so the loudest, most-defensible signal reads loudest and one-offs recede.

**Slice 2 — Verdict header (synthesis, not enumeration)** ✅ (2026-06-06, uncommitted; tsc/eslint clean)
- [x] Loader: `buildVerdict()` per card — `dataState` ladder (none/measurement/direction/verdict) from reliable skills + benchmarkCount; `roleRead` from grade; weakest reliable skill as the gap + top tag; computed from card evidence (no extra round trip). *(Used card-scoped skill/tag evidence rather than per-player `loadTeamFocus` — same synthesis, no N calls.)*
- [x] Sheet `VerdictHeader` at top — **volume-aware**: `verdict` → gap claim + `Plan <skill> work` CTA; `measurement/direction` → "Measured N skills… strongest so far X (early)… reads lock in at 3 drills"; never blank. Accent weight only for a real verdict.
- [x] Detail (group pills/tags/skill profile/history) renders below the header.

**Slice 2b — Per-drill team comparison (the practice-1 payoff)** ✅ (2026-06-06, uncommitted)
- [x] Loader: `drillLeaderboards` — latest value per player per drill, ranked by `better` direction, drills with ≥2 players, best-covered first.
- [x] `DrillLeaderboards` section on the page (between Movement and the player grid) — ranked rows (rank · avatar · name · pos · value), leader accented, "lower/higher is better" + "N assessed", capped at 6 with "+N more". Pure measurement — works from one session.

**Slice 3 — Role-relative context** — *degrades by volume* ✅ (2026-06-06, uncommitted; tsc/eslint clean)
- [x] Loader: `RelativeStanding` type + cohort post-pass. Cohort = the position **room** (primary position → QB room / Receivers / Defense). Among **assessed** room members, rank by `overallScore` (best→worst), assign `tier` (top/upper/middle/lower/bottom) + `rank`. Gated by `COHORT_MIN=3` — thinner rooms keep `relativeStanding=null` (absolute grade alone), mirroring confidence-tiering at cohort scope. *(Scoped to OVERALL standing — the "bottom of the WR room" read; per-group relative deferred as it'd clutter the card. Mutates the same card objects held in cardsByRoom.)*
- [x] Shared `RelativeStandingLine` atom in `ScoutingSections` — "Bottom of the Receivers · 3rd of 5 assessed", qualitative position tinted by signal (low-in-room = attention `SIGNAL_BAD`, high = `SIGNAL_GOOD`), rank detail muted. Rendered on the §3 card face (under the weakest/benchmark line) and in the sheet header (under the absolute grade, before the verdict). *(DRY: extracted `SIGNAL_GOOD`/`SIGNAL_BAD` consts — the §2 movement colors were inline ×3 — and reused them here; one source so movement + standing never drift.)*

**Slice 4 — Page-level decisions (team altitude)** — *volume-aware* ✅ (2026-06-06, uncommitted; tsc/eslint clean)
- [x] **Coverage-aware rooms (§1):** `RoomCell` gains `gradeReliable` (assessed ≥ `COHORT_MIN`=3 — the SAME threshold as the §3 cohort gate, one constant) + `toReliable`. `PositionRooms` suppresses the letter grade below reliable and shows coverage instead: locked → "Run a benchmark to unlock"; thin w/ headroom → "Assess N more to grade" (accent); thin & fully-covered small room → "Only N in this room". A thin room can no longer masquerade as a graded room. `weakestRoom` (headline/DoThisNext) now filters `gradeReliable` too, so DoThisNext degrades honestly.
- [x] **§0 reframed to 2–3 team decisions:** `TeamDecision` type + `buildTeamDecisions()`. Lead = weakest **reliably-graded** room → drill (`room_weakness`), or at low coverage an honest `coverage` nudge ("benchmarked 4/15 — here's where they stand; assess N more {room} players to unlock that room's read", points at the per-drill standings below). Plus `depth_risk` (QB room ≤1 assessed → "no backup read") and `shared_gap` (≥3 assessed players share a weakest group → one block lifts many). Each renders Claim → Evidence → Action; lead gets the full CTA button, secondaries a hairline + text-link (visual hierarchy, not 3 competing buttons). `ScoutingHeadlineCard` now takes `decisions` + `canManage`; biggest-gain stays as a progress-proof footer. Report cards remain the drill-down.
- *Scoped:* decision CTAs all route to the planner (with `focusSkill` where a skill maps); `depth_risk`/`shared_gap` use generic planner (group-level gap doesn't map 1:1 to a skill id). §4 "Do this next" left as the closing reinforcing CTA (not removed). Per-group relative + multi-room depth risk deferred.

**Slice 4.1 — Grade-from-1 + disambiguation + room CTAs (product correction, 2026-06-06; tsc/eslint clean)**
Triggered by live review: the QB room (1 player) showed no grade, and rooms read "Defense · Weakest: Offense" (a skill-group/position-room name collision *and* a two-way-player leak). Realigned to the §12.2a "show the number" rule:
- [x] **Grade from the first assessment.** Room grade now shows whenever ≥1 player is assessed; `ROOM_RELIABLE_MIN` (3) only flips it to a **`provisional`** marker (1–2 players), never hides it. Split the old single `COHORT_MIN` into `STANDING_MIN` (relative rank — still needs ≥3, you can't rank one player) vs `ROOM_RELIABLE_MIN` (absolute-grade confidence). Grading ≠ ranking. `pickWeakestRoom()` (prefers reliable, falls back to weakest graded + provisional flag) shared by §0 + headline/DoThisNext.
- [x] **Disambiguate skill-area vs position-room names.** New single-source `skillAreaLabel()` in `skill-groups.ts` → "Athleticism / Offensive skills / QB skills / Defensive skills / Football IQ". Used for `GroupScore.label` (player pills), room weakest, and all decision text, so "Defense room · weakest: Defensive skills" can't be misread as a position.
- [x] **Scope each room's weakest to its OWN skill groups** (athletic + iq + signature) — a two-way player's off-position score can no longer mislabel a room (the Defense room can't read "weakest: offense").
- [x] **Per-room context + CTA (data-storytelling).** Each room card is now Claim (room + grade) → Evidence (`N/M assessed` + provisional tag) → weakest area → **Action** (`Plan <area> →`, deep-links the planner via the room's `ctaFocusSkillId` = a team focus skill in the weakest group).

> **As we complete each box, check it here and note the commit.** Slices are
> independently shippable on `build-8.7-benchmark-scouting`.
