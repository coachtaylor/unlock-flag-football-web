# Unlock Flag Football — Web PRD

Last updated: 2026-05-24
Owner: Taylor
Status: Draft, ready to build against

## What this document is

A product spec for the web version of Unlock Flag Football. It defines what we're building, who it's for, what's in and out of scope, and how we'll know it's working. The companion docs are `WEB_SYSTEM_DESIGN.md` (architecture and code structure) and `WEB_BUILD_PLAN.md` (phased build order).

The web version is not a separate product. It is the same product as the mobile app, with the same data, designed for a different context.

## One-line positioning

The Unlock Flag Football web app is where captains plan their team, build drills, and review the dashboard at a desk. The mobile app is where they run practice on the field. Both share one Supabase database, so what you do in one shows up instantly in the other.

## Background and why now

The original product was a Next.js PWA, designed mobile-first but accessed in a browser. That decision was made when the goal was the individual QB tracking MVP and the fastest way to ship to a solo user. Since then, the product pivoted to the coach/team MVP, and a true React Native mobile app (`unlock-mobile/`) is now the primary mobile experience.

The existing web codebase (`unlock-mobile/unlock-app/`) is largely up to date with the coach MVP feature set, but the UI is still mobile-first. On a laptop it looks like a phone in the middle of the screen, which is wrong for the work captains actually do at a desk: building drill libraries, planning practices, reviewing dashboards.

This PRD covers the work to make the web app actually feel like a web app, plus a public marketing landing page.

## Target users

**Primary: Captains / coaches at a desk.** Building drills (especially diagram-heavy ones), planning the week's practice, reviewing team dashboards and player trends, adding to the roster. The kind of work that benefits from a real keyboard, a bigger screen, and multi-column layouts.

**Secondary: Captains / coaches on a phone in a browser.** Same person, different context. Quick check of the dashboard between meetings, looking up a drill while watching film on the couch. The web app must still work well on a phone-sized browser, because not every coach will install the native app right away.

**Tertiary: Prospects on the marketing page.** People discovering the product for the first time at unlockflagfootball.com. They need to understand what the product is, who it's for, and how to sign up. They are not logged in yet.

## What success looks like

We are not measuring web vs. mobile usage as a competition. They are two ends of the same workflow. Success means:

1. **Captains use web for desk work without friction.** Specifically: building or editing a drill with the diagram builder, planning a full practice from the drill library, reviewing the dashboard's strength/weakness breakdown. If they're choosing mobile for these tasks because web is awkward, web is failing.
2. **Data parity is invisible.** Anything created or edited on web shows up on mobile and vice versa, without the user thinking about it. RLS prevents users from seeing other teams' data.
3. **Marketing page converts curious visitors into signups.** First measurable goal: signup conversion rate from marketing visits. Numeric target TBD after we have data.
4. **The web app does not regress mobile-browser usability.** A captain who lands on the web app from a phone browser can still log a benchmark or pull up a drill. We're not abandoning the mobile browser case, we're adding a desktop case on top of it.

## Scope

### In scope

**The app shell, redesigned for desktop and responsive down to mobile browser.**
- Top nav or sidebar (not the current fixed bottom tab bar) with the same destinations: Dashboard, Drills, Roster, Practice
- Responsive layout system using Tailwind breakpoints: single column on mobile browser, two or three columns on tablet/desktop where appropriate
- Remove PWA install framing (manifest, apple-web-app meta, scale-locked viewport) — that was for the old PWA-as-app strategy
- Team selector visible in the nav (captains may be on multiple teams in the future)
- Sign out and settings accessible from a header menu, not buried in a tab

**Feature parity with mobile, optimized for the desk surface.**
- **Dashboard**: same data (team strength/weakness, recent assessments, practice history), but takes advantage of width. Strength/weakness in a wider grid, recent assessments in a side panel, charts where they help.
- **Drills**: list view becomes a sortable/filterable table on desktop with detail in a side panel or full page. Diagram builder gets a bigger canvas — this is the single biggest desktop UX win.
- **Roster**: list becomes a table on desktop, with quick inline edits where it makes sense. Player detail page can show benchmark history in a wider chart.
- **Benchmarks**: assessment flow stays linear (it works on mobile and works on desktop too), but results review can take advantage of more screen space.
- **Practice planner**: this is the second biggest desktop win. Drill picker as a panel, plan timeline as a panel, edit in place. Much faster than mobile.
- **Post-practice logging**: stays linear, screens designed to feel like a focused single-task experience on either surface.

**Marketing landing page at /, public (no login required).**
- Hero: what the product is, who it's for, one screenshot
- Features section: drill library + diagram, roster + benchmarks, practice planner, dashboard
- Social proof slot (empty for now, ready for testimonials when they exist)
- Call to action: sign up free, or log in if returning
- Footer with contact and basic legal links

**Cleanup of paused individual-tracking routes.**
- Move all individual QB tracking routes (workout, throwing, game-recap, recovery, route library, coverages, concepts, progress) into `src/app/_paused/`. Next.js ignores folders that start with underscore, so they won't be reachable as URLs but the code is preserved. When the individual MVP resumes, we move them back.

**Folder reorganization.**
- Move the web project from `unlock-mobile/unlock-app/` to its own top-level folder `unlock-web/`. Mobile and web become siblings, not nested. Update any docs and paths that reference the old location.

### Out of scope (explicitly)

