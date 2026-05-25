# Unlock Flag Football — Web Build Plan

Last updated: 2026-05-24
Owner: Taylor
Companion docs: `WEB_PRD.md`, `WEB_SYSTEM_DESIGN.md`

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

## Build 2 — Marketing landing page ⏳

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

## Build 2.5 — Onboarding + Leagues ⏳

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

## Build 3 — Dashboard responsive upgrade ⏳

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

## Build 4 — Drills list + detail responsive upgrade ⏳

### Goal
Drills is one of the highest-value desktop surfaces (captains building libraries from videos they found online). Make it feel like a real desktop tool.

### In scope
- **Drills list (`/drills`)** responsive upgrade:
  - Mobile: existing card stack (no change)
  - Tablet: 2-column card grid
  - Desktop: convert to a table view with sortable columns (Name, Category, Status, Updated). Filter panel moves from top bar to left rail.
  - Search bar gets keyboard focus on `/` keyboard shortcut on desktop
- **Drill detail page (`/drills/[id]`)** responsive upgrade:
  - Mobile: existing single column
  - Desktop: two columns — left = drill info, diagram, setup instructions; right = metadata, edit/delete actions, benchmark history
- **Drill form (`/drills/new`, `/drills/[id]/edit`)** stays single-column but capped at `max-w-2xl` so it doesn't sprawl on desktop. Form fields and the diagram editor stack vertically.

