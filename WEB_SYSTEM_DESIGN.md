# Unlock Flag Football — Web System Design

Last updated: 2026-05-24
Owner: Taylor
Companion docs: `WEB_PRD.md`, `WEB_BUILD_PLAN.md`

## What this document is

The engineering blueprint for the web version of Unlock Flag Football. It explains how the project is structured, how data flows between web and mobile through the shared Supabase backend, how auth and RLS work, what's web-only, and the key technical decisions and their trade-offs. This is the document Claude Code (and any future engineer) leans on most.

A note on language: I'll define technical terms in plain English the first time they appear, because this doc is also a teaching doc.

## TL;DR

One Next.js 16 project at `unlock-web/`, sharing the same Supabase database as the React Native app at `unlock-mobile/`. Auth, RLS, and the design system are unified across both surfaces. The web app adds a responsive shell (sidebar on desktop, bottom tabs on mobile browser) and a public marketing route group at `/`. Existing pages (drills, roster, benchmarks, practice, dashboard) are kept and upgraded with responsive layouts rather than rewritten.

## Architecture at a glance

```
                       ┌─────────────────────────┐
                       │   Supabase (PostgreSQL) │
                       │   - Tables + RLS        │
                       │   - Auth                │
                       │   - Views               │
                       │   - RPCs                │
                       └────────────┬────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  │                                   │
        ┌─────────▼─────────┐               ┌─────────▼─────────┐
        │  unlock-mobile/   │               │   unlock-web/     │
        │  React Native     │               │   Next.js 16      │
        │  (Expo SDK 54)    │               │   (App Router)    │
        │                   │               │                   │
        │  Captains in the  │               │  Captains at a    │
        │  field, on phones │               │  desk, on laptops │
        │  and tablets      │               │  and tablets      │
        └───────────────────┘               └───────────────────┘
```

Two clients, one backend. Same auth tokens (a Supabase user has one identity regardless of where they sign in). Same RLS policies (a user only sees their own team's data, no matter which surface they're on). Same schema, so a drill created on web is the same row as a drill viewed on mobile.

## Project location

**Current:** `unlock-mobile/unlock-app/` (nested inside the mobile folder for historical reasons).

**Target:** `/Users/taylorpangilinan/Downloads/qb_supabase_database/unlock-web/` (top-level sibling to `unlock-mobile/`).

**Final top-level layout:**
```
qb_supabase_database/
  CLAUDE.md                     # Project decisions, both apps
  docs/                         # Cross-project docs (PRD, this doc, build plan)
  qb_supabase_full_package/     # Supabase schema, migrations, seed data, dashboard SQL
  unlock-mobile/                # React Native (Expo) app
  unlock-web/                   # Next.js 16 web app  <-- moved here
```

The move happens in Build 1 of the build plan. Until then, treat both paths as valid: anything inside `unlock-mobile/unlock-app/` is the web app.

## Tech stack

The stack is already in place. No changes unless we have a specific reason.

- **Framework**: Next.js 16 (App Router, `src/` directory)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 (tokens defined in `src/app/globals.css` via `@theme inline`)
- **Backend client**: `@supabase/supabase-js` for the JS SDK, `@supabase/ssr` for Next.js-aware cookie-based auth
- **Auth**: Supabase Auth with email/password
- **Hosting**: Vercel (auto-deploys from Git, edge-friendly)
- **Domain**: unlockflagfootball.com (DNS pointed at Vercel, automatic SSL)
- **State management**: React hooks + Supabase client. No Redux, no Zustand. Server components handle most reads; Client components with server actions handle writes.

**What's being removed:** PWA-specific configuration (`next-pwa`, the `apple-web-app` metadata, the scale-locked viewport). Reason: the original "web is the mobile app via PWA" strategy is dead. The React Native app is the mobile app now. The web version should behave like a normal responsive web app.

## Folder structure (after the move)

