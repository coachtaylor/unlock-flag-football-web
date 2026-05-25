# Mobile App Reference — for Web Design Work

Last updated: 2026-05-24 (audited against mobile code on this date — `[CONFIRM]` markers resolved, practice blocks + injury tracking added, drill category list corrected, table names verified)
Purpose: A design-friendly tour of what the mobile app does, what's on each screen, how data flows, and what's still missing. Upload this into the Claude.ai web design project so Claude understands the existing product without having to read every source file.

**How to use this doc.** When you're designing a web page, point Claude at the equivalent mobile section here. Web should match mobile's behavior unless there's a specific desktop reason to diverge.

**Status.** Earlier `[CONFIRM]` markers have been resolved against the mobile codebase. Where the doc previously inferred behavior, it now reflects what the code does. The remaining open questions (intentional product decisions for web) are consolidated in section 12.

---

## 1. The product in one paragraph

Unlock Flag Football is a coach/team management tool for flag football captains. The mobile app (React Native, Expo) is the field-facing surface: captains use it at practice to log benchmarks, run practice plans drill-by-drill, take attendance, capture notes, and review team data. The web app (being designed now) is the desk-facing surface: same data, same features, more comfortable for planning and reviewing. Both share one Supabase database, same auth, same RLS — log a benchmark on mobile at practice, see it on the web dashboard at home.

Mobile is currently more complete than web. The mobile app shipped the onboarding flow, league support, the user/league/team dashboard hierarchy, and benchmark capture upgrades. Web hasn't.

---

## 2. Who uses the app

**Primary user: Captain.** A flag football team captain who plans practices, runs benchmarks, and tracks team performance. Captains are usually also players, which is why the product treats "captain" as both a role on the team (admin access) and a row on the roster (so they can be benchmarked).

**Secondary user: Coach.** A team manager who runs practices but isn't on the roster. Same admin access as captain, no `team_players` row.

**Tertiary user: League admin.** Manages multiple teams under one league. Created during onboarding when a user picks "League" as their scope. Can see and edit every team in the league, even teams they didn't personally create.

**Not in the app yet: Players (non-captain).** Players don't have logins. They're name-only records on a team's roster. Could change in the future but out of scope.

---

## 3. The three role types and what they can do

| Role | Where it lives | What they see |
|------|---------------|---------------|
| `league_admin` | `league_members` table | Their league dashboard, all teams in the league, full admin on each |
| `coach` / `captain` / `assistant` | `team_members.role` | Their team dashboard, full admin on that team |
| `captain` (player flavor) | `team_players.is_captain = true` | Same as captain admin PLUS they appear on the roster and get benchmarked |

A single user can hold multiple of these at once: league admin + coach of one team + captain of another. The user dashboard shows all of it cleanly.

---

## 4. Top-level navigation (mobile)

Bottom tab bar with four tabs. Same destinations come back on the web sidebar.

- **Dashboard** (`(tabs)/index.tsx`) — the team dashboard for the current team context
- **Drills** (`(tabs)/drills/`) — the drill library
- **Roster** (`(tabs)/roster/`) — the players list for the current team
- **Practice** (`(tabs)/practice/`) — practice plans for the current team

Outside the tabs but still core to the app:

- **User dashboard** (`/dashboard`) — the post-login home with My Leagues + My Teams sections
- **League dashboard** (`/dashboard/league/[leagueId]`) — list of teams in a league
- **Benchmarks** (`/benchmarks/`) — separate flow, launched from drill detail or the dashboard
- **Settings** (`/settings`) — team selector, profile, sign out
- **Onboarding** (`/onboarding/*`) — gated entry for new users

---

## 5. Onboarding flow (already shipped on mobile)

The full spec is in `WEB_ONBOARDING_LEAGUE_REDESIGN_WORKFLOW.md`. Quick summary:

1. **Name** — first name, last name (required). Updates `profiles.first_name`, `profiles.last_name`, `profiles.display_name`.
2. **Scope** — League or Single Team. Determines the next branch.
3. **Role** (single team branch only) — Coach or Captain. Determines whether the user gets a roster entry.
4. **Create league** (league branch) — name, format (5v5/7v7/both), color. Lands on the league dashboard.
   OR
4. **Create team** (single team branch) — team name, format, color. Lands on the team dashboard. Captains also get a `team_players` row with `is_captain = true`.

Existing users without `first_name` get the `BackfillModal` on next login — same form, one shot, can't dismiss without filling it out.

