# Unlock Flag Football — Web Build Plan

Last updated: 2026-05-24 (audited against mobile feature set + current web code on this date — Build 4 expanded for multi-type benchmarks, Build 5.5 inserted for practice block model, Build 6 narrowed, Build 6.5 added for injury/observations/post-log, Build 7 added for dashboard widget parity; old Build 7–9 renumbered to 8–10)
Owner: Taylor
Companion docs: `WEB_PRD.md`, `WEB_SYSTEM_DESIGN.md`, `MOBILE_APP_REFERENCE.md` (canonical feature parity reference for the mobile app)

## How to use this doc

Each build is a self-contained vertical slice. Ship them in order. Each build has:

- **Goal**: what this build delivers
- **In scope** / **Out of scope**: keep yourself honest
- **Files touched**: what's getting changed, created, or moved
- **Acceptance criteria**: how you know it's done
- **Risks**: what could go sideways

Hand one build at a time to Claude Code, in order. Don't skip ahead — each build assumes the previous ones shipped.

Mobile-first responsive UX is non-negotiable: every build must work on a phone-sized browser AND on desktop. Builds that introduce desktop layouts must explicitly include the mobile fallback.

## Status legend

- ⏳ Not started
- 🔶 In progress
- ✅ Shipped

All builds below are ⏳ as of this writing.

---

## Build 1 — Project relocation + responsive shell foundation ✅

### Shipped (2026-05-24)
- Project was already at `unlock-web/` at the repo root (no move needed; the in-scope move-from-`unlock-mobile/unlock-app/` step was a no-op).
- `src/middleware.ts` → `src/proxy.ts`; exported function renamed `middleware` → `proxy`.
- PWA bits stripped from `src/app/layout.tsx` (manifest link, `appleWebApp`, scale-locked viewport). `public/manifest.json` left in place per spec.
- Route groups carved: `(marketing)`, `(auth)`, `(app)`. Existing flat routes moved into `(app)`. Login/signup/auth-callback moved into `(auth)`.
- Dashboard moved from `/` → `/dashboard` (`src/app/(app)/dashboard/page.tsx`). All `href="/"` / `redirect("/")` / `router.replace("/")` references that pointed at the dashboard were updated to `/dashboard`. BottomNav Dashboard tab now `/dashboard`.
- Paused individual-tracking routes moved into `src/app/_paused/` (underscore prefix makes Next App Router skip them): `log/`, `library/`, `progress/`, `onboarding/`.
- New `(app)/layout.tsx` renders `Sidebar` (240px, `hidden md:flex`) at md+ and `BottomNav` (`md:hidden`) below md. Content container `max-w-[1280px]`, 20px / 32px horizontal padding.
- New `(marketing)/layout.tsx` (sticky header + footer) and placeholder `(marketing)/page.tsx` with sign-in/sign-up CTAs (Build 2 will replace with real content).
- New `(auth)/layout.tsx` (minimal centered shell).
- New `src/components/app/Sidebar.tsx` — team name, primary nav, Settings + Sign out at bottom.
- New `src/proxy.ts` logic: public paths `/`, `/login`, `/signup`, `/auth/*`; signed-in users on `/login` or `/signup` → `/dashboard`; signed-in users with no `team_members` row → `/team-setup` (excluding `/team-setup` itself to avoid a loop).
- Root `CLAUDE.md` build-status section and `unlock-web/CLAUDE.md` rewritten to reflect the new structure.

### Notes / known divergences from the plan
- This build did **not** initialize a Vercel project move (no Vercel project exists yet locally to point at the new path). Production deploy wiring is in Build 9.
- `(app)/team-setup` sits inside the (app) route group, so it inherits the Sidebar shell. That's a minor cosmetic quirk for users without a team (Sidebar shows "Your team" placeholder). Will be revisited as part of Build 2.5 onboarding work.



### Goal
Move the web project to `unlock-web/`, strip out the PWA-as-app strategy, set up the responsive shell with sidebar on desktop and bottom nav on mobile browser, and introduce route groups for marketing vs. app vs. auth. After this build, the structural foundation is in place but individual pages are still mobile-first.

### In scope
- Move `unlock-mobile/unlock-app/` to `unlock-web/`. Update any path references in docs.
- Rename `src/middleware.ts` to `src/proxy.ts` and rename the exported function from `middleware` to `proxy` (Next 16 deprecation cleanup).
- Strip PWA artifacts:
  - Remove `manifest.json` link, `appleWebApp` metadata block, scale-locked viewport options from `layout.tsx`
  - Leave `public/manifest.json` and `public/icon-*` files in place for now (cheap to keep, easy to remove later if not needed)
- Create route groups:
  - `src/app/(marketing)/` — public landing (placeholder for Build 2)
  - `src/app/(auth)/login/`, `src/app/(auth)/signup/`, `src/app/(auth)/auth/callback/` — move existing auth pages here
  - `src/app/(app)/` — move existing dashboard, drills, roster, practice, benchmarks, team-setup, settings into here
- Move paused individual-tracking routes into `src/app/_paused/`:
  - `log/workout`, `log/throwing`, `log/game-recap`, `log/recovery`, `log/page.tsx` (the log hub)
  - `library/routes`, `library/coverages`, `library/concepts`, `library/page.tsx`
  - `progress/page.tsx`
  - `onboarding/page.tsx` (the QB onboarding, distinct from team-setup)
- Build the responsive app shell:
  - New `(app)/layout.tsx` that renders a sidebar at `md` and up, bottom nav below `md`
  - Sidebar component (`components/app/Sidebar.tsx`): 240px fixed width, dark surface, team name at top, nav items (Dashboard, Drills, Roster, Practice), Settings and Sign Out at bottom
  - Bottom nav stays for mobile browser (existing `BottomNav.tsx`, kept but rendered conditionally)
  - Main content area: `max-w-7xl` centered, 32px horizontal padding at desktop, 20px on mobile
- Update root `layout.tsx`:
  - Remove PWA metadata
  - Keep `TeamProvider` (still cross-context)
  - Render only minimal HTML/body scaffold; route group layouts handle their own shells
- Marketing route group layout placeholder (`(marketing)/layout.tsx`) with a simple header + footer scaffold (no real content until Build 2)
- Update middleware (now proxy):
  - Public routes: `/`, `/login`, `/signup`, `/auth/callback`, anything in `(marketing)`
  - Authenticated routes: everything in `(app)`
  - Add the team-setup check: authenticated user with no `team_members` row → redirect to `/team-setup` (deferred from earlier project)
- Update root `CLAUDE.md` (project-level): change "Build status" section to reflect this work, document the move and the new folder layout
- Create `unlock-web/CLAUDE.md` (engineering doc for the web project) by adapting the existing `unlock-mobile/unlock-app/CLAUDE.md`. Reflect the new responsive shell, route groups, and the fact that this is no longer mobile-first-as-PWA

### Out of scope
- Page-by-page responsive layouts (Builds 3-7)
- Marketing page real content (Build 2)
- Visual polish on the sidebar (Build 8 polish pass)
- Diagram editor mouse-vs-touch upgrades (Build 5)

### Files touched
- Move: entire `unlock-mobile/unlock-app/` tree to `unlock-web/`
- Rename: `src/middleware.ts` → `src/proxy.ts`
- New: `src/app/(marketing)/layout.tsx`, `src/app/(app)/layout.tsx`, `src/components/app/Sidebar.tsx`
- Modified: `src/app/layout.tsx`, `src/components/BottomNav.tsx` (conditional rendering)
- Move within tree: existing auth, app, and paused-individual-tracking routes into their new homes per the spec above

### Acceptance criteria
- `npm run dev` boots successfully from `unlock-web/` with no errors
- Signed-out user hits `/` and lands on a (placeholder) marketing page
- Signed-out user hits `/dashboard` and gets redirected to `/login`
- Signed-in user without a team hits anything and lands on `/team-setup`
- Signed-in user with a team hits `/dashboard` and sees the existing coach dashboard with sidebar on desktop (≥768px) and bottom nav on mobile (<768px). Resize the browser window and watch the shell swap.
- Sidebar shows: team name, Dashboard, Drills, Roster, Practice, Settings, Sign out
- All existing pages still render and function (drills list, roster, practice, benchmarks). They might look ugly at desktop sizes — that's expected and gets fixed in later builds.
- Paused routes are not reachable as URLs but exist under `src/app/_paused/`
- No Next 16 deprecation warning about `middleware.ts`
- `/login`, `/signup` still work and redirect correctly