```
unlock-web/
  src/
    app/
      (marketing)/                # Public, unauthenticated routes
        page.tsx                  # / — Landing page
        about/page.tsx            # Optional, later
        layout.tsx                # Marketing shell (header, footer)
      (app)/                      # Authenticated routes
        layout.tsx                # App shell (sidebar/topnav, team context)
        page.tsx                  # /dashboard — Coach dashboard (was /)
        drills/                   # Existing drill library + diagram
        roster/                   # Existing roster
        benchmarks/               # Existing benchmark logging
        practice/                 # Existing practice planner
        team-setup/page.tsx       # Existing onboarding for new coach
        settings/page.tsx         # Existing settings
      (auth)/                     # Public auth routes
        login/page.tsx
        signup/page.tsx
        auth/callback/route.ts    # Supabase OAuth callback (kept for future)
      _paused/                    # Routes that exist but are not in scope
        log/                      # Old workout/throwing/game-recap/recovery
        library/                  # Old route/coverage/concept libraries
        progress/                 # Old individual QB progress page
        onboarding/page.tsx       # Old QB onboarding (different from team-setup)
      globals.css                 # Design tokens — shared with mobile in spirit
      layout.tsx                  # Root layout, sets html/body, fonts
    components/
      app/                        # App-shell components (Sidebar, TopNav, etc.)
      marketing/                  # Marketing-only components (Hero, Features)
      shared/                     # Cross-context components (Button, Card, etc.)
      DiagramEditor.tsx           # Existing, kept
      DiagramRenderer.tsx         # Existing, kept
    lib/
      supabase/
        client.ts                 # Browser-side Supabase client
        server.ts                 # Server-side Supabase client
      team-context.tsx            # Existing TeamProvider — kept
      generate-setup-instructions.ts  # Existing diagram util
      route-geometry.tsx          # Existing diagram util
    middleware.ts                 # Auth/route gating (will rename to proxy.ts per Next 16)
    types/
      diagram.ts                  # Existing
  public/                         # Static assets
  next.config.ts
  tailwind.config.js
  tsconfig.json
  package.json
  CLAUDE.md                       # Web-app-specific engineering notes
```

Two new concepts to flag:

**Route groups** (the `(marketing)`, `(app)`, `(auth)` folders): In Next.js App Router, a folder name in parentheses is a "route group." It does NOT show up in the URL — it's just a way to organize routes and give each group its own `layout.tsx`. So `(app)/dashboard/page.tsx` is the file at the URL `/dashboard`, with its own app-shell layout. This lets us have a marketing layout (with marketing header/footer) and an app layout (with sidebar/topnav) without those layouts bleeding into each other.

**Underscore folders** (`_paused/`): Next.js ignores any folder that starts with an underscore for routing. So `src/app/_paused/log/workout/page.tsx` is not a real URL. The code is preserved (for when the individual QB tracking MVP resumes), but it doesn't ship. This is cleaner than deleting the files (Git history is preserved either way, but having the code locally makes future restoration easier).

## How data flows between mobile and web

This is the most important section. The whole point of this project is "data is connected and flowing correctly."

### One database, two clients