---

## 6. Screen-by-screen tour

### 6.1 User dashboard — `/dashboard`

Post-onboarding home. Greeting + two sections.

**My Leagues section** (hidden if zero):
- One card per league the user is a `league_admin` of
- Card content: league name, color swatch, team count, member count
- Tap → league dashboard

**My Teams section** (hidden if zero):
- One card per team the user is a member of, EXCLUDING teams already inside one of their leagues
- Card content: team name, color, role badge (Coach / Captain), format, player count, last practice date
- Mobile also surfaces "draft" teams (user-created but not yet linked to `team_members`). The card distinguishes them with a "Draft" badge. 
- Tap → team dashboard

Empty state when zero leagues AND zero teams: centered card, "You're not in any leagues or teams yet. Create one to get started." + two buttons.

### 6.2 League dashboard — `/dashboard/league/[leagueId]`

Header: league name, league color accent, "+ Add team" button (primary CTA).

Body: list/grid of team cards within the league. Each card shows team name, team color, format, player count, coach count, last practice date.

Empty state: "No teams yet. Add your first team to get started."

Adding a team from here routes to the team-creation flow with `leagueId` pre-set, so the user doesn't have to pick a league.

### 6.3 Team dashboard — the home tab when a team is selected

This is the heart of the app. Lots of widgets, all driven by `lib/dashboard.ts`. From what I read in the code, the dashboard surfaces include:

- **Next practice card.** The upcoming practice with date, title, time, status (scheduled / live / completed), duration, and an attendee row (avatars + RSVP count). Tap → practice detail.
- **Pinned pulse (per-drill).** For drills the user has pinned, shows current average (seconds for timed, 1-5 for rated), delta vs previous, and a 6-week sparkline. This is the "what's our team's progression on this drill" widget.
- **Drill mix donut.** Categorical breakdown of what kinds of drills have been run in completed practices (offense, defense, conditioning, footwork, routes, etc.). Center shows total drill completions. Highlights the underweighted category if one exists. Includes a weekly mini-chart.
- **Attendance.** Overall rate (0-100), delta vs prior 4 weeks, 7-practice sparkline, offense vs defense rate breakdown, and a streaks row showing players with the longest attendance streaks.
- **Captain View Toggle** (when the user is a captain). A small pill toggle at the top: "Coach view" (default) or "Player view." Player view shows only their own data.

**Web implication.** The team dashboard is the biggest "desktop wins" page — it's currently a vertical stack on mobile that begs to be a multi-column grid on a laptop. Don't add new widgets; just lay these out responsively.

### 6.4 Drills — `(tabs)/drills/`

**List view** (`/drills`):
- Searchable, filterable by category. The full category list lives in `constants/categories.ts` and is currently **15 categories**, split into "phase" categories (where in a practice this fits) and "skill" categories (what it trains):
  - Phase-style: `offense`, `defense`, `scrimmage`, `warmup`, `conditioning`, `agilities`
  - Skill-style: `footwork`, `routes`, `throwing`, `catching`, `flagpulling`, `pursuit`, `rushing`, `blocking`, `other`
- Drills can be tagged with multiple categories (junction table `team_drill_categories`)
- Each drill shows name, category tags, benchmark types (multi-select — see below), draft/published status
- "+ New drill" button

**Drill detail** (`/drills/[id]`):
- Name, description, category tags
- Setup diagram (the visual SVG of where cones go and how players move)
- Auto-generated setup instructions ("5 cones at 0, 7, 10, 17, 20 yards")
- Equipment list (cones counted from diagram + manual additions like agility ladder, resistance bands)
- Optional source URL (for TikTok/Instagram/YouTube reference videos)
- Benchmark types if set — a drill can have one or more of the following (multi-select, stored as `team_drills.benchmark_types[]`):
  - `timed` — capture seconds (stopwatch or manual entry)
  - `rated` — 1-5 anchored score
  - `reps` — count of completed reps
  - `pct` — made / attempts (the previously unconfirmed "made/attempts" capture — this IS live in MVP, used for things like throwing accuracy or flag-pull rate)
  - `flags` — flag pulls count
  - `drops` — drop count
- "Run benchmark" CTA when at least one benchmark type is set
- Notes history sheet (`DrillNoteHistorySheet`) — surfaces all post-practice notes captains have written about this drill over time. Sourced from `practice_plan_drills.log_note` rather than a dedicated `team_drill_notes` table (no such table exists; the notes live on the practice-plan-drill row itself)
- Draft / Publish toggle