- Player-facing web experience. Players are mobile only for now. If/when we add a player view, it's a separate scope.
- Multi-organization / multi-team admin (e.g., the org admin who manages 3 teams). The org context exists in the schema but the UI for switching/managing teams across an org is not in this scope.
- Real-time live-syncing UI patterns (e.g., showing another captain's cursor on the practice plan). Supabase real-time is available but we don't need it for MVP.
- Push notifications. In-app only.
- Public sharing of practice plans or drills (e.g., a public URL to a drill). Not in scope.
- Anything from the paused individual QB tracking MVP. That work resumes as a separate effort post-coach-MVP validation.
- Tackle football. Flag football only.
- AI features on the web that don't already exist on mobile.

## Constraints and non-negotiables

These come from the project CLAUDE.md files and the existing design system. They apply to all new web work.

1. **Dark mode only.** Surface base is `#0D1117`. No light mode toggle.
2. **Same Supabase database as mobile.** No separate web schema, no separate auth. RLS handles isolation. Anything we add to the schema must work for both surfaces.
3. **Same design tokens.** Colors, typography, spacing, radius are defined in `globals.css`. Don't introduce new tokens for the web; extend the existing system if needed and update both surfaces.
4. **Two font weights only.** 400 and 500. Never bold.
5. **Color has one job.** Orange = interactive. Green = positive signals. Blue = data. Indigo = education. This rule from the design system holds on web.
6. **Mobile browser still works.** Every responsive layout must collapse to a usable mobile browser view. Breakpoints add desktop affordances on top of a working mobile baseline.
7. **No new feature work in this scope.** This is a UI/shell project, not a feature project. New features ship to mobile first, then port to web (matching how the project has worked so far).
8. **Safety rules from Taylor's global instructions apply.** No deletes without asking. No publishing without checking. Flag risky changes before making them.

## Key product decisions

**Why one Next.js project instead of two (marketing + app separately).** Simpler to deploy, easier auth flow (signup on marketing page hands off cleanly to the app), one codebase for Claude Code to reason about. Next.js route groups handle the separation cleanly: `(marketing)` for public pages, `(app)` for authenticated pages. If marketing grows into a content site that needs CMS workflows and a separate team, we can split it later. Not a problem we have today.

**Why keep the existing codebase instead of starting fresh.** The hard part of any web app is the data plumbing (Supabase clients, auth middleware, RLS-aware queries, server actions). All of that is in place and matches the mobile app's backend exactly. The mobile-first UI is a shell problem, not a content problem. The pages have correct logic and correct data fetching; they need a responsive shell wrapped around them. Starting fresh would mean rebuilding the same plumbing differently, which is the most boring kind of work and a great way to introduce bugs. (PM concept worth naming: salvage value, not sunk cost. We keep code when reusing it is genuinely faster and lower-risk, not because we already wrote it.)

**Why move the project to `unlock-web/`.** It's nested inside `unlock-mobile/unlock-app/` for historical reasons (mobile was bootstrapped inside the same Git repo). That's confusing. After this work, the top-level layout becomes: `unlock-mobile/` (React Native), `unlock-web/` (Next.js), `qb_supabase_full_package/` (shared backend, schema, docs). Clean mental model.

**Why a top nav / sidebar instead of keeping bottom tabs on desktop.** Bottom tabs are a phone pattern. On a laptop they waste vertical screen real estate and feel uncanny. Captains expect a sidebar or top nav on desktop. We can keep the bottom nav for mobile browser views (below the `md` breakpoint) and swap to a top nav or sidebar at `md` and up. Decision on top nav vs. sidebar is in the system design doc.

## Risks and mitigations

1. **Scope creep into adding features on web that don't exist on mobile.** Tempting because there's more screen real estate. Mitigated by the explicit rule: features ship to mobile first, then port to web. This PR is shell + responsive layouts, not features.
2. **Responsive layouts that look fine on a 13-inch laptop and break on a 27-inch monitor.** Mitigated by setting a max content width (e.g., `max-w-7xl`) on every page and designing for two columns max on the largest screens, not endless expansion.
3. **Drift between mobile and web design systems.** The current `globals.css` is the source of truth for tokens. Mitigated by treating any new token as a system change that updates both surfaces. No web-only colors.
4. **The diagram builder on a touch laptop or tablet.** The diagram builder was designed for touch (mobile) first. On desktop, mouse interactions need to feel natural (drag with mouse, not finger). Mitigated by treating diagram builder as a discrete work item with explicit acceptance criteria for mouse interactions.
5. **Auth handoff from the marketing page.** Signup on marketing must cleanly land users in the app's onboarding. Mitigated by keeping marketing and app in the same Next.js project so the handoff is just a route navigation, not a domain hop.
6. **Confusion about where the project lives during the move from `unlock-mobile/unlock-app/` to `unlock-web/`.** Mitigated by doing the move as the first build (Build 1 in the build plan), with the system design doc describing both the old and new paths until the move is done.

## Open questions to resolve during build

- Top nav vs. sidebar: pick based on which feels right after prototyping. The system design doc covers both options.
- Max content width on desktop (1280px? 1440px?). Pick during Build 1 of the build plan.
- Marketing page copy: out of scope for this PRD, but a real launch needs real copy. Treat as a separate task closer to launch.
- Analytics: do we wire up basic page-view analytics on marketing and app? Punted to a future build, not blocking MVP.

## What's NOT changing

- The Supabase schema (tables, RLS, views). Anything the web app needs already exists in `qb_supabase_full_package/`.
- The mobile app. This work doesn't touch React Native code.
- The design tokens (colors, type, spacing). Same as mobile.
- The product surface (drills, roster, benchmarks, practice planner, dashboard). Same features, better shell.
- Authentication strategy. Supabase email/password, same as today.