Both the React Native app and the Next.js web app talk to the same Supabase project using the same anon API key (a public key that's safe to ship in client code; RLS is what protects data). The schema, RLS policies, and views in `qb_supabase_full_package/` are the source of truth. When the mobile app inserts a row into `team_drills`, the web app sees that row the next time it queries (or instantly, if we ever wire up Supabase real-time subscriptions, which is out of scope for now).

### Identity and auth

Supabase Auth issues a JWT (a signed token that proves who you are) when a user logs in. That token is what RLS checks against — every query Supabase runs includes `auth.uid()`, which is the user's ID extracted from the token.

- On **mobile**, the token is stored in `expo-secure-store` (encrypted keychain on iOS, Keystore on Android).
- On **web**, the token is stored in HTTP-only cookies, managed by `@supabase/ssr`. Cookies travel automatically with every request, including server-side rendering, which is why the SSR helpers exist.

A user can log in on web with the same email/password and they ARE the same user — same `auth.users.id`, same RLS access, same team memberships. This works out of the box because Supabase Auth is a centralized service that both clients hit. We don't have to do anything special.

### RLS — the safety net

RLS (Row-Level Security) is a Postgres feature where the database itself enforces "user X can only see rows where some condition is true," based on the JWT in the request. Every table in our schema has RLS policies. The pattern is roughly:

- **Personal data tables** (e.g., `workout_sessions` from the paused individual MVP): `user_id = auth.uid()`. A user only sees their own rows.
- **Team-scoped data** (e.g., `team_drills`, `team_players`, `benchmark_results`): the user must be a member of the team. We use a helper function `get_my_team_ids()` (defined as `SECURITY DEFINER` to avoid the RLS-on-team_members recursion bug we fixed in migration 07) to check membership.

What this means for engineering: **we don't filter by user in our queries.** RLS does it for us. If I write `supabase.from('team_drills').select('*').eq('team_id', teamId)`, Postgres adds the membership check automatically. If the user isn't on that team, they get an empty result, not an error. This is intentional. It's also why we never expose the Supabase service-role key on the client (the service role bypasses RLS).

### Data flow examples

**Example 1: Captain builds a drill at home on web.**
1. Web page (`/drills/new`) renders a `DrillForm` (client component) and the `DiagramEditor`.
2. Captain fills out the form, places cones on the diagram, hits Save.
3. Form calls a server action (function marked `'use server'`) that runs on Vercel's server.
4. Server action calls `supabase.from('team_drills').insert(...)` using the SSR client (which has the user's auth cookie).
5. RLS verifies the captain is a member of the team. Row is written.
6. `revalidatePath('/drills')` tells Next.js the drills list is stale; next render re-fetches.
7. The captain navigates to the mobile app at practice the next day. Mobile app queries `team_drills` for the same team. The new drill appears.

**Example 2: Captain logs a benchmark on mobile at practice.**
1. Mobile screen calls `supabase.from('benchmark_results').insert(...)` via the React Native Supabase client.
2. Row is written.
3. Captain checks the web dashboard from home that evening. Server component fetches `vw_team_strength_weakness` (a pre-built view). The new benchmark is included in the aggregate.

No real-time wiring required for either case. The dashboard reflects whatever the database has at the time of the page request. If we want push-style live updates later, Supabase real-time subscriptions can be added without changing the schema.

### Schema changes

The schema lives in `qb_supabase_full_package/`. Any schema change (new column, new table, new view) is a SQL migration applied via the Supabase dashboard or CLI. After the migration runs, both mobile and web see it. No client-side migrations.

Rule for adding a schema change: think about how it works for both surfaces before merging. If a new column is only useful on web, it still has to not break mobile (don't make it required in app code that hasn't been updated). The pattern is: add the column as nullable, update both clients to use it (mobile first, then web), then optionally tighten constraints later.

## Authentication and routing

### Public vs. authenticated routes

- **Public** (no login required): `/` (marketing landing), `/login`, `/signup`, `/auth/callback`
- **Authenticated** (login required): everything in `(app)/` — `/dashboard`, `/drills`, `/roster`, `/benchmarks`, `/practice`, `/team-setup`, `/settings`

### Middleware (`src/middleware.ts`, renaming to `src/proxy.ts` per Next 16)

Middleware runs on every request before the route renders. It does two things:

1. **Redirect unauthenticated users away from authenticated routes.** If someone hits `/dashboard` without a session, send them to `/login`.
2. **Redirect authenticated users away from auth-only routes.** If someone with a session hits `/login`, send them to `/dashboard`.

The public marketing routes (`/`, `/about`, etc.) are accessible to both states. A logged-in user can still see the marketing page if they navigate to it directly — that's fine.

The existing middleware does the first two. We'll add a third behavior in this project:

3. **Redirect users who haven't completed team setup to `/team-setup`.** Defined by: user has no row in `team_members`. This was noted as a future cleanup in the existing CLAUDE.md and is in scope now.

### Auth handoff from marketing to app

When a visitor hits `/signup` from the marketing page, they go through Supabase signup, then we redirect to `/team-setup` (if they have no team yet) or `/dashboard` (if they're already on a team — which only happens if they got invited and signed up after the fact). This handoff is the same as it works today; we're just adding a marketing page that links to it.

## The responsive layout system

This is the heart of the UI work. The mobile-browser layout still matters; we're adding a desktop layout on top.

### Breakpoints (Tailwind defaults)

- `sm`: 640px (large phone landscape)
- `md`: 768px (tablet portrait, small laptop)
- `lg`: 1024px (laptop)
- `xl`: 1280px (large laptop, monitor)
- `2xl`: 1536px (large monitor)

### App shell pattern

Below `md` (768px), the app uses the existing pattern: content fills the width with 20px horizontal padding, fixed bottom nav. Same as today.

At `md` and above, swap to a desktop shell:

- **Sidebar** (recommended over top nav for this product, because we have a small number of destinations and the sidebar gives more room for a team selector and a user menu): 240px fixed width on the left, full height, with the same destinations as the bottom nav (Dashboard, Drills, Roster, Practice) plus Settings at the bottom.
- **Main content area** with `max-w-7xl` (1280px) inside, centered, with comfortable horizontal padding (probably 32px or 40px at desktop sizes).
- **No bottom nav** at `md` and up.

The sidebar and bottom nav are conditionally rendered based on screen size. CSS-only solutions (with `hidden md:flex` and `md:hidden`) are simplest and avoid layout flash. Alternative is a JS-based hook, but we don't need it.

### Page-level patterns

Each existing page (drills list, roster, practice list, dashboard) needs a responsive layout update. The general pattern:

- **List pages**: stack of cards on mobile, table or two-column grid on desktop. Filters move from a top bar to a left panel on desktop.
- **Detail pages**: single-column on mobile, two-column on desktop (main content + side panel for metadata/actions).
- **Form pages**: stay single-column at all sizes, capped at a comfortable max width (e.g., `max-w-2xl`). Forms wider than ~700px are hard to read.
- **Dashboard**: grid that flexes from 1 column (mobile) to 2-3 columns (desktop). Charts and stat cards take advantage of width without overflowing.

Specific layouts per page are scoped in the build plan.

### Touch targets and pointer interactions

The existing 44x44px minimum applies on mobile. On desktop, hover states matter — every interactive element needs a hover style (background lightens, cursor pointer, etc.) so users get feedback. This is a small but real piece of "feels like a desktop app, not a phone app rendered big."

The diagram editor specifically needs mouse support that feels natural: click to place cone (currently tap), drag with mouse (currently touch drag), undo on Cmd/Ctrl+Z, etc. Touch still works for tablet users.

## Marketing landing page

### Approach

A single `(marketing)/page.tsx` at `/`, server-rendered for fast initial paint. No client-side router for now (the marketing site is small).

Sections in order:
1. **Hero**: Headline, subhead, primary CTA (Sign up free), screenshot of the dashboard. Background: surface-base.
2. **Who it's for**: Two or three cards describing target users (captain planning practice, captain benchmarking players, team trying to win their tournament).
3. **Features**: Three or four feature cards with icon + short copy. Drill library with diagrams, roster + benchmarks, practice planner, dashboard.
4. **How it works**: Simple three-step flow. Build your drill library → Benchmark your players → Plan smarter practices.
5. **Social proof slot**: Empty for now (no testimonials yet), but the section exists so it's easy to drop in.
6. **CTA repeat**: Final sign-up button.
7. **Footer**: Contact, basic legal links, social.

### Copy

Out of scope for this project — the build plan flags it as a placeholder. Real copy will use the `design:ux-copy` skill closer to launch.

### Routing

- `/` → marketing landing (public)
- `/about` → optional, future
- `/signup` and `/login` are linked from marketing CTAs
- Logged-in users who navigate to `/` see the marketing page (we don't auto-redirect them, since they might be sharing the link). They have a "Go to dashboard" button visible if they're logged in.

## Key design decisions and trade-offs

### One Next.js project (marketing + app) vs. two

**Decided**: one project, two route groups.

Pros of one project:
- Simpler deploy and infra (one Vercel project, one domain)
- Shared design tokens, components, Supabase setup
- Auth handoff is a route navigation, not a domain hop
- Easier for Claude Code to reason about

Cons:
- Marketing changes can't ship independently from app changes (mitigated: not a current pain point)
- If marketing grows into a content site with CMS, we'd need to revisit

### Sidebar vs. top nav on desktop

**Decided**: sidebar.

Pros of sidebar:
- More room for the team selector (likely a multi-team future)
- Easier to add destinations later (Settings, eventually Players, Reports, etc.)
- Feels right for an app, less for a marketing site

Cons:
- Slightly less screen width for content (240px sidebar means content gets 1040px on a 1280px max-width center)
- Mitigated: 1040px is still comfortable for any of our content types

Top nav alternative is fine and we can switch later — it's a layout change, not an architectural one.

### Server components vs. client components

**Default to server.** Pages are server components unless they need React state or browser APIs (forms, the diagram editor, anything interactive). This pattern:

- Read data in a server component (calls `createClient` from `lib/supabase/server.ts`)
- Pass data as props to a client component if interactivity is needed
- Writes happen via server actions (a `'use server'` function called from a client component)

This minimizes client-side JS shipped to the browser and keeps Supabase service calls server-side where they're more secure.

### Keep the existing pages or rewrite them

**Decided**: keep. See PRD for the salvage-value reasoning. The Build Plan calls out specific responsive upgrades per page, not rewrites.

### Real-time sync

**Decided**: skip for MVP.

Pros of real-time:
- Captain A's edit to the practice plan shows up live for Captain B
- Feels modern

Cons:
- Adds connection management code, edge cases (offline, reconnect), and tests
- Captains will mostly use this asynchronously, not simultaneously
- Easy to add later if we hit the case where it matters

### PWA install on web

**Decided**: remove.

The original PWA-as-app strategy is dead now that there's a React Native app. Keeping the install prompt creates two competing "install on phone" paths (App Store / TestFlight via React Native vs. Add to Home Screen via PWA) and confuses users. The web app should be a normal responsive website.

## Things to be careful about

**Don't accidentally break mobile by changing shared schema.** If you add a `NOT NULL` column to a table the mobile app writes to, mobile will throw. Always add nullable, then tighten later.

**Don't expose service-role keys on the client.** Only the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` go in `.env.local` for client use. The service-role key (if we ever need one for admin scripts) lives in server-only environment variables and is never used in a component that ships to the browser.

**Don't disable RLS to "make a query work."** If a query is returning empty when you expect rows, it means RLS thinks the user shouldn't see those rows. Fix the policy or use the correct user context. Turning RLS off opens up a cross-team data leak.

**The middleware filename will throw deprecation warnings in Next 16.** Rename `src/middleware.ts` to `src/proxy.ts` (and rename the exported `middleware` function to `proxy`). This is a noted carry-over from the existing project. Do it during Build 1.

**Local Supabase requires email confirmation off.** Same as today. Authentication → Providers → Email → "Confirm email" must be off in the dashboard for local signup to work without bouncing back to login. Re-enable for production.

## Environment variables

`.env.local` in `unlock-web/`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Same values as the mobile app's `.env.local`. Both apps point at the same Supabase project.

Vercel deploys read environment variables from the project settings. Production and Preview environments share the same Supabase project for now (we can split later if we want a staging DB).

## Open questions (resolve during build, not blocking start)

- Top nav vs. sidebar: confirmed sidebar in this doc, but if the first prototype feels wrong, switch.
- Max content width: 1280px (`max-w-7xl`) is a reasonable starting point. Tune after seeing the dashboard at that width.
- Where Settings lives in the nav: sidebar bottom is the plan, can move to a user menu in the header if it feels cleaner.
- Whether to wire Supabase real-time on the dashboard (probably no for MVP).
- Analytics: Plausible or Vercel Analytics. Defer.

## What this design intentionally doesn't cover

- Detailed API contracts for each page. Existing pages already query the schema correctly; new code follows the same patterns.
- Exact component prop signatures. That's implementation detail for Claude Code in each build.
- CI/CD details beyond "Vercel auto-deploys from Git." Not changing.
- Test strategy. The existing project doesn't have a test suite, and adding one is out of scope for this work. Worth a follow-up conversation.

## Documents this links to

- `WEB_PRD.md` — what we're building and why
- `WEB_BUILD_PLAN.md` — phased build order with acceptance criteria
- `qb_supabase_full_package/docs/coach_mvp_schema_spec.md` — schema source of truth
- `unlock-mobile/CLAUDE.md` — mobile app conventions (mirror for consistency)
- `unlock-mobile/unlock-app/CLAUDE.md` — current web app engineering doc (will be moved/updated to `unlock-web/CLAUDE.md` during Build 1)