**Drill create/edit form** (`/drills/new`, `/drills/[id]/edit`):
- Standard fields plus the **diagram editor** — interactive SVG of a vertical 25-yard field. Captains place cones (drag to position, snap to yard), draw path segments with movement types (sprint / backpedal / shuffle / jog), label distances. The editor auto-generates the setup instructions from the diagram.

**Web implication.** The diagram editor is the single biggest desktop UX win. Touch-first drag works, but mouse interactions need to feel native (click to place, drag with mouse, right-click for context, Cmd+Z undo).

### 6.5 Roster — `(tabs)/roster/`

**List view**:
- Active players up top, inactive (deactivated) below
- Each row: name, jersey number, positions, color (per-player palette slot)
- Tap → player detail

**Player detail** (`/roster/[id]`):
- `AthleteHero` header: avatar (color from `color_index` slot), name, jersey, positions, eyebrow badge ("Captain", "Injured", or "Injured · Captain")
- Benchmark history (per-drill chart of their performance over time)
- **Observations feed** — chronological list of coaching notes from `player_notes` (not a generic activity timeline). Each row shows note text, practice date, and the practice title it was logged in. These are written during the post-practice log flow (section 6.6, log step). Benchmark logs and attendance do NOT appear in this feed — they have their own surfaces.
- **Injury controls** — "Mark injured" / "Mark healthy" with an inline modal for the injury note (custom branded modal, not native Alert). Sets `team_players.is_injured` + `injury_note`. Independent of deactivation.
- Activate / Deactivate button (separate from injury — deactivation removes from active roster entirely; injury keeps them on the roster but flagged)

**Player form** (`/roster/new`, `/roster/[id]/edit`):
- First name, last name, jersey number, notes
- Positions multi-select from `constants/positions.ts`. Each position has a side (`offense` / `defense`) and a position-specific color used in roster visualizations. QB is sorted to the top of OFFENSE.
- **Captain toggle** (`CaptainToggle` component) — flips `team_players.is_captain`. This is independent from `team_members.role`: a person can be a captain-on-the-roster (gets benchmarked) without being a `team_members` admin, and vice versa. Both flags exist and the product treats them as separate concepts.
- (No injury controls in the form — injury is set from the player detail screen, not the edit form.)

### 6.6 Practice — `(tabs)/practice/`

**A practice plan is two-level: blocks → drills.** This is critical context for web design. A practice is not a flat list of drills; it's an ordered list of *blocks* (e.g., "Warmup", "Routes vs. Coverage", "Scrimmage", "Conditioning"), each with its own target duration, color, and contents. Drills live inside blocks. Water breaks live *between* blocks as top-level positional rows.

**Data shape:**
- `practice_plans` — the plan itself (title, date, time, status)
- `practice_plan_blocks` — ordered blocks within a plan (name, `block_order`, `target_minutes`)
- `team_practice_blocks` — per-team library of reusable block templates (so captains can pull "Warmup" or "Conditioning" from a known set)
- `practice_plan_drills` — drills inside blocks. Each row has `plan_block_id`, `duration_minutes`, `reps_count`, `parallel_group` (drills with the same group run concurrently within the block), `log_note` (post-practice notes), and `run_status` (`planned` → `active` → `done` / `skipped`)
- `practice_plan_breaks` — positional between-block water breaks, anchored by `after_block_order` (`-1..N`)
- `practice_plan_attendees` — RSVP / attendance state (`practice_plan_id`, `player_id`, `attended`)
- RPC `replace_practice_plan_blocks(plan_id, blocks_payload, breaks_payload)` — atomic three-arg replace; validates cross-block parallel groups

**Block colors:** Deterministic from block name via `constants/block-colors.ts`. Four built-in defaults (warmup / drills / scrimmage / conditioning), with an 8-color hashing palette for custom block names.

**Lifecycle:** `draft` → `scheduled` → `live` → `completed`.

**List view** (`/practice`):
- "01 Cadence" tactical layout (date eyebrow + status pill + block summary chips). Past, current, upcoming plans.
- Each card shows date, title, status, block count, total duration, RSVP count.
- Actions per plan: edit, duplicate, delete (duplicate copies blocks + drills + breaks).