### Risks
- **Path-reference drift after the move.** Anything that imports from `@/` should still work because the tsconfig path alias is `src/`-rooted. But hardcoded path strings (e.g., in docs, in Vercel deploy config, in scripts) might point to the old location. Mitigation: grep for `unlock-mobile/unlock-app` across the repo after the move and update.
- **Vercel deploy config.** If the project is already wired to deploy from `unlock-mobile/unlock-app/`, that needs to point at `unlock-web/`. Coordinate with Vercel project settings before merging the move. (Taylor: confirm whether Vercel is already deploying this app or not.)
- **Sidebar overflow on shorter laptops.** A 240px sidebar leaves 1040px for content at 1280px. Check on a 1366px screen (common cheap laptop) to make sure it still feels right.

---

## Build 2 — Marketing landing page ✅

### Shipped (2026-05-24)
- Direction A landing page from the Claude Design handoff bundle (see `reference_uff_web_design_handoff.md`). Glow-backed hero with device-frame `MiniDashboard` + floating drill-diagram and roster fragments. Sections 01–06 (Who it's for · Features · How it works · Diagram spotlight · FAQ · Final CTA · Footer). Responsive collapses at 1100 / 900 / 720 / 640px.
- `(auth)/layout.tsx` reworked: slim brand header + mono footer + accent glow.
- `login` and `signup` rewritten to the centered card design from the handoff. New `(auth)/check-email/page.tsx` for the post-signup confirmation state (required for prod email confirmation).
- Signup destination branches on whether Supabase returned a session: session present (email confirmation OFF in local dev) → `/team-setup`; session absent (production) → `/check-email?email=…`. `proxy.ts` added `/check-email` to `PUBLIC_PATHS`.
- Fonts: Inter (400/500/600/700) + JetBrains Mono (500/700) via `next/font/google`. Exposed as `--font-inter` / `--font-jetbrains-mono`; `--font-sans` / `--font-mono` in globals point at them.
- New shared components: `src/components/marketing/` (BrandLockup, MarketingNav, SectionEyebrow, MiniDashboard, DiagramPreview, MarketingFooter, FAQ), `src/components/auth/AuthField`.
- Branch: `build-2-direction-a` @ `3dba74b`, off `build-1-web-shell`. Not merged to main.

### Notes / known divergences from the plan
- Two palettes coexist in `globals.css` on purpose: original `--color-*` tokens still drive every `(app)/` page; new UFF tokens + `.uff-` utility classes drive marketing + auth only. Migrating `(app)/` pages onto the new UFF palette is deferred to Build 8 polish pass.
- The hero screenshot is a JSX `MiniDashboard` mock, not a real dashboard PNG. Real screenshot deferred to Build 8.
- Direction B landing, LoginSplit, and 390px mobile artboards from the handoff are NOT implemented.
- Forgot-password link on login is a `#` placeholder.

### Goal
Replace the placeholder marketing route with a real landing page at `/` that explains the product and converts visitors to signup. Mobile-responsive from the start.

### In scope
- Real landing page at `(marketing)/page.tsx` with the sections from the system design doc:
  1. Hero (headline, subhead, primary CTA, screenshot)
  2. Who it's for (target users)
  3. Features (drill library + diagrams, roster + benchmarks, practice planner, dashboard)
  4. How it works (3-step flow)
  5. Social proof slot (empty placeholder)
  6. Final CTA
  7. Footer
- Marketing header in `(marketing)/layout.tsx`: logo on left, "Log in" + "Sign up" buttons on right. Sticky on scroll.
- Marketing footer: contact email, basic legal placeholder links, social icons (empty for now)
- Placeholder copy throughout — flagged with `[PLACEHOLDER]` so it's obvious where real copy is needed
- One screenshot of the dashboard (you can take this yourself from a logged-in session)
- Logged-in user visiting `/` sees the marketing page but with a "Go to dashboard" button instead of "Sign up" / "Log in" in the header

### Out of scope
- Real marketing copy (separate task, will use `design:ux-copy` skill)
- Blog or `/about` route
- SEO optimization beyond basic meta tags (separate effort, will use `searchfit-seo` skills)
- Analytics wiring
- Open Graph / Twitter cards (basic only)

### Files touched
- New: `src/app/(marketing)/page.tsx`, `src/app/(marketing)/layout.tsx`
- New: `src/components/marketing/Hero.tsx`, `Features.tsx`, `HowItWorks.tsx`, `Footer.tsx`, `MarketingHeader.tsx`
- New: `public/screenshots/dashboard.png` (placeholder, you'll replace with a real screenshot)

### Acceptance criteria
- `/` renders the landing page for logged-out users
- `/` renders the landing page with "Go to dashboard" CTA for logged-in users
- Page is responsive: looks good on a phone browser (375px), a tablet (768px), and a desktop (1280px+)
- Clicking "Sign up" goes to `/signup`, completing signup lands the user on `/team-setup`
- Clicking "Log in" goes to `/login`, logging in lands the user on `/dashboard`
- Page passes a basic Lighthouse check (no critical accessibility issues, decent performance score on a static page)
- All copy is marked `[PLACEHOLDER]` where real copy is needed

### Risks
- **Copy looks unfinished and unprofessional.** Mitigation: this is internal-only until you swap in real copy. Don't share the URL publicly until that happens.
- **Screenshot looks stale fast as the dashboard changes.** Mitigation: keep it generic enough (no specific names, no real data) that it doesn't get stale quickly. Re-take when the dashboard meaningfully changes.

---

## Build 2.5 — Onboarding + Leagues ✅

### Shipped (2026-05-25)
- New `(onboarding)/onboarding/` route group with its own bare layout (no sidebar, no bottom nav). Five screens — Name, Scope, Role, New Team (single branch), Create League (league branch) — each backed by a server action.
- Onboarding wired to the real schema: `submitName` writes `profiles.first_name/last_name/display_name/onboarding_step=1`. `submitScope` bumps to step 2 and routes via URL params (`?scope=single|league`). `submitRole` bumps to step 3 and routes to `/onboarding/new-team?scope=single&role=…`. `createOnboardingTeam` calls the long-form `create_team_with_member(p_role, p_league_id=null)`, marks `onboarding_completed_at`, redirects to `/dashboard/team/[newTeamId]`. `createOnboardingLeague` calls `create_league_with_admin`, marks complete, redirects to `/dashboard/league/[newLeagueId]`.
- Backfill modal (`src/components/BackfillModal.tsx` + `BackfillMount` server check) renders over any authenticated layout when `profiles.onboarding_completed_at IS NOT NULL` and `first_name IS NULL`. Non-dismissible two-field form, server action updates first/last/display_name. Mounted from both `(app)/layout.tsx` and `(workspace)/layout.tsx`.
- New `(workspace)/` route group with its own bare layout. Hosts the three post-onboarding dashboards and the add-team flow — these pages render the full `.uff-web` shell (sidebar + topbar + page) themselves, so the `(workspace)` layout adds no chrome. New routes:
  - `/dashboard` — user home with 4 states (mixed / leagues-only / teams-only / empty), backed by `lib/dashboard/user-home-data.ts`. De-dup rule applied: teams that belong to one of the user's leagues are hidden under "My teams".
  - `/dashboard/league/[leagueId]` — league dashboard, two states (empty / populated). Ported design hero, stats strip, team grid with inline AddTeamSlot, ghost team slots in empty.
  - `/dashboard/team/[teamId]` — team dashboard (port of the old `/dashboard` page), now scoped by `teamId` from the URL. Includes a team-context local sidebar with Drills / Roster / Practice / Benchmarks / Settings nav.
  - `/teams/new` — smart league picker with all four behaviors (zero leagues = locked standalone; one = chip pair; multi = row picker with no default; preset via `?leagueId=` = locked league row). Sidebar swaps user-context ↔ league-context based on the active pick. Right-rail live preview + "what happens" trace.
- Proxy (`src/proxy.ts`) rewired around the onboarding state machine. Logic: signed-out → `/login`; signed-in on `/login` or `/signup` → `/dashboard`; cookie `uff_onb=done` short-circuits the profile fetch on subsequent requests; uncached + onboarding incomplete → redirect to `lib/onboarding/state.ts`'s `decideOnboarding()` result; onboarding complete → set the cookie, allow. Legacy `/team-setup` → `/onboarding/scope`, legacy `/onboarding` → `/dashboard`.
- Signup destination updated: local-dev (instant session) → `/onboarding/name`; production (email confirm) → `/check-email`, then `auth/callback?next=/onboarding/name`.
- Legacy routes removed: `(app)/dashboard/`, `(app)/team-setup/`.
- New shared component packages: `src/components/uff/` (icons, team-colors, ColorSwatchRow, Segmented, FieldIcon), `src/components/onboarding/shell.tsx` (OnbStage/OnbCard/OnbHeader/OnbFooter/WebProgressDots/WebChoiceCard/OnbField/OnbHint/OnbError/SummaryRow/TeamIdentityPreview/LeagueIdentityPreview), `src/components/dashboard/` (DashTopBar, DashSection, UserSidebar, LeagueSidebar, SignOutButton).
- `globals.css` extended with: legacy `--uff-*` token aliases mapped onto the canonical UFF tokens (so prototype JSX `var(--uff-*)` references resolve); `.fr-input`/`.fr-seg`/`.fr-swatch` form atoms; full `.uff-web` shell (sidebar, topbar, page, w-card, wbtn) with responsive collapse below md.
- Branch: `build-2.5-onboarding-leagues` off `build-2-direction-a`. Not merged to main.

### Notes / known divergences from the spec
- New `(workspace)/` route group instead of putting the dashboards inside `(app)/`. Reason: the dashboards render their own UFF shell (sidebar swap by route), which is fundamentally different from the existing `(app)/` Sidebar primary nav (`Dashboard / Drills / Roster / Practice`). Keeping them in separate groups avoids stacking two sidebars and keeps the existing team-scoped pages (`/drills`, `/roster`, `/practice`, `/benchmarks`, `/settings`) on their original `(app)` shell.
- `/drills`, `/roster`, `/practice`, `/benchmarks`, `/settings` still use the legacy `--color-*` palette (and `TeamProvider`'s "first team" lookup). Migrating them onto the UFF palette + per-team scoping is deferred to Build 8 polish.
- League-admin members count on the user dashboard cards is a simple row count, not a per-role breakdown.

### Goal
Bring the new onboarding flow and the League entity (already shipped on mobile, schema migrations 47-52 already applied to Supabase) to the web app. After this build, new users complete the proper onboarding flow on web, existing users get backfilled, and the dashboard structure reflects the user → league → team hierarchy.

### In scope
The full scope, file-by-file plan, routing logic, copy reference, and acceptance criteria for this build live in a dedicated workflow doc:

**See `WEB_ONBOARDING_LEAGUE_REDESIGN_WORKFLOW.md` for the complete spec.**

That doc covers:
- New `(onboarding)` route group with its own shell (no sidebar)
- 4 onboarding screens (name, scope, role, create-league / new-team) per the mobile flow
- New user dashboard at `/dashboard` with My leagues + My teams sections
- New league dashboard at `/dashboard/league/[leagueId]`
- Team dashboard moves to `/dashboard/team/[teamId]` with Captain view toggle
- Smart League picker on the post-onboarding Add Team form
- Middleware updates for onboarding routing
- Backfill modal for existing users missing first_name
- Full file-by-file change plan (24+ new/modified files)

### Out of scope (per the workflow doc)
- Inviting other users via email link
- Migrating legacy `teams.organization_name` strings into real `leagues` records
- Multi-league support for a single user
- A dedicated `/leagues` index page

### Dependencies
- Build 1 (project relocation + responsive shell) must ship first — this build assumes route groups exist
- Build 2 (marketing) is independent and can ship in parallel
- Schema migrations 47-52 already applied to Supabase (done — mobile work)

### Acceptance criteria
See §12 of `WEB_ONBOARDING_LEAGUE_REDESIGN_WORKFLOW.md` for the full criteria list.

### Risks
- **The old single-dashboard at `(app)/page.tsx` needs to move to `/dashboard/team/[teamId]`.** Any in-flight work on Build 3 should target the new path.
- **Middleware latency** from per-request Supabase profile checks. Mitigation in the workflow doc (path filter + cookie cache).
- **Stale bookmarks to `/team-setup` and the old `/onboarding`.** Mitigation: redirects to the new equivalents.

---

## Build 3 — Dashboard responsive upgrade ✅

### Shipped (2026-05-25)
- Stat strip on `/dashboard/team/[teamId]` now stacks 1-col on mobile, 2×2 at `md` (≥768px), and 4-across at `lg` (≥1100px). Border treatment switches between bottom-borders (stacked) and right-borders (in a row) so the dividers always belong to whichever axis the cells share.
- Below the hero + stats, body splits into a 2-column main/side grid at `lg+`: main = strength/weakness (full-width on smaller screens, 2-col internal grid at lg+), side = recent assessments + recent practices stacked. Stacks vertically below `lg`.
- Strength/weakness rows become a horizontal multi-column comparison at `lg+` via the new `.td-overview-grid` class (1px gap fills with `--uff-line-soft` so each cell reads as its own card while sharing borders).
- Hover affordance added on stat cells, strength/weakness rows, assessment rows, and practice cards via the shared `.td-stat-cell` / `.td-row-hover` utility classes — subtle white tint, 120ms transition.
- Empty-team state rebuilt as a centered hero card with a single primary CTA ("Run your first benchmark") and two secondary step cards (Add players, Create drills) in a 2-col grid that collapses to 1-col on phones.
- New `loading.tsx` at `src/app/(workspace)/dashboard/team/[teamId]/loading.tsx` — shimmering skeleton that mirrors the real layout (sidebar, topbar, hero, stat strip, body grid). Doesn't import page components so it stays cheap and decoupled.
- Branch: `build-3-team-dashboard` off `build-2.5-onboarding-leagues`. Not merged to main.

### Notes / known divergences from the plan
- "3-column layout" in the spec was interpreted as a 2-col grid (main + side) at `lg+`, with the main column containing the strength/weakness section which itself becomes a 2-col internal grid. Net visual = up to 3 columns of content at desktop.
- Charts are not part of this build (Build 7) — the strength/weakness cells still show numerical ratings + assessment counts.
- The user dashboard (`/dashboard`) and league dashboard (`/dashboard/league/[id]`) were already responsive from the start in Build 2.5 — they aren't touched here.

> Note: After Build 2.5, "the dashboard" refers to three pages — user dashboard (`/dashboard`), league dashboard (`/dashboard/league/[id]`), and team dashboard (`/dashboard/team/[id]`). This build's responsive upgrades target the TEAM dashboard specifically (the old single dashboard, now scoped to a team). The user dashboard and league dashboard are designed responsive from the start in Build 2.5.


### Goal
Make the dashboard feel native on desktop. Currently it's a single-column phone layout centered on a wide screen, which wastes space and feels cramped.

### In scope
- Refactor `(app)/page.tsx` (the dashboard) to use a responsive grid:
  - Mobile: existing single-column stack
  - Tablet (`md`): 2-column grid for stat cards
  - Desktop (`lg`+): 3-column layout — main column (strength/weakness + insights), side column (recent assessments, recent practices)
- Stat cards get hover states for interactivity affordance on desktop
- Strength/weakness section: on desktop, render as a horizontal multi-column comparison rather than vertical stacking
- Empty state (new team, no benchmarks yet) gets a centered card with a clear next step ("Run your first benchmark")
- Loading skeleton tuned for the new layout
- Keep all existing data fetches (`vw_team_strength_weakness`, `benchmark_results`, `vw_practice_history`) — they're correct

### Out of scope
- New data sources or dashboard insights (those are a future feature build)
- Charts library integration (defer to Build 7 if needed)
- Real-time updates

### Files touched
- Modified: `src/app/(app)/page.tsx` (the dashboard)
- New: possibly `src/components/app/DashboardGrid.tsx` if the layout justifies extraction

### Acceptance criteria
- Dashboard works on mobile browser (375px), tablet (768px), and desktop (1280px+)
- On desktop, screen width is used well — no giant empty white space
- All existing dashboard data still appears correctly
- Empty state guides a brand-new team toward their first benchmark
- Hover states feel responsive on desktop without being distracting

### Risks
- **Designing for "desktop" too aggressively makes the mobile view worse.** Mitigation: build mobile first, then add `md:` and `lg:` overrides. Test mobile at every step.
- **Wider strength/weakness layout makes individual entries feel smaller and harder to scan.** Mitigation: cap each card at a reasonable max width and use whitespace, not density, to fill space.

---

## Build 4 — Drills list + detail responsive upgrade + multi-type benchmarks ⏳

### Goal
Drills is one of the highest-value desktop surfaces (captains building libraries from videos they found online). Make it feel like a real desktop tool, AND bring the drill form up to mobile parity on benchmark types (currently web only supports `timed | rated`; mobile supports six types).

### Mobile parity gap addressed
Per `MOBILE_APP_REFERENCE.md` §6.4, mobile drills support **six benchmark types** as a multi-select: `timed`, `rated`, `reps`, `pct` (made/attempts), `flags`, `drops`. Stored as `team_drills.benchmark_types[]`. Web `DrillForm.tsx` currently hardcodes a single-select `"None" | "Timed" | "Rated"`. This build closes that gap.

Multi-category tagging via `team_drill_categories` junction is already working on web — no change needed there. The drill category list (15 categories with phase/skill split per `constants/categories.ts`) is also already wired.

### In scope
- **Drills list (`/drills`)** responsive upgrade:
  - Mobile: existing card stack (no change)
  - Tablet: 2-column card grid
  - Desktop: convert to a table view with sortable columns (Name, Category, Benchmark types, Status, Updated). Filter panel moves from top bar to left rail.
  - Search bar gets keyboard focus on `/` keyboard shortcut on desktop
- **Drill detail page (`/drills/[id]`)** responsive upgrade:
  - Mobile: existing single column
  - Desktop: two columns — left = drill info, diagram, setup instructions; right = metadata, edit/delete actions, benchmark history
- **Drill form (`/drills/new`, `/drills/[id]/edit`)**:
  - Stays single-column but capped at `max-w-2xl` so it doesn't sprawl on desktop
  - **Replace single-select benchmark type with a Y/N "Use for benchmarks?" gate + multi-select of the six types** (mirror the mobile `DrillForm` pattern from session 2026-05-17)
  - Update server action to persist `benchmark_types text[]` instead of a single string
  - Update drill detail "Run benchmark" CTA to surface only when at least one type is set
- **Drill list / detail surfaces benchmark types** as small chip badges (one per active type) so captains can see at a glance what a drill captures.

### Out of scope
- Diagram editor mouse interactions (that's Build 5 — a discrete project)
- Bulk operations (multi-select, bulk delete, bulk reassign)
- Drill versioning UI
- The benchmark *capture* widgets for the new types — those live in Build 6 (logging flow). This build only updates the *drill definition* side.

### Files touched
- Modified: `src/app/(app)/drills/page.tsx`, `DrillLibraryClient.tsx`
- Modified: `src/app/(app)/drills/[id]/page.tsx`
- Modified: `src/app/(app)/drills/new/page.tsx`, `src/app/(app)/drills/[id]/edit/page.tsx`, `DrillForm.tsx`
- Modified: drill server actions (create/update) to handle `benchmark_types[]` payload

### Acceptance criteria
- Drills list responsive across breakpoints, with table view at desktop
- Sortable table columns work
- Filter panel works on desktop (sticky left rail), collapsible on mobile
- `/` keyboard shortcut focuses the search input on desktop
- Drill detail page uses two columns on desktop
- Drill form is comfortable to fill on both mobile and desktop, capped at `max-w-2xl`
- Drill form lets the captain mark a drill as benchmarkable and pick one or more of the six types
- Existing drills with a single legacy type render correctly (write a one-shot migration / coalesce read query if needed)

### Risks
- **Table view on desktop hides the visual draft/publish indicator that cards had.** Mitigation: add a Status column with a clear badge.
- **Search shortcut conflicts with browser shortcuts.** Mitigation: scope the shortcut to the page (don't intercept when an input is focused or modifier keys are held).
- **Legacy single-type drills.** If the web has already shipped drills with the old single-string field, ensure the read path can coalesce a legacy value into the new array. Worst case: write a migration script.

---

## Build 5 — Diagram editor desktop polish ⏳

### Goal
The diagram editor was designed touch-first. On desktop, mouse interactions need to feel natural. This is the single biggest desktop UX upgrade in the project.

### In scope
- **Mouse-native interactions:**
  - Click empty field to place a cone (currently tap-to-place)
  - Click and drag a cone to move it (currently touch drag — should work but feel snappier with mouse)
  - Right-click cone for context menu (Delete, Properties)
  - Click a movement segment to select it; selected segment shows edit handles
  - Shift+click multiple cones to select them as a group (future-friendly, optional for this build)
- **Keyboard shortcuts:**
  - Cmd/Ctrl+Z = undo last action
  - Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y = redo
  - Delete or Backspace = delete selected cone or segment
  - Escape = cancel current action (e.g., deselect)
- **Visual polish for the bigger canvas:**
  - Canvas takes advantage of desktop width (up to a sensible max, e.g., 800px wide)
  - Yard line numbers more readable at larger sizes
  - Cones have clearer visual hierarchy (numbered, color-coded by order maybe)
- **Undo/redo history stack:** internal data structure to track the last N actions. Required for keyboard shortcuts to work.
- **Touch interactions still work:** mobile users get the existing behavior; this build adds on top, doesn't replace.

### Out of scope
- Multiple-player route drawing on a single diagram (that's a much bigger feature)
- Exporting diagrams as images
- Diagram templates / starting points
- Animated playback of routes

### Files touched
- Modified: `src/components/DiagramEditor.tsx`
- Possibly new: `src/lib/diagram-history.ts` (undo/redo stack)

### Acceptance criteria
- All existing diagram features still work on touch (mobile + tablet)
- On desktop with a mouse: click places cone, drag moves it, right-click shows menu, keyboard shortcuts work
- Undo/redo works for cone placement, cone moves, segment additions, and deletions
- Canvas is comfortably sized on desktop without overflowing the page
- No regressions in setup instruction auto-generation (the existing util still produces correct output)

### Risks
- **Right-click conflicts with the browser's native menu.** Mitigation: only intercept right-click when the cursor is over a cone or segment, not over empty canvas.
- **Undo history grows unbounded.** Mitigation: cap at 50 actions. Plenty for any reasonable editing session.
- **Touch and mouse code paths diverge and one regresses.** Mitigation: keep the action handlers (placeCone, moveCone, deleteCone) unified, just swap the input layer. Test both surfaces.

---

## Build 5.5 — Practice block model (data + planner rewrite) ⏳

### Goal
Bring the web practice planner up to the mobile *data shape*. The current web `PracticePlanForm.tsx` treats a practice as a flat list of `{drillId, durationMinutes}` rows. Mobile (per `MOBILE_APP_REFERENCE.md` §6.6) treats a practice as **blocks → drills**, with between-block water breaks and parallel-group drills. None of that exists on web. Build 6's responsive desktop polish is impossible until the block model is in.

### Why this is its own build
This is a structural rewrite of one of the largest feature areas. It's not a polish pass. Trying to do it as a sub-task of Build 6 (responsive upgrades) is what made Build 6 in the previous version of this plan misleading.

### Mobile parity gap addressed
- `practice_plan_blocks` (named, ordered blocks per plan with `target_minutes`)
- `team_practice_blocks` (per-team reusable block templates)
- `practice_plan_drills.plan_block_id` + `parallel_group` (drills inside blocks; same-group drills run concurrently)
- `practice_plan_breaks` (between-block water breaks, anchored by `after_block_order`)
- `practice_plan_attendees` (RSVP / "Who's coming")
- RPC `replace_practice_plan_blocks(plan_id, blocks_payload, breaks_payload)` — atomic three-arg replace with cross-block parallel-group validation
- Block colors via deterministic name-hash palette (4 named defaults + 8-color hash palette)

Schema migrations are already applied (mobile session 2026-05-22). Web just needs to consume them.

### In scope
- **Data layer:**
  - Read paths for `practice_plan_blocks`, `practice_plan_drills` (with `plan_block_id` + `parallel_group`), `practice_plan_breaks`, `practice_plan_attendees`
  - Server actions that call `replace_practice_plan_blocks` RPC on save
  - Block library queries against `team_practice_blocks`
- **Practice editor rewrite (`/practice/[id]/edit`, `/practice/new`):**
  - Top-level: title + date/time in header
  - Body: ordered block cards with colored left rail, block name, target minutes, summed drill minutes
  - Per block: drill rows (with parallel-group grouping), up/down reorder, duration + reps overrides via steppers, per-drill cues field, remove
  - Between blocks: insert water-break affordance + water-break row component
  - Block library sheet to add/clone from `team_practice_blocks` or create new
  - Move-drill-to-block affordance
  - RSVP / "Who's coming" section + roster-table modal that writes `practice_plan_attendees`
- **Practice plan detail (`/practice/[id]`):**
  - Render blocks in order with their drills (collapsed summary by default, tap/click to expand)
  - Between-block water breaks interleaved
  - RSVP summary
- **Practice list (`/practice`):**
  - Status pill (draft / scheduled / live / completed)
  - Block count + total duration + RSVP count chips
  - Duplicate plan action (deep-copies blocks + drills + breaks)
- **Color palette:** new `lib/block-colors.ts` mirroring mobile `constants/block-colors.ts`

### Out of scope
- Desktop responsive polish on the editor (Build 6)
- Run-practice live mode and post-practice log (Build 6.5)
- Drag-to-reorder via `@dnd-kit/core` — use up/down chevron reorder for parity with mobile, defer DnD to Build 6 if it adds desktop value

### Files touched
- Major rewrite: `src/app/(app)/practice/PracticePlanForm.tsx`
- Modified: `src/app/(app)/practice/page.tsx`, `PracticeListClient.tsx`, `practice/[id]/page.tsx`, `practice/[id]/edit/page.tsx`, `practice/new/page.tsx`
- New: `src/components/practice/PlanBlockCard.tsx`, `BlockLibrarySheet.tsx`, `MoveDrillToBlockSheet.tsx`, `TopLevelBreakCard.tsx`, `GapZone.tsx`, `PracticeAttendanceSheet.tsx`
- New: `src/lib/block-colors.ts`
- New / modified: server actions for plan save (calling `replace_practice_plan_blocks`), RSVP upsert

### Acceptance criteria
- A captain can create a plan, add 2+ blocks (one from template, one custom), add drills to each block, set a parallel group on two drills in a block, add a between-block water break, set RSVP for half the roster, and save — all writes land atomically via the RPC.
- A captain can duplicate a plan and the new copy contains all blocks, drills, breaks, and parallel groups (RSVP does NOT carry over).
- Practice list shows the new status pill, block count, total duration, and RSVP count.
- All four lifecycle states (`draft` / `scheduled` / `live` / `completed`) render distinctly on the detail page.
- Mobile parity check: open the same practice on mobile and confirm the same structure renders identically.

### Risks
- **RPC payload shape drift.** The mobile-shipped RPC expects a specific JSON shape for `blocks_payload` + `breaks_payload`. Mitigation: copy the payload builder from `unlock-mobile/lib/practice-save.ts` (or equivalent) verbatim.
- **Existing flat-shape plans on web (if any).** If web has shipped any plans with the old flat `practice_plan_drills` (no `plan_block_id`), they need backfilling. Mitigation: one-shot migration that wraps each plan's drills in a single auto-generated block.
- **Scope creep into responsive polish.** The temptation will be strong. Resist. Block model first, polish in Build 6.

---

## Build 6 — Roster + Benchmarks + Practice responsive upgrades + multi-type benchmark capture ⏳

### Goal
Bring the remaining authenticated pages to desktop feature parity. Includes the multi-type benchmark capture widgets that Build 4 set up the drill side for.

### Mobile parity gap addressed
- Benchmark capture widgets for the four newer types: `reps`, `pct` (made/attempts), `flags`, `drops`. `BenchmarkLogClient.tsx` currently only handles `timed | rated`.
- Per `MOBILE_APP_REFERENCE.md` §6.7 the capture shell + per-type widgets live in `components/benchmark/CaptureShell.tsx` + `CaptureWidgets.tsx` on mobile — mirror that structure on web.

### Depends on
- Build 5.5 (practice block model) — the practice responsive work below assumes blocks exist.

### In scope
- **Roster list (`/roster`)** responsive upgrade:
  - Mobile: existing list
  - Desktop: table view with columns (Name, Positions, Jersey #, Status, Last benchmark). Inline status toggle (active/inactive). Quick "Add player" button in the header.
- **Player detail (`/roster/[id]`)** responsive upgrade:
  - Desktop: two columns — left = `AthleteHero` (avatar from `color_index`, name, jersey, positions, badges), right = benchmark history with a basic chart (per-drill progress over time)
  - Injury badge on hero ("Injured", "Injured · Captain") — see Build 6.5 for the modal that sets it
- **Benchmark hub (`/benchmarks`)** responsive upgrade:
  - Mobile: existing flow
  - Desktop: drill selector + player selector side-by-side, larger touch targets, summary of selections before launching the logging flow
- **Benchmark logging flow (`/benchmarks/log`)**:
  - Adds capture widgets for all six types: `timed` (stopwatch + manual), `rated` (1-5 anchored), `reps` (stepper), `pct` (made/attempts dual stepper), `flags` (counter), `drops` (counter)
  - A drill with multiple types in `benchmark_types[]` prompts for each type in sequence per player per set
  - Stays mobile-optimized (linear, focused), capped at `max-w-2xl` on desktop
  - Captain self-assessment guardrail (advisory only): warn when the logged-in captain is the player being rated on a `rated` drill
- **Practice list (`/practice`)** responsive upgrade:
  - Desktop: table view with columns (Date, Title, Status, Block count, Duration, RSVP). Quick "New practice plan" button in the header.
- **Practice plan detail / edit (`/practice/[id]`, `/practice/[id]/edit`)** responsive upgrade:
  - Mobile: keep the Build 5.5 layout
  - Desktop: side-by-side panes — left = block library + drill library, center = plan structure (blocks → drills, with breaks interleaved), right = block/drill detail editor for the current selection
  - Drag-to-reorder via `@dnd-kit/core` on desktop (within a block AND between blocks; mobile keeps up/down chevrons)
- **Post-practice log (`/practice/[id]/log`)** — basic shell only; full log flow is Build 6.5

### Out of scope
- Charting library beyond the basic player-progress sparkline (defer to Build 8)
- Real-time co-editing of practice plans
- Bulk benchmark assessment (assess multiple drills in one sitting)
- Injury modal, observations feed, post-practice log content — all Build 6.5

### Files touched
- Modified: `src/app/(app)/roster/page.tsx`, `RosterListClient.tsx`, `roster/[id]/page.tsx`, related forms
- Modified: `src/app/(app)/benchmarks/page.tsx`, `BenchmarksHubClient.tsx`, `benchmarks/log/page.tsx`, `BenchmarkLogClient.tsx`
- New: `src/components/benchmark/CaptureShell.tsx`, `CaptureWidgets.tsx` (mirror mobile)
- Modified: `src/app/(app)/practice/page.tsx`, `PracticeListClient.tsx`, `practice/[id]/page.tsx`, `practice/[id]/edit/page.tsx`
- New dependency: `@dnd-kit/core` for practice plan drag-to-reorder on desktop

### Acceptance criteria
- All listed pages responsive across breakpoints
- Desktop table views work with sortable columns where applicable
- Practice plan editor on desktop allows drag-to-reorder drills, including between blocks
- Benchmark capture supports all six types, picking the right widget per type. A drill with multiple types is captured in sequence.
- Player detail page shows a simple per-drill benchmark trend chart and an injury badge when the player is flagged
- Mobile experience does not regress on any page

### Risks
- **Drag-to-reorder between blocks gets messy with parallel groups.** Mitigation: dropping a drill into a block clears its `parallel_group`; the user re-groups manually after the move. Document this in the editor's affordance.
- **`@dnd-kit/core` bundle size.** Reasonably small, check the bundle. If it's too heavy, native HTML drag-and-drop is acceptable.
- **Multi-type capture turns into a long flow.** Mitigation: per-set capture all-types-on-one-screen (one player, one drill, one set: all required types side by side) rather than sequencing them.

---

## Build 6.5 — Injury tracking + observations feed + post-practice log 🔶

### Shipped — post-practice log (2026-05-27, branch `build-6.5a-post-practice-log`)
- New route `/practice/[id]/log` (server + `PostPracticeLogClient`) on the UFF dark palette + TeamSidebar shell.
- Four numbered sections matching mobile's 2026-05-19 rebuild:
  - **01 Drills** — flat list of every non-water-break drill across blocks (block accent stripe + block name as eyebrow). Per-row Done / Skipped toggles (mutually exclusive) + expand-to-write `log_note` button. Fresh logs default every drill to Done; re-edits hydrate from the saved `drills_completed[]` / `drills_skipped[]` arrays.
  - **02 Observations** — picker + free-text input that adds one `(player_id, note_text)` row per Add. Saved rows list below with remove. Re-edits load all prior `player_notes` for this plan.
  - **03 Notes** — three textareas: `team_performance_notes`, `highlights`, `areas_to_improve`.
  - **04 Wrap-up** — `attendance_count` number (defaults to count of RSVP=true) + `energy_level` 1–10 button row with copy ("Flat / Steady / Sharp / Locked in" based on the value).
- Side rail summary card: counts of done / skipped / unmarked drills + observations + attendance + energy, with "At a glance" → "Editing log" eyebrow when re-opening.
- `savePracticeLog` server action in `src/lib/practice/log-actions.ts`:
  1. Upserts (lookup + insert/update) the `practice_logs` row keyed on `practice_plan_id`.
  2. Replace-by-plan_id of `player_notes` (delete then insert non-empty rows).
  3. Per-row patch of each `practice_plan_drills.log_note`.
  4. Transitions `practice_plans.status = 'completed'`.
  Revalidates `/practice`, `/practice/[id]`, `/practice/[id]/log`.
- `PlanDrill` extended with `log_note: string | null`; `fetchPlanFull` selects it; `EditorClient` initialiser updated so adding a drill from the library doesn't break the new type.
- Practice detail topbar gains a Log practice / Edit log link (label flips based on `plan.status`).
- Type-checked + `next build` clean.

**Follow-up commit on the same branch (2026-05-27): past-due guardrails + draft block.**
- `PastDueBanner.tsx`: inline banner above the practice detail hero whenever `practice_date < today` AND `status !== 'completed'`. Three status-specific variants (draft / scheduled / live) with copy from `/ux-copy` skill. Primary CTA + secondary CTA each variant. Optional draft-blocked notice shown when the user got redirected here from `/log`.
- Practice detail topbar: "Log practice" button is replaced with a disabled span ("Finalize the plan to enable logging.") when `status === 'draft'`. Other statuses keep the previous behaviour (label flips to "Edit log" on completed).
- `/practice/[id]/log` server gate: if `plan.status === 'draft'`, redirect to `/practice/[id]?blocked=draft`. The detail page surfaces the inline notice.
- Practice list cards (`FeaturedPlanCard` + `PlanSummaryCard`): small `PastDueChip` rendered alongside the status pill when `isPlanPastDue()` is true. Same orange-tinted token as the banner so the signal reads as one.

### Still missing from the original spec
- ❌ **Injury modal refactor** — `is_injured` + `injury_note` are captured today (via `PlayerForm`), but the spec calls for a branded modal on player detail rather than the toggle inside the edit form. Tracked as item #4 in the resolve-outstanding queue.
- ❌ **Observations feed on player detail** — the log now writes `player_notes`, but `/dashboard/team/[teamId]/roster/[playerId]` doesn't surface them yet. Tracked as item #3.
- ❌ **DrillNoteHistorySheet** web equivalent on drill detail — `log_note` is persisted per drill row but there's no sheet listing the history. Defer to a follow-up.

### Goal
Three smaller mobile-parity gaps that all relate to capturing rich coaching data, grouped into one build because none warrants its own.

### Mobile parity gap addressed
1. **Injury tracking** (`MOBILE_APP_REFERENCE.md` §6.5): `team_players.is_injured` + `injury_note`, branded "Mark injured / Mark healthy" modal on player detail, "Injured" eyebrow badge on the hero.
2. **Player observations feed** (§6.5): chronological coaching notes from `player_notes` (text + practice_date + player_id), surfaced on player detail. Written during post-practice log.
3. **Post-practice log flow** (§6.6): structured per-drill completion + per-drill `log_note` (which feeds `DrillNoteHistorySheet` on drill detail) + per-player observations (writes `player_notes`) + team performance notes / highlights / areas-to-improve / attendance count / energy level. Completing the log moves the practice to `completed`.

### In scope
- **Injury controls** on `/roster/[id]`:
  - "Mark injured" / "Mark healthy" buttons
  - Branded inline modal that captures the injury note when marking injured (NOT a native `confirm()` — match mobile)
  - Server action toggling `team_players.is_injured` + `injury_note`
  - Hero badge with eyebrow text: "Injured", or "Injured · Captain" when both flags apply
  - Read path updates: list views, RSVP rows, and (Build 7) the dashboard attendance widget all expose the injured flag where relevant
- **Observations feed** on `/roster/[id]`:
  - Chronological list under hero (mobile calls it "Observations")
  - Each row: note text, practice date, practice title (linking to that practice)
  - Read from `player_notes` joined to `practice_plans`
- **Post-practice log** at `/practice/[id]/log`:
  - Numbered section cards matching mobile's 2026-05-19 rebuild
  - Section 1: per-drill completion (done / skipped) + per-drill `log_note` text area
  - Section 2: per-player observations — pick a player, write a note, save → `player_notes`
  - Section 3: team performance notes, highlights, areas to improve
  - Section 4: attendance count (auto-pulled from RSVP, editable) + energy level
  - Saving the log: marks the practice `completed`, writes `practice_logs`, persists per-drill `log_note` rows on `practice_plan_drills`
  - If the user already ran the practice (via a future Build 8.5 "Run mode" or directly on mobile), prefill from existing state

### Out of scope
- Run-practice live mode on web (deferred — see open question §12.2 of `MOBILE_APP_REFERENCE.md`). Web reads run-state data captured on mobile but doesn't write it.
- Observation editing / deletion (write-only feed for MVP)
- Adding observations directly from player detail (only via post-practice log for MVP)

### Files touched
- Modified: `src/app/(app)/roster/[id]/page.tsx` + add an `InjuryModal.tsx` and `ObservationsFeed.tsx` component
- Modified: `PlayerForm.tsx` (do NOT add injury controls here — injury lives on detail only, matching mobile)
- New: `src/app/(app)/practice/[id]/log/page.tsx` (or rewrite the existing stub) + `PostPracticeLogClient.tsx`
- New: server actions for injury toggle, observation create, post-practice log save (with `log_note` per drill)
- Modified: `DrillNoteHistorySheet` (or web equivalent) to read from `practice_plan_drills.log_note` — confirm there's no separate `team_drill_notes` table being assumed

### Acceptance criteria
- Marking a player injured writes both `is_injured = true` and the typed note; healthy resets both
- Injured badge appears on player hero and persists across reloads
- After a post-practice log is submitted, each per-drill note appears on that drill's detail page in the notes history
- Each per-player observation submitted from the log appears in the player's observations feed with the correct practice date and title
- Completing the log transitions the practice plan status to `completed` and the practice list reflects it
- Mobile-app render of the same player / practice / drill matches what the web wrote

### Risks
- **Native `confirm()` instead of branded modal.** Easy to fall back on. The mobile session (2026-05-22) explicitly replaced the native Alert with a branded modal for brand consistency. Match it.
- **Observation feed bloat over time.** Mitigation: paginate or virtualize after N notes. For MVP a simple chronological list is fine.

---

---

## Build 7 — Team dashboard widget parity ✅

### Shipped (2026-05-26)
- Refactored `/dashboard/team/[teamId]` around the UFF Web coach console design (`UFF Web.html`). Hero + Next-practice row, Pinned Pulses strip (KPI sparklines, 4 cards), Benchmark Trends (Recharts line chart), Movers leaderboard, Drill Mix donut (with underweight nudge), Practice Cadence heatmap, Attendance widget (rate + delta + offense/defense + streak dots), Needs Attention card, Recent Activity feed, Most-Run Drills bar list.
- Captain View Toggle added in the topbar — visible only when `team_players.is_captain=true` AND `team_players.user_id = auth.uid()`. `?view=player` URL param scopes Pinned Pulses + Attendance to that captain's own player record. Other widgets stay team-wide per the plan's risk note.
- Single data loader `lib/dashboard/team-home-data.ts` does one Promise.all then computes all widget aggregates in JS — no new SQL views added (the existing `team_drills.is_dashboard_pinned` column carries pin state; `practice_plan_attendees.attended` drives attendance + streaks; categories come from `team_drill_categories` joined to `drill_categories`).
- Pin/unpin server action at `(workspace)/dashboard/team/[teamId]/actions.ts` + `PinButton` client component wired into drill detail topbar. Toggles `team_drills.is_dashboard_pinned` + `dashboard_pinned_at`, then revalidates dashboard + drill detail.
- Recharts added (`recharts@latest`) for the Benchmark Trends chart only. Sparklines + donut + cadence + side-bar gauges still hand-rolled SVG per the plan's bundle-size concern.
- `loading.tsx` skeleton rebuilt to mirror the new grid (hero + KPI + trends + 4-up + activity rows) at 1024/1280px breakpoints.
- Locked-insight empty states on every widget. Brand-new team falls through to a single bottom card guiding "pin a drill, log a benchmark, complete a practice".
- Branch: `build-7-dashboard-widgets` off `build-5.5-practice-blocks`. Single commit. Not merged to main.

### Notes / known divergences from the plan
- Plan said hand-roll sparkline + donut to avoid Recharts. We added Recharts anyway for the trends widget (user explicitly opted-in during scope clarification). Sparkline + donut + cadence remain hand-rolled.
- Drill mix categorizes via the `team_drill_categories` junction (already present) + a small `categoryKey()` heuristic that maps category names → known buckets (offense / defense / footwork / routes / conditioning / fundamentals / qb / flag). Anything outside that set falls into "other".
- Offense/defense split for attendance derives from `team_players.positions[]` string matching, not a dedicated `side` column. Heuristic — players with positions containing "qb / wr / rb / center / receiver / rusher_offense / offense" count as offense; "cb / safety / rusher / lb / db / defense" count as defense. A player on both sides is counted in both rates.
- Activity feed currently pulls from `benchmark_results.created_at` + `practice_plans.created_at` only — drill-library edits and pin events not yet logged.
- Squad-benchmark delta in the hero is derived from the top pinned drill's current-vs-prior window. Not season-wide because we don't yet have a "season start" anchor on `teams`.

### Goal
The team dashboard responsive layout shipped in Build 3, but the *widgets* on it are a stripped-down subset of what mobile has. Mobile's team dashboard (per `MOBILE_APP_REFERENCE.md` §6.3) is the heart of the app — Build 3 gave it space to breathe, this build fills the space with the actual widgets.

### Mobile parity gap addressed
None of these widgets exist on web today; all of them exist on mobile and the data is already in Supabase:

1. **Pinned pulses (per-drill)** — for drills the user has pinned, show current average (seconds for timed, 1-5 for rated, etc.), delta vs. previous period, and a 6-week sparkline. "What's our progression on this drill?"
2. **Drill mix donut** — categorical breakdown of drills run in completed practices (offense / defense / conditioning / footwork / etc.). Center shows total drill completions. Highlights an underweighted category if one stands out. Includes a weekly mini-chart.
3. **Attendance widget** — overall rate (0–100), delta vs. prior 4 weeks, 7-practice sparkline, **offense vs. defense rate breakdown**, and a streaks row showing players with the longest attendance streaks.
4. **Next practice card** — upcoming practice with date, title, time, status, duration, attendee row (`AvatarStack` + RSVP count). Click → practice detail.
5. **Captain View Toggle** — when the logged-in user is a captain (`team_players.is_captain = true`), a small pill toggle at top: "Coach view" (default) vs "Player view." Player view filters every widget below to only that player's data.

### In scope
- Data layer:
  - `vw_pinned_pulses` or equivalent query for per-drill averages + deltas + sparkline series
  - `vw_drill_mix` for category mix
  - `vw_attendance` with the offense/defense breakdown
  - Streak calculation (might need a new view if not already on the mobile schema)
  - Pin/unpin drill action — writes to a `team_drill_pins` table (or whatever mobile uses)
- Widgets (web components mirroring the mobile component names from `MOBILE_APP_REFERENCE.md` §8):
  - `PinnedPulseCard` (+ `Spark` sparkline primitive)
  - `CategoryDonut` + `CategoryWeeklyMini`
  - `AttendanceRing` + `AttendBar` + `StreakDots` / `StreakRow`
  - `NextPracticeCard` (with `AvatarStack`)
  - `CaptainViewToggle`
- Layout integration into the team dashboard grid (Build 3 set up the responsive grid; this build fills the side and main columns)
- Locked-insight empty states for each widget when the data isn't there yet ("Run X to unlock Y")

### Out of scope
- Generic charting on player detail (Build 8 — keep the charting effort consolidated)
- Custom widget builder
- Comparative team-vs-team charts
- Drag-to-rearrange dashboard widgets

### Files touched
- Modified: `src/app/(workspace)/dashboard/team/[teamId]/page.tsx` + its data loader
- New: `src/components/dashboard/widgets/` directory with one file per widget
- New: `src/components/dashboard/CaptainViewToggle.tsx`
- New: server action for pin/unpin drill

### Acceptance criteria
- A team with enough data sees all five widgets populated. A brand-new team sees locked-insight cards on each with a clear unlock condition.
- Captain View Toggle: flipping to Player view filters Pinned pulses + Attendance to only the captain's data; toggle persists across navigation (URL param or local storage).
- Next practice card shows correct status pill matching the new lifecycle (`scheduled` / `live` / `completed`).
- Mobile render of the same team dashboard shows the same widget content (parity sanity check).

### Risks
- **Donut + sparkline libraries balloon the bundle.** Mitigation: hand-roll the sparkline (it's a single SVG path) and the donut (two arcs). Recharts isn't justified yet — defer it to Build 8 where it's actually needed for player progress charts.
- **Attendance streak query is expensive on large rosters.** Mitigation: materialized view or a `vw_attendance_streaks` that pre-computes the top N players. Negligible at MVP roster size (15), worth flagging for later.
- **Captain View Toggle scope leak.** Mitigation: only Pinned pulses + Attendance respond to the toggle for MVP. Other widgets stay team-wide. Document this.

---

## Build 8 — Charts and player insights ✅

### Shipped (2026-05-26)
- New `src/components/app/charts/` directory: `chartTheme.ts` (axis/grid/tooltip tokens shared across all Recharts surfaces), `BenchmarkProgressChart.tsx` (per-drill Recharts LineChart with axes, tooltip, PR-aware custom dots, dashed PB reference line, inverted Y-axis for lower-is-better types), `LockedBenchmarkChart.tsx` (locked-insight card matching chart dimensions).
- `(workspace)/dashboard/team/[teamId]/roster/[playerId]/PlayerHistory.tsx` rewired to render `BenchmarkProgressChart` per (drill, type), with a "Locked insights" tail section below the measured drills.
- Player detail page query extended to fetch `team_drills.benchmark_types[]` so we can compute supported-but-unmeasured (drill, type) pairs for the locked tail. Grouping rekeyed by `drill_id` for stable identity.
- `BenchmarkTrendsCard.tsx` (Build 7) refactored onto the shared `chartTheme` so dashboard and player charts stay in lockstep.
- Chart components handle all six benchmark types (timed / rated / reps / pct / flags / drops) — types without data today show `LockedBenchmarkChart` so Build 6's capture work has visual real-estate ready.
- Branch: `build-8-charts` off `build-7-dashboard-widgets` tip (after a follow-up commit on build-7 for sidebar polish). Single commit. Not merged to main.

### Notes / known divergences from the plan
- `Spark.tsx` (PinnedPulsesStrip), `CategoryDonut`, and `CadenceHeatmap` from Build 7 stay hand-rolled. The plan said "optional dashboard polish if any pulse/widget would benefit from a more sophisticated chart" — those three are two SVG paths and zero JS, swapping for Recharts would bloat the bundle for no visible gain. The polish that DID happen: extracting the shared `chartTheme` and refactoring `BenchmarkTrendsCard` onto it.
- Required scope path: `src/app/(app)/roster/[id]/page.tsx`. Actual landing site: `src/app/(workspace)/dashboard/team/[teamId]/roster/[playerId]/page.tsx` (the workspace path is where users actually navigate from the team dashboard; legacy `(app)/roster` is deferred to Build 9 polish).

### Goal
Add real charts to the player detail page now that the dashboard widget pass is done and the desktop layout can support them.

### In scope
- Pick a chart library. Recommend `Recharts` (well-maintained, React-native API, reasonable bundle size, decent defaults). Add as a dependency.
- Player detail additions:
  - Per-drill benchmark progress chart (multi-line if a drill has multiple benchmark types — e.g., `pct` shows two series for made and attempts, or a single derived percentage line)
  - Optional: career-best annotation, PR markers
- Optional dashboard polish if any pulse/widget from Build 7 would benefit from a more sophisticated chart than the hand-rolled sparkline
- Empty state for charts when there's not enough data: "Run more benchmarks to see this trend" (locked insight pattern)

### Out of scope
- Custom dashboard builder
- Export charts to image
- Comparative team-vs-team charts (only one team exists in MVP context)

### Files touched
- Modified: `src/app/(app)/roster/[id]/page.tsx` (player chart)
- New: `src/components/app/charts/` directory with reusable chart components
- New dependency: `recharts`

### Acceptance criteria
- Per-drill player progress chart renders with sane defaults for each of the six benchmark types
- Charts respect the design system (orange/green/blue per the color rules)
- Charts have an empty state when there's not enough data
- Charts don't render off-screen or overflow on mobile (small or hidden on phones is OK)

### Risks
- **Charts feel decorative if the data isn't there.** Mitigation: the locked-insight pattern says "do more X to unlock this trend." Same idea here.
- **Recharts default styling won't match the design system.** Mitigation: budget time to theme the charts (axis colors, grid lines, tooltips).
- **Six benchmark types × one chart component = visual sprawl.** Mitigation: pick a default visualization per type (`timed` = lower-is-better line, `rated` = stepped 1-5, `pct` = percentage line with attempt-count overlay, `reps` / `flags` / `drops` = bar). Documented in the chart component file.

---

## Build 9 — Polish pass ⏳

### Goal
A focused pass through the whole app to clean up loose ends, fix small visual bugs introduced during the responsive work, and tighten interactions.

### In scope
- Loading states on every page (skeletons, not just spinners)
- Error states with retry on every data-fetching page
- Empty states everywhere (no benchmarks yet, no players yet, no practices yet, etc.) with a clear CTA
- Accessibility pass:
  - Keyboard navigation through the sidebar and all interactive elements
  - Focus indicators visible on dark surfaces
  - Color contrast check on text and tags
  - Form labels and aria attributes on inputs
- Hover states on all interactive elements (desktop)
- Mobile-browser sanity check on every page after the desktop changes
- Sign out flow audit — make sure it works from both sidebar and (if added) header menu
- **Settings page rebuild** — currently minimal (email read-only, current team name read-only, sign out). Add: team/league switcher for users in multiple teams, profile editing (display name), and a basic delete-account stub. Per `MOBILE_APP_REFERENCE.md` §6.8, mobile settings is also minimal — this is web's chance to add the missing pieces.
- Take a real dashboard screenshot for the marketing page, replace the placeholder

### Out of scope
- Performance optimization (Lighthouse scores can wait; functionality first)
- Animation polish beyond the basics
- Internationalization

### Acceptance criteria
- Every page has loading, empty, and error states
- Keyboard-only navigation works for the core captain flow (log in → dashboard → drills → practice)
- Color contrast passes WCAG AA on body text and buttons
- Screenshot on marketing page reflects real, current dashboard layout
- No console errors during normal navigation

### Risks
- **Polish is a black hole.** Mitigation: timebox this build. Two-week max. Anything not covered moves to a follow-up backlog.

---

## Build 10 — Production prep ⏳

### Goal
Get the app ready to actually share with users beyond just Taylor.

### In scope
- Re-enable email confirmation in Supabase (the local-dev workaround gets reversed for production)
- Verify Vercel project is deploying from `unlock-web/` and not the old location
- Wire up DNS: `unlockflagfootball.com` → Vercel deployment
- Basic SEO meta tags on the marketing page (title, description, OG image)
- Privacy policy + Terms of service stubs in `(marketing)/privacy/` and `(marketing)/terms/` — placeholder text, real copy comes later
- Set up basic analytics (Plausible or Vercel Analytics — pick one, install it on the marketing page only initially)
- Production environment variables verified in Vercel
- Domain SSL working
- Test signup → onboarding → first benchmark flow end-to-end on production

### Out of scope
- App store submission (this is the React Native effort, separate)
- Performance audit and optimization beyond defaults
- Customer support tooling (Intercom, etc.)

### Acceptance criteria
- `unlockflagfootball.com` resolves to the production deployment
- Email signup works with confirmation on production
- New user can sign up, set up team, log a benchmark, see it on the dashboard
- Marketing page has basic SEO and at least a placeholder privacy/terms

### Risks
- **Email confirmation breaks the existing local-dev flow.** Mitigation: document the local-dev workaround clearly in `unlock-web/CLAUDE.md`. New environments need to know.
- **DNS propagation delays.** Mitigation: do the DNS update first, give it a day before announcing.

---

## What ships when

These are vertical slices. After each build, the app is shippable in the sense that nothing is broken. You can release as little or as much as you want.

**Realistic milestones for a solo PM with Claude Code:**
- After Build 1: "Web app moved and structured, but still looks the same."
- After Build 2: "We have a real homepage now."
- After Build 2.5: "Onboarding + leagues + user/league/team dashboards on web."
- After Build 3: "Team dashboard has a real desktop layout (but the rich widgets aren't there yet)."
- After Build 4: "Drills feel like a desktop tool; multi-type benchmarks supported on the drill side."
- After Build 5: "Diagram builder is good enough to do real work on a laptop."
- After Build 5.5: "Practice planner has the same block-based structure as mobile (data parity hit)."
- After Build 6: "Roster + benchmarks + practice editor are all responsive. All six benchmark types capture-able."
- After Build 6.5: "Injury tracking, observations feed, and post-practice logging are in. Feature parity with mobile (minus run mode) reached."
- After Build 7: "Team dashboard is rich — pulses, drill mix, attendance, streaks, captain toggle. Feels like the heart of the app."
- After Build 8: "Player progress charts ship."
- After Build 9: "Polished, accessible, no rough edges."
- After Build 10: "Ready to share with the other two teams in the org."

## What's NOT in this plan (and where it lives)

- Resuming individual QB tracking: separate effort, post coach-MVP validation
- AI insight engine on web: ports from mobile when mobile ships it
- Player-facing app: separate scope
- React Native app store submission: separate effort
- Coach analytics dashboard (org-level metrics across teams): future, not before validation
- Customer support tooling: future
- Test suite: separate engineering effort
- **Web "Run practice" live mode:** mobile has it; web probably never gets it (laptop on the field is impractical). Web reads run-mode data captured on mobile (`run_status`, attendance, structured tag notes) but doesn't write it. See `MOBILE_APP_REFERENCE.md` §12 open question 2. If product decides web should have a read-only practice-review surface, slot it into Build 6 or 7.
- **Inviting other users via email link:** out of scope until coach MVP validation. Today all users self-onboard.
- **Multi-league support for one user:** mobile data model supports it; UX is single-league for MVP.
- **Migrating legacy `teams.organization_name` strings into real `leagues` records:** intentional skip per Build 2.5 spec.

## How to actually run a build

1. Pull this doc up. Pick the next ⏳ build in order.
2. Hand the "Goal," "In scope," "Out of scope," and "Acceptance criteria" sections to Claude Code as a prompt.
3. Provide `WEB_PRD.md`, `WEB_SYSTEM_DESIGN.md`, and the project CLAUDE.md as context.
4. Let Claude Code do the work. Review the diff before merging.
5. Update this doc: change ⏳ to ✅ on the build, add notes in a "Shipped" subsection if anything diverged from the plan.
6. Test on both mobile browser and desktop before declaring done. The responsive promise is the whole point.