### Out of scope
- Diagram editor mouse interactions (that's Build 5 — a discrete project)
- Bulk operations (multi-select, bulk delete, bulk reassign)
- Drill versioning UI

### Files touched
- Modified: `src/app/(app)/drills/page.tsx`, `DrillLibraryClient.tsx`
- Modified: `src/app/(app)/drills/[id]/page.tsx`
- Modified: `src/app/(app)/drills/new/page.tsx`, `src/app/(app)/drills/[id]/edit/page.tsx`, `DrillForm.tsx`

### Acceptance criteria
- Drills list responsive across breakpoints, with table view at desktop
- Sortable table columns work
- Filter panel works on desktop (sticky left rail), collapsible on mobile
- `/` keyboard shortcut focuses the search input on desktop
- Drill detail page uses two columns on desktop
- Drill form is comfortable to fill on both mobile and desktop, capped at `max-w-2xl`

### Risks
- **Table view on desktop hides the visual draft/publish indicator that cards had.** Mitigation: add a Status column with a clear badge.
- **Search shortcut conflicts with browser shortcuts.** Mitigation: scope the shortcut to the page (don't intercept when an input is focused or modifier keys are held).

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

## Build 6 — Roster + Benchmarks + Practice responsive upgrades ⏳

### Goal
Bring the remaining authenticated pages to feature parity with the dashboard and drills in terms of desktop UX. Smaller individual scope per page than drills, so they're grouped.

### In scope
- **Roster list (`/roster`)** responsive upgrade:
  - Mobile: existing list
  - Desktop: table view with columns (Name, Positions, Jersey #, Status, Last benchmark). Inline status toggle (active/inactive). Quick "Add player" button in the header.
- **Player detail (`/roster/[id]`)** responsive upgrade:
  - Desktop: two columns — left = player info + edit, right = benchmark history with a basic chart (per-drill progress over time)
- **Benchmark hub (`/benchmarks`)** responsive upgrade:
  - Mobile: existing flow
  - Desktop: drill selector + player selector side-by-side, larger touch targets, summary of selections before launching the logging flow
- **Benchmark logging flow** stays mobile-optimized (linear, focused), capped at `max-w-2xl` on desktop. This is a focus task; it's fine if it doesn't sprawl.
- **Practice list (`/practice`)** responsive upgrade:
  - Mobile: existing list
  - Desktop: table view with columns (Date, Title, Status, Drills count). Quick "New practice plan" button in the header.
- **Practice plan detail / edit (`/practice/[id]`, `/practice/[id]/edit`)** responsive upgrade:
  - Desktop: three-pane layout — left = drill library picker (filterable), center = practice plan timeline (drag to reorder), right = drill details + notes for the selected drill
  - Mobile: existing tabbed/stacked layout
- **Post-practice log (`/practice/[id]/log`)** stays focused, capped at `max-w-2xl`

### Out of scope
- Charting library beyond the basic player-progress sparkline (defer to Build 7 if needed)
- Real-time co-editing of practice plans
- Bulk benchmark assessment (assess multiple drills in one sitting)
- Drag-to-reorder requires a library — pick `@dnd-kit/core` (lightweight, accessible) and add as a dependency

### Files touched
- Modified: `src/app/(app)/roster/page.tsx`, `RosterListClient.tsx`, `roster/[id]/page.tsx`, related forms
- Modified: `src/app/(app)/benchmarks/page.tsx`, `BenchmarksHubClient.tsx`, `benchmarks/log/page.tsx`, `BenchmarkLogClient.tsx`
- Modified: `src/app/(app)/practice/page.tsx`, `PracticeListClient.tsx`, `practice/[id]/page.tsx`, `practice/[id]/edit/page.tsx`, `PracticePlanForm.tsx`
- New dependency: `@dnd-kit/core` for practice plan drag-to-reorder on desktop

### Acceptance criteria
- All listed pages responsive across breakpoints
- Desktop table views work with sortable columns where applicable
- Practice plan editor on desktop allows drag-to-reorder drills
- Player detail page shows a simple per-drill benchmark trend chart
- Mobile experience does not regress on any page

### Risks
- **Drag-to-reorder library adds significant bundle size.** `@dnd-kit/core` is reasonably small but check the bundle. If it's too heavy, native HTML drag-and-drop is acceptable (uglier API but free).
- **Three-pane practice editor at desktop sizes might feel cluttered.** Mitigation: each pane has clear visual separation (border, header label). Resizable panes are out of scope.

---

## Build 7 — Charts and dashboard insights ⏳

### Goal
Add real charts to the dashboard and player detail page now that desktop layouts can support them. Insights become visual, not just numerical.

### In scope
- Pick a chart library. Recommend `Recharts` (well-maintained, React-native API, reasonable bundle size, decent defaults). Add as a dependency.
- Dashboard additions:
  - "Team trend" chart on the dashboard: average benchmark performance over time per category
  - Sparkline on each strength/weakness card showing trend over the last N assessments
- Player detail additions:
  - Per-drill benchmark progress chart (already mentioned in Build 6 — fully build it here)
- Empty state for charts when there's not enough data: "Run more benchmarks to see this trend" (locked insight pattern)

### Out of scope
- Custom dashboard builder
- Export charts to image
- Comparative team-vs-team charts (only one team exists in MVP context)

### Files touched
- Modified: `src/app/(app)/page.tsx` (dashboard charts)
- Modified: `src/app/(app)/roster/[id]/page.tsx` (player chart)
- New: `src/components/app/charts/` directory with reusable chart components
- New dependency: `recharts`

### Acceptance criteria
- At least two new charts shipped (team trend + per-drill player progress)
- Charts respect the design system (orange/green/blue per the color rules)
- Charts have an empty state when there's not enough data
- Charts don't render off-screen or overflow on mobile (small or hidden on phones is OK)

### Risks
- **Charts feel decorative if the data isn't there.** Mitigation: the locked-insight pattern says "do more X to unlock this trend." Same idea here.
- **Recharts default styling won't match the design system.** Mitigation: budget time to theme the charts (axis colors, grid lines, tooltips).

---

## Build 8 — Polish pass ⏳

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
- Settings page revisit — currently minimal, make sure it has the basics (team name, sign out, link to support email)
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

## Build 9 — Production prep ⏳

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
- After Build 3-4: "Dashboard and drills feel like a desktop app."
- After Build 5: "Diagram builder is good enough to do real work on a laptop."
- After Build 6-7: "Everything is responsive and the dashboard has charts."
- After Build 8-9: "Ready to share with the other two teams in the org."

## What's NOT in this plan (and where it lives)

- Resuming individual QB tracking: separate effort, post coach-MVP validation
- AI insight engine on web: ports from mobile when mobile ships it
- Player-facing app: separate scope
- React Native app store submission: separate effort
- Coach analytics dashboard (org-level metrics across teams): future, not before validation
- Customer support tooling: future
- Test suite: separate engineering effort

## How to actually run a build

1. Pull this doc up. Pick the next ⏳ build in order.
2. Hand the "Goal," "In scope," "Out of scope," and "Acceptance criteria" sections to Claude Code as a prompt.
3. Provide `WEB_PRD.md`, `WEB_SYSTEM_DESIGN.md`, and the project CLAUDE.md as context.
4. Let Claude Code do the work. Review the diff before merging.
5. Update this doc: change ⏳ to ✅ on the build, add notes in a "Shipped" subsection if anything diverged from the plan.
6. Test on both mobile browser and desktop before declaring done. The responsive promise is the whole point.