**Practice plan detail** (`/practice/[id]`):
- Header: title, date, time, status
- Block cards rendered in order (`PlanBlockCard`): left-rail color, block name, target minutes vs. summed drill minutes, drill rows (with parallel-group grouping), expand-to-see-details
- Between-block water breaks rendered as `TopLevelBreakCard` rows with a `GapZone` insert affordance between blocks
- "Who's coming" RSVP section + roster-table modal for marking RSVP / attendance
- Captain can edit, finalize, or start running

**Practice plan create/edit** (`/practice/new`, `/practice/[id]/edit`):
- Title + date/time live in the header
- Block library sheet (`BlockLibrarySheet`) — pulls from `team_practice_blocks` or creates a new block
- Drill picker per block — pulls from the team's drill library
- Reorder drills within a block via up/down chevrons (NOT drag — drag conflicted with scroll on RN)
- Move drill between blocks via `MoveDrillToBlockSheet`
- Per-drill duration + reps overrides via steppers
- Per-drill cues field (pre-practice coaching points the captain wants to remember)
- Add between-block water breaks
- Save as draft or schedule

**Run practice** (`/practice/[id]/run`) — live in-practice mode. Substantial screen, not a stub:
- Persisted practice timer (count-up, survives backgrounding)
- Independent per-drill stopwatch
- "Now running" hero card (`NowRunningCard`) shows current drill, block context, coach cues, duration target
- Per-drill `run_status` toggle: `planned` → `active` → `done` / `skipped`
- Real-time attendance check-in (writes to `practice_plan_attendees`)
- Inline structured notes per drill — quick-tag chips ("Great rep", "Coaching point", "Sub needed", "Injury check") + free text. Tags persist with the practice-plan-drill row.
- Pause/resume the whole practice
- Advance to next drill

**Post-practice log** (`/practice/[id]/log`):
- Numbered section cards (rebuilt 2026-05-19)
- Per-drill completion toggle (done / skipped) + per-drill post-practice note (`practice_plan_drills.log_note`) — these notes are what flow into `DrillNoteHistorySheet` on the drill detail page
- Per-player observations: free text written against a player, stored in `player_notes`, surfaced on player detail "Observations" feed
- Team performance notes, highlights, areas to improve
- Attendance count (auto-pulled from RSVP/attendance), energy level
- Completing the log moves practice to `completed` status. Data feeds the team dashboard.
- If the user already ran the practice via `/run`, this screen prefills from the live state.

### 6.7 Benchmarks — `/benchmarks/`

This is its own flow, not under the tabs. Launched from a drill detail page (when the drill has a benchmark type set) or from a dashboard quick action.

**Benchmarks hub** (`/benchmarks/`):
- Select the drill(s) to benchmark
- Select the players to include
- Configure: scope (whole team / QBs only / non-QBs only / split QB and non-QB groups), sets per player
- Start the session

**Capture flow** (`/benchmarks/log`):
- Goes player-by-player through the session
- Per drill, per player, per set: capture the metric. Six benchmark types are supported (a drill can have more than one selected):
  - `timed` — stopwatch or manual seconds
  - `rated` — 1-5 anchored score (1 = can't execute, 3 = gets it done, 5 = reliable under pressure)
  - `reps` — rep count
  - `pct` — made / attempts (live in MVP — captures both numbers, dashboard renders the percentage)
  - `flags` — flag-pull count
  - `drops` — drop count
- Capture widgets live in `components/benchmark/CaptureWidgets.tsx`, orchestrated by `CaptureShell.tsx`
- Quick-select tags per player per drill: "good hands," "needs help with footwork," "sharpen route," etc. plus "Other" for free text
- Notes field
- Captain self-assessment guardrail: on `rated` drills, a captain logging themselves is discouraged (per CLAUDE.md product decision — rotate who records)

**Complete screen** (`/benchmarks/complete`):
- Summary: who got benchmarked, on what, what the team learned
- Routes back to the drill or team dashboard

**Web implication.** Benchmarking is a field activity. The mobile flow is fast and one-handed. The web version exists for completeness (so a captain reviewing data at home can correct a typo) but probably doesn't need to feel as snappy. The web wins are on the analytic side — reviewing benchmark results, comparing players, spotting trends.

### 6.8 Settings — `/settings`

Current implementation is minimal:
- **Account section:** email (read-only)
- **Team section:** current team name (read-only display — there is no team picker / switcher on this screen today, even though section 6.1 references switching teams from the user dashboard)
- **Sign out** button

Not implemented yet: team switcher within settings, delete-account flow, profile editing (display name lives in onboarding/backfill). The web version should probably add a proper team/league switcher here since desktop has the room.

---

## 7. Data flow — what gets written when

Quick map of what user actions produce what DB writes. Helps Claude understand "if I add a button here, what happens?"

| User action | DB write | Surfaces it affects |
|------------|----------|---------------------|
| Sign up | `auth.users` + `profiles` row (mostly empty) | n/a |
| Complete onboarding step 1 (name) | `profiles.first_name`, `last_name`, `display_name`, `onboarding_step` | All headers showing name |
| Create league | `leagues` + `league_members` | User dashboard, league dashboard |
| Create team | `teams` (+ `team_members` for creator, + `team_players` if captain) | User dashboard, league dashboard, team dashboard |
| Add player | `team_players` (color_index slot auto-assigned by trigger) | Roster, dashboard player counts |
| Deactivate player | `team_players.deactivated_at` | Roster (moves to Inactive section) |
| Mark player injured | `team_players.is_injured` + `injury_note` | Player detail badge, run-practice "Injury check" tag context |
| Create drill | `team_drills` (status='draft' initially) | Drill library, practice planner picker |
| Tag drill categories | `team_drill_categories` (junction; drill ↔ category) | Drill library filter, drill mix donut |
| Publish drill | `team_drills.status` to 'published' | Drill library, practice planner picker |
| Run benchmark assessment | `benchmark_results` (one row per player per drill per set, per benchmark type) | Team dashboard pulses, drill detail, player detail |
| Create practice plan | `practice_plans` | Practice list, dashboard "next practice" |
| Add block to plan | `practice_plan_blocks` (optionally cloned from `team_practice_blocks` template) | Practice detail block cards |
| Add drill to block | `practice_plan_drills.plan_block_id` (with `parallel_group` for concurrent drills) | Practice detail block contents |
| Add between-block water break | `practice_plan_breaks` (with `after_block_order`) | Practice detail between-block rows |
| Save plan structure (atomic) | RPC `replace_practice_plan_blocks(plan_id, blocks_payload, breaks_payload)` | Practice detail, dashboard "next practice" |
| RSVP / mark attendance | `practice_plan_attendees` (upsert per player) | Dashboard attendance widget, RSVP "Who's coming" |
| Run drill in practice | `practice_plan_drills.run_status` updates | Dashboard drill mix |
| Add per-drill post-practice note | `practice_plan_drills.log_note` (no separate table) | Practice detail, drill detail history sheet |
| Add per-player observation | `player_notes` (text + practice_date + player_id) | Player detail "Observations" feed |
| Complete post-practice log | `practice_logs` + `practice_plans.status='completed'` | Dashboard "next practice" rolls forward, practice list |

All table names above have been verified against the mobile code. The schema source of truth lives in `qb_supabase_full_package/`.

---

## 8. Design system at a glance

The full spec lives in `unlock-mobile/CLAUDE.md` and `unlock-mobile/docs/design/unlock-design-system.md`. The web design project should mirror it. Quick reference:

**Mode and palette.**
- Dark mode only. Surface base `#0D1117`. Surface raised `#161C24`. Surface overlay `#1E2530`.
- Orange `#D48A30` is the single interactive color. Don't decorate with it.
- Green for positive signals. Blue for data. Indigo for education/study. Red for danger/destructive only.
- 8 team color swatches: orange, lime, blue, red, violet, cyan, pink, gold. Same set is used for league colors.
- 20-swatch per-player palette (`colors.player.palette`) for avatar colors. Each player gets a stable slot (`color_index` on `team_players`) assigned by a DB trigger.

**Typography.**
- Two weights: 400 (regular), 500 (medium). Never bold.
- Sentence case in copy. No exclamation marks.
- Size scale runs from micro (11px) up to stat (28px).

**Components Claude should know exist on mobile (and likely need web analogs):**
- `Card` (surface / outlined / accent variants)
- `Button` (primary / secondary / destructive)
- `Tag` (pill, selected vs unselected)
- `Pill` (small, often used for status indicators)
- `Eyebrow` (small uppercase section label)
- `SectionHead` (section header with optional CTA)
- `Stat` (large number with label)
- `MiniTile` (small KPI card)
- `Spark` (sparkline chart)
- `StreakDots`, `StreakRow` (attendance streak visualization)
- `AvatarStack` (overlapping avatars for attendees)
- `AttendanceRing`, `AttendBar` (attendance visualizations)
- `CategoryDonut`, `CategoryWeeklyMini` (drill mix charts)
- `PlayerCard` (player row with avatar, name, positions)
- `ActivityRow` (event in a feed)
- `AthleteHero` (large profile header on player detail)
- `BigChoiceCard` (onboarding's "Single team vs League" big tappable card)
- `OnboardingShell` (centered card layout for onboarding screens)
- `CaptainViewToggle` (pill toggle for coach vs player view)
- `LeaguePicker` (smart picker on team creation)
- `Section` / `FormSection` (form blocks — every form field group is wrapped in this; no flat fields)
- `Input`, `TextArea` (labeled form primitives)
- `Move` (drag/reorder handle)
- `BackfillModal` (forces existing users without `first_name` to complete the name step)
- **Practice planner family:**
  - `PracticePlanForm` (top-level editor)
  - `PlanBlockCard` (block row on practice detail/editor — colored left rail, totals chip, expand-to-show-drills)
  - `BlockLibrarySheet` (sheet for picking from `team_practice_blocks` or creating new)
  - `MoveDrillToBlockSheet` (sheet for moving a drill between blocks)
  - `TopLevelBreakCard` (between-block water break row)
  - `GapZone` (insert-affordance pill rendered between blocks)
  - `PracticeAttendanceSheet` (RSVP / attendance roster modal)
  - `NowRunningCard` (run-practice hero card)
- **Drill family:**
  - `DrillForm` (drill create/edit with multi-select benchmark types, category multi-select, diagram editor toggle)
  - `DiagramEditor` (interactive SVG field — cones + path segments + movement types)
  - `DiagramRenderer` (read-only diagram render on drill detail)
  - `DrillNoteHistorySheet` (chronological notes from `practice_plan_drills.log_note`)
- **Benchmark family:**
  - `CaptureShell` (wrapper for the per-player capture flow)
  - `CaptureWidgets` (per-type widgets: stopwatch, 1-5 rating, made/attempts steppers, reps stepper, flag/drop counters)
- **Roster family:**
  - `PlayerForm` (with `CaptainToggle` inline)
  - `PlayerCard` (athletic-card variant used in roster list)
  - Player-detail "mark injured" branded modal (custom — replaces native Alert)

Don't re-invent these on web. Build analogs of the same components with responsive-friendly styling.

---

## 9. Key product principles (carried from mobile to web)

These are the rules that should bend Claude's design intuition.

1. **Progressive disclosure.** Simple by default, depth available. Logging saves a valid entry with minimal input; everything else enriches.
2. **Tiered data entry.** Tier 1 = required, Tier 2 = high-value optional, Tier 3 = nice-to-have. Apply per form. Don't gate save behind Tier 2/3.
3. **Locked insight cards.** When the data isn't there yet, show an outlined card saying "Run X to unlock Y." Never guilt the user for missing data.
4. **Speed over polish (with limits).** Logging flows are fast and forgiving. Review flows can be richer.
5. **Color has one job per screen.** Orange = interactive. Don't sprinkle for decoration.
6. **Sentence case, no exclamations.** "Run your first benchmark." not "Run your first benchmark!"
7. **Athletic but not aggressive.** This is a serious tool for serious players, not a hype machine.

---

## 10. What's on mobile but NOT yet on web

This is the gap the web build closes. Web should match mobile on all of these.

- Onboarding flow (name → scope → role/league → first team)
- League entity (`leagues`, `league_members`, leagues on the user dashboard, league dashboard)
- User dashboard with My Leagues + My Teams sections
- Captain View Toggle on team dashboard
- Per-player avatar color (`color_index` slot + 20-swatch palette, DB trigger auto-assigns)
- Drill notes history (sourced from `practice_plan_drills.log_note`)
- **Practice block structure** — blocks → drills, with between-block water breaks and parallel-group drills (entirely new on mobile, not modeled on web yet)
- **Player injury tracking** — `is_injured` + injury note, badge on player hero, modal to mark injured/healthy
- **Per-player observations feed** (`player_notes`) — coaching notes captured during post-practice log, surfaced on player detail
- **Run-practice mode** — the live in-practice screen. Probably does NOT belong on web (most coaches won't run a laptop on the field), but the data it writes — `run_status`, attendance, structured notes — needs to be readable on web for review.
- Multi-type benchmarks per drill (`benchmark_types[]` — `timed`, `rated`, `reps`, `pct`, `flags`, `drops`)
- 15-category drill taxonomy (was 8 in earlier doc — verify against `constants/categories.ts`)
- Dashboard widgets that depend on the above (the drill mix donut, the attendance widget with offense/defense breakdown, etc.) — the data exists, the web just needs to render them

---

## 11. What's on web but NOT on mobile

There are intentional web-only experiences:

- Public marketing landing page at `/` (mobile has no marketing surface)
- Sidebar navigation on desktop (mobile has bottom tabs only)
- Diagram editor with mouse/keyboard interactions
- (Future) Bulk operations, CSV export, admin-style views — out of scope for MVP web

---

## 12. Open questions to confirm with Taylor

The original `[CONFIRM]` markers have been resolved against the mobile code (see the audit pass at the top of this doc). The remaining items are product decisions for the web build — not gaps in this reference.

1. **Draft teams on the user dashboard.** Mobile shows user-created drafts with a "Draft" badge. Should web mirror this, or hide drafts until the team is fully set up?
2. **"Run practice" mode on web.** The mobile screen is substantial (live timer, per-drill stopwatch, attendance, structured notes). Most coaches won't have a laptop on the field, so web probably skips this entirely and just reads the data after the fact. Confirm.
3. **Dashboard widget priority on desktop.** Mobile is a vertical stack. Desktop has room for a multi-column grid. Likely prime-real-estate widgets: Next practice + Drill mix donut + Attendance + Pinned pulses. Confirm the ranking and any widget that should be hidden behind a "more" affordance.
4. **Settings on web.** Mobile settings is minimal (email, current team name read-only, sign out). Should web add a proper team/league switcher, profile editing, and account deletion here?
5. **Practice block editing on web.** The block model (blocks → drills, between-block breaks, parallel groups) is a real UX problem at mobile width. Does web get a richer multi-pane editor, or does it match the mobile sheet pattern? This is the second-biggest "desktop wins" surface after the diagram editor.
6. **Run-practice → web read-only review.** Run-practice writes `run_status`, attendance, and structured tag-notes. Where should web surface these for post-hoc review — on the practice detail page, or rolled into a dedicated "Practice review" surface?
7. **Captain self-assessment guardrail.** Mobile discourages a captain from rating themselves on `rated` drills. Should web enforce this with a hard block, or keep it advisory?
8. **Injury badge in scheduling flows.** Should the practice editor / RSVP show an "Injured" indicator next to player names so captains plan around it? Mobile shows the badge on player detail but not in plan-building flows.

Drop answers in this doc inline (replace the open question with the resolved answer) so the file remains the lasting source of truth.

---

## 13. Files for deeper reference (don't upload all of these by default)

If a particular question goes deeper than this doc, here's where to look in the mobile codebase:

- **Data shapes / queries:** `unlock-mobile/lib/dashboard.ts`, `lib/athlete.ts`, `lib/benchmark-session.ts`, `lib/team-context.tsx`
- **Schema source of truth:** `qb_supabase_full_package/docs/coach_mvp_schema_spec.md` and the migration files
- **Design tokens:** `unlock-mobile/constants/design.ts`, `constants/team-colors.ts`, `constants/typography.tsx`
- **Position metadata:** `unlock-mobile/constants/positions.ts` (positions + side + per-position color; QB sorts to top of OFFENSE)
- **Drill categories:** `unlock-mobile/constants/categories.ts` (15 categories with `category_type` phase/skill split)
- **Benchmark types and config:** `unlock-mobile/constants/benchmarks.ts` (`timed`, `rated`, `reps`, `pct`, `flags`, `drops`)
- **Practice block colors:** `unlock-mobile/constants/block-colors.ts` (4 named defaults + 8-color hash palette)
- **Player avatar palette:** `lib/athlete.ts` → `playerColorForIndex(colorIndex)` (20-swatch, indexed by `team_players.color_index`)
- **Onboarding canonical spec:** `ONBOARDING_LEAGUE_REDESIGN_WORKFLOW.md` (root project)
- **Run-practice screen:** `unlock-mobile/app/(tabs)/practice/[id]/run.tsx`
- **Post-practice log:** `unlock-mobile/app/(tabs)/practice/[id]/log.tsx`

The Claude.ai web design project should NOT have all of these uploaded by default. Only pull in the specific file when answering a specific deep question.
