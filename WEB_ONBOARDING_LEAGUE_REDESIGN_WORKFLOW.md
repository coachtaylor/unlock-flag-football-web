# Web Onboarding + League Support: Build Workflow

**Document purpose.** The web counterpart to `ONBOARDING_LEAGUE_REDESIGN_WORKFLOW.md` (which lives at the project root and was written for the mobile app). It tells Claude Code exactly how to bring the new onboarding flow, the League entity, and the new dashboards to the Next.js web app at `unlock-web/`. Written to be picked up and executed without needing to ask follow-up questions.

**Author's note (Taylor):** This is the spec. The order below is the order to build in. Do not jump ahead.

**Status of upstream work (as of 2026-05-24):**
- Schema migrations (mobile doc §4, files `sql/47_*.sql` through `sql/52_*.sql`) are **applied to Supabase**. The `leagues` table, `league_members`, `teams.league_id`, `profiles.first_name`, `profiles.last_name`, `get_my_league_ids()`, `get_my_team_ids_incl_league()`, `create_league_with_admin`, and the extended `create_team_with_member` RPC all exist. Treat them as given.
- Onboarding is **built and shipped on mobile** (`unlock-mobile/`). Web is the next surface. The mobile UX is the reference — copy and behavior should match unless this doc explicitly diverges.

---

## 1. What's shared with the mobile doc (do not duplicate)

To keep this doc tight and avoid drift, the following sections of `ONBOARDING_LEAGUE_REDESIGN_WORKFLOW.md` are the source of truth and are NOT repeated here:

- **§1** Context: what exists today (profiles, teams, team_members, team_players, current RPC)
- **§2** Goals and non-goals
- **§3** Decisions already made (locked)
- **§4** Data model changes (schema, RLS, helpers, RPCs) — already applied to Supabase
- **§7** Backfill flow for existing users (the product logic is identical; web-specific implementation is in §6 below)
- **§8** UX copy reference — every screen's copy. Web uses these strings verbatim.
- **§12** Risks and what to revisit
- **§14** Open questions to surface AFTER this is built

If you find yourself wanting to change one of those, change the mobile doc first (it's the source of truth) and then propagate. Don't fork the spec.

This doc covers: Next.js implementation paths, route groups, the web-specific shell, server/client component decisions, responsive considerations, the file-by-file change plan for the web project, and web-specific acceptance criteria.

---

## 2. Where this fits in the existing web plan

This work is a **new build in the web build plan**, slotting in after Build 1 (Project relocation + responsive shell foundation) and before Build 3 (Dashboard responsive upgrade). Reason: the dashboard responsive upgrade should be done against the NEW dashboard structure (user dashboard + league dashboard + team dashboard), not the old single-dashboard layout.

Update `WEB_BUILD_PLAN.md` to insert this as **Build 2.5: Onboarding + Leagues** (or renumber subsequent builds — either works, just be consistent).

Why not earlier in the order? Build 1 is structural — moving the project, route groups, responsive shell. That has to happen first so this build has a clean foundation to land on. The marketing landing page (Build 2) is independent of onboarding and can ship in parallel.

---

## 3. Web context: what's different from mobile

Most of the product is identical across surfaces. Where the web specifically diverges:

**Routing.** Web uses Next.js App Router with the route groups defined in `WEB_SYSTEM_DESIGN.md`:
- `(marketing)/` — public, no auth
- `(auth)/` — signup, login, callback
- `(app)/` — authenticated app, sidebar shell at `md+`, bottom nav below `md`
- `(onboarding)/` — NEW route group introduced by this build. Authenticated but NO sidebar/bottom nav (onboarding gets its own shell)

**Server-side first paint.** Next.js renders the first page on the server. That means the routing decision ("which onboarding step is next?" or "which dashboard?") happens in middleware (`src/proxy.ts`) and in server components, before any JS reaches the browser. No flash of the wrong screen.

**Backfill modal trigger.** On mobile, the backfill modal is checked in a hook on app entry. On web, it's checked in the `(app)/layout.tsx` server component on every page render. If `profiles.first_name is null` and `profiles.onboarding_completed_at is not null`, render the modal. This works for both first paint and subsequent client-side navigations.

**Responsive considerations.** The onboarding shell on web has to look right on a 375px phone browser AND a 1440px desktop. Mobile-first responsive: single-column, max-width 480px, vertically centered on desktop, full-bleed on mobile (per mobile doc §9). No sidebar during onboarding regardless of screen size.

**Forms = client components with server actions.** Onboarding screens are client components (they manage local form state and a submit button). The submit calls a server action (`'use server'` function) that updates `profiles` and redirects. This is the standard Next.js pattern and matches how the existing web app handles forms.

**Captain view toggle (web specifics).** The toggle is client-side state. The two render paths it switches between can both be server-fetched (one for coach view, one for player view). Pick the simpler pattern: render coach view by default, swap to player view with `useState` and a client-side data refetch (or pre-fetch both and toggle visibility). Decide during implementation based on data load.

**Backwards compatibility with existing web routes.** The web app currently has `/team-setup` and `/onboarding` (the old QB onboarding, moved to `_paused/` in Build 1). Neither survives this build. Replace `/team-setup` references with the new `/onboarding/scope` → `/onboarding/role` → New Team flow. Delete or redirect the legacy `/team-setup` route.

---

## 4. Routing map (web-specific)

After this build, the web app's authenticated routes look like:

```
/                                  -- marketing landing (public)
/login                             -- auth (public)
/signup                            -- auth (public)
/auth/callback                     -- supabase oauth callback (public)

/onboarding/name                   -- step 1 (authenticated, onboarding shell)
/onboarding/scope                  -- step 2
/onboarding/role                   -- step 3 (single team branch only)
/onboarding/create-league          -- step 4 league branch
/onboarding/new-team               -- step 4 single team branch (this is the new home for team creation during onboarding; replaces the old /team-setup)

/dashboard                         -- user dashboard (home, post-onboarding) (app shell)
/dashboard/league/[leagueId]       -- league dashboard (app shell)
/dashboard/team/[teamId]           -- team dashboard (app shell)

/teams/new                         -- add team flow with smart league picker (app shell). Used post-onboarding.
/settings                          -- (app shell)
/drills, /roster, /practice, /benchmarks  -- existing app routes, now under (app) group from Build 1
```

**Naming note.** The mobile doc puts the team-creation step at `/teams/new`. On web we have two contexts:
1. **During onboarding (single team branch):** new user creating their first team. Use `/onboarding/new-team` so onboarding-shell wraps it (no sidebar, focused experience).
2. **Post-onboarding:** existing user adding another team. Use `/teams/new` with the app shell (sidebar visible).

Both routes render essentially the same form (`TeamForm.tsx` component shared between them). The only differences are the wrapping layout and what happens on success (onboarding marks `onboarding_completed_at`; post-onboarding just goes to the new team dashboard).

---

## 5. Middleware / routing logic (`src/proxy.ts`)

The simplified routing logic from mobile doc §6.5 applies on web too, but it happens in middleware so the user never sees a wrong-page flash.

On every request to an authenticated route, the proxy does this (in order):

1. **No session?** Redirect to `/login`.
2. **Session exists, fetch profile.** If we don't have the profile cached on the request, hit Supabase for `first_name`, `onboarding_step`, `onboarding_completed_at`.
3. **Onboarding not complete?** Redirect to the next onboarding step:
   - `onboarding_step` is 0 or null → `/onboarding/name`
   - `onboarding_step` is 1 → `/onboarding/scope`
   - `onboarding_step` is 2 → `/onboarding/scope` (re-pick — the scope choice isn't persisted to DB, it's in URL/state. If they got past 2 they either completed step 3 or step 4-league, so check `onboarding_completed_at` instead.)
   - `onboarding_step` is 3 → `/onboarding/new-team` (single team branch chose role, now create team)
   - `onboarding_completed_at is null` and step is 4 → they were creating a team or league and dropped off. Route to whichever they were doing. Storing scope in client state is fragile — see §7 below for the durable approach.
4. **Onboarding complete, first_name is null?** Allow the request through. The backfill modal will render on top of the dashboard.
5. **Otherwise** → allow.

For public routes (`/`, `/login`, `/signup`, `/auth/callback`, all marketing routes), the middleware does NOT redirect, even if the user is logged in. They can browse the marketing page while logged in (with a "Go to dashboard" CTA in the header).

**Performance note.** Don't hit Supabase on every single request — that adds latency to every page load. Two ways to handle this:
- Cache the onboarding-status check in a cookie that gets set when onboarding completes, invalidated when they re-enter the onboarding flow.
- Or, only check onboarding status when the request path starts with `/dashboard`, `/onboarding`, `/teams`, `/settings`, `/drills`, `/roster`, `/practice`, `/benchmarks`. Skip the check on `/login`, `/signup`, marketing.

Recommended: do both. The path filter saves the check entirely on public routes; the cookie cache makes the check fast on authenticated routes.

---

## 6. The onboarding shell (`(onboarding)/layout.tsx`)

A new route group `(onboarding)/` with its own layout. Reasons it's separate from `(app)/`:
- No sidebar, no bottom nav during onboarding (matches mobile UX per mobile doc §9)
- Different visual treatment: centered card, progress dots at top
- The user is technically authenticated but they don't have a team yet, so the `(app)` layout's team context would fail

**Layout structure:**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│           ● ● ○ ○   (progress dots)             │
│                                                 │
│       ┌─────────────────────────────┐           │
│       │                             │           │
│       │   [Current step content]    │           │
│       │                             │           │
│       │   max-w-[480px] centered    │           │
│       │                             │           │
│       └─────────────────────────────┘           │
│                                                 │
│       [Back]                  [Continue]        │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Responsive behavior:**
- Mobile (`<md`): full-bleed (no margins beyond 20px horizontal padding), card spans full content width. Progress dots top, content middle, CTAs at the bottom (sticky if needed).
- Desktop (`md+`): card vertically centered on the page, max-width 480px, comfortable padding around the card. Progress dots above the card. CTAs below the card.
- No sidebar at any size.

**Components needed:**
- `OnboardingShell` — the layout wrapper. Takes current step number (1-4) as a prop or derives it from the route.
- `OnboardingProgress` — the dots row.
- `OnboardingCard` — the centered card body with consistent padding.
- `OnboardingFooter` — back/continue button row.

These all live in `src/components/onboarding/`.

---

## 7. Persisting onboarding state across steps

Mobile uses client state to remember the "scope" choice (League vs Single Team) and the "role" choice between screens. On web, that's risky: a user navigating away and back, or hitting Refresh, loses state.

**Two options:**

**Option A (recommended): URL-encoded state.**
- After step 2, route to either `/onboarding/role?scope=single` or `/onboarding/create-league?scope=league`. The scope lives in the URL.
- After step 3, route to `/onboarding/new-team?scope=single&role=coach` or `?role=captain`.
- The team creation page reads `role` from the query string and passes it to the RPC.
- Pros: durable across refreshes, no DB writes for intermediate state, easy to debug (URL tells you exactly where you are).
- Cons: URL gets ugly. Mitigation: only the onboarding routes have these params, and they're transient.

**Option B: persist scope/role to a new column on profiles.**
- Add `onboarding_scope text` and `onboarding_role text` columns (nullable).
- Write them on submit of each step.
- Cleaner URLs but requires a schema migration.

Recommended: **Option A** for MVP. If we ever need server-side resumption (e.g., support team can see exactly where a user got stuck), Option B becomes attractive. Until then, the URL approach is faster.

**`onboarding_step` is still updated in the DB** after every step (mobile doc §4.9). That's how middleware knows where to send a user who closes the tab mid-flow. URL params only carry "branch decisions" within the current session.

---

## 8. Screen-by-screen implementation (web specifics)

Use the copy from mobile doc §8 verbatim. This section covers what each web screen renders and what it does on submit.

### Step 1: Name — `/onboarding/name`

**File:** `src/app/(onboarding)/name/page.tsx` (server component shell) + `NameForm.tsx` (client component for the form).

**Server component:** Reads the session, redirects to `/dashboard` if `onboarding_completed_at` is set (defensive), otherwise renders the page.

**Client component:** Two text inputs + Continue button. On submit, calls a server action:

```ts
// src/app/(onboarding)/name/actions.ts
'use server';
export async function submitName(firstName: string, lastName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const displayName = `${firstName.trim()} ${lastName.trim()}`;
  await supabase.from('profiles').update({
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    display_name: displayName,
    onboarding_step: 1,
  }).eq('id', user.id);

  redirect('/onboarding/scope');
}
```

**Validation:** Both fields required, 1-50 chars each. Trim whitespace before saving.

### Step 2: Scope — `/onboarding/scope`

**File:** `src/app/(onboarding)/scope/page.tsx` (client component is fine here — no DB write until they continue).

Two `BigChoiceCard` components: Single team and League. Selected state shown with a check. Continue button enabled when one is selected.

**On submit:**
- Update `profiles.onboarding_step = 2`.
- Route to:
  - `/onboarding/role?scope=single` if Single team
  - `/onboarding/create-league?scope=league` if League

### Step 3: Role — `/onboarding/role` (single team branch only)

**File:** `src/app/(onboarding)/role/page.tsx`.

Reads `scope` from search params; if not `single`, redirect to `/onboarding/scope` (defensive: someone shouldn't land here from the league branch).

Two `BigChoiceCard` components: Coach and Captain. On submit:
- Update `profiles.onboarding_step = 3`.
- Route to `/onboarding/new-team?scope=single&role=coach` or `?role=captain`.

### Step 4-Single: New Team — `/onboarding/new-team`

**File:** `src/app/(onboarding)/new-team/page.tsx`.

Renders the shared `TeamForm` component (also used by `/teams/new` post-onboarding). Reads `role` from query string. Passes `role` into the server action that calls `create_team_with_member(p_league_id => null, p_role => role)`.

**On success:**
- Update `profiles.onboarding_completed_at = now()`.
- Redirect to `/dashboard/team/[newTeamId]`.

**Key behavior:** This route uses the `(onboarding)` layout (no sidebar). The post-onboarding `/teams/new` uses the `(app)` layout (with sidebar). Same form component, different shells.

### Step 4-League: Create League — `/onboarding/create-league`

**File:** `src/app/(onboarding)/create-league/page.tsx`.

Form fields: League name (required), default format (5v5 / 7v7 / both), league color (8-swatch picker — reuse the existing color picker from the team form).

**On submit:**
- Call `create_league_with_admin(p_league_name, p_format, p_league_color)`.
- Update `profiles.onboarding_completed_at = now()`.
- Redirect to `/dashboard/league/[newLeagueId]`.

---

## 9. Dashboard implementation (web specifics)

### 9.1 User dashboard — `/dashboard`

**File:** `src/app/(app)/dashboard/page.tsx`.

This is a server component. Fetches the user's leagues and teams (excluding teams that are inside one of their leagues, to avoid duplication). Renders two sections per mobile doc §6.3:

- **My leagues** section, with `LeagueDashboardCard` per league.
- **My teams** section, with `TeamDashboardCard` per standalone team.

**Data fetch helper:** Create `src/lib/dashboard/user-home-data.ts` with a single server function:

```ts
export async function getUserHomeData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Leagues where user is a league_admin
  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, league_name, league_color, format, league_members(count), teams(count)');

  const leagueIds = (leagues ?? []).map(l => l.id);

  // Teams where user is a team_member AND team is NOT inside one of their leagues
  const { data: teams } = await supabase
    .from('teams')
    .select('id, team_name, team_color, format, league_id, team_members!inner(role), team_players(count)')
    .or(`league_id.is.null,league_id.not.in.(${leagueIds.join(',') || 'null'})`)
    .eq('team_members.user_id', user.id);

  return { leagues: leagues ?? [], teams: teams ?? [] };
}
```

(The exact query syntax may need tuning against Supabase's PostgREST behavior — verify the OR + IN combination works as expected. RLS handles user-scoping automatically; the explicit `team_members.user_id` filter is to scope the join, not for security.)

**Responsive layout:**
- Mobile: single column, sections stacked, cards full width.
- Tablet (`md`): two-column grid for cards within each section.
- Desktop (`lg+`): three-column grid for cards within each section, max-width container.

**Section headers** include the section label and the section-level CTA (`+ New league` or `+ Add team`).

**Empty states** per mobile doc §6.3 — including the all-empty case (zero leagues AND zero teams).

### 9.2 League dashboard — `/dashboard/league/[leagueId]`

**File:** `src/app/(app)/dashboard/league/[leagueId]/page.tsx`.

Server component. Fetches the league record and its teams.

**Header:** League name, league color swatch (left border accent on a header card), `+ Add team` button (primary CTA).

**Body:** Grid of team cards (`TeamDashboardCard` or a specialized `LeagueTeamCard`). Per-card data: team name, color, format, player count, coach count, last practice date.

**Empty state:** "No teams yet. Add your first team to get started." with centered Add team CTA.

**Responsive:** mobile = single column stack, tablet = 2 columns, desktop = 3 columns.

**Add team button behavior:** Routes to `/teams/new?leagueId=[leagueId]`. The team creation form reads `leagueId` from search params and pre-selects that league in the picker (or hides the picker entirely since the league is implied).

### 9.3 Team dashboard — `/dashboard/team/[teamId]`

**File:** `src/app/(app)/dashboard/team/[teamId]/page.tsx`.

This is the page that was previously at `/` (the existing coach dashboard). Move its content here. Add the Captain view toggle at the top when the current user has both a `team_members.role = 'captain'` row AND a `team_players` row with `is_captain = true` for this team.

**Captain toggle implementation:**
- Server component fetches both coach-view data and (if applicable) player-view data.
- Wrap the page body in a client component that holds `useState('coach' | 'player')` and renders the appropriate view.
- Default: 'coach' (per mobile doc §3 decision).

**No nav changes:** the sidebar still shows Dashboard, Drills, Roster, Practice, Settings. Dashboard now means `/dashboard` (the user home). Clicking a team card from the user home brings you here.

### 9.4 Smart Add Team picker — `/teams/new`

**File:** `src/app/(app)/teams/new/page.tsx`.

Renders the shared `TeamForm` component (same one used during onboarding) wrapped in the `(app)` layout.

**Picker behavior per mobile doc §6.4:**
- Zero leagues → hide the picker, just create a standalone team.
- One league → small selector: `[League name]` (pre-selected) vs `Standalone team`.
- Multiple leagues → dropdown listing each league + Standalone option, no default.

**Pre-selection from query params:** if `?leagueId=X` is in the URL (e.g., user clicked "+ Add team" from a league dashboard), pre-select that league. Hide the picker entirely or show it pre-filled — your call. Hiding it is simpler and less confusing.

**On submit:** Call `create_team_with_member(p_league_id, p_role, ...)`. Validate that the user is a league admin of `p_league_id` if it's set (the RPC and RLS already do this, but a client-side check provides a faster error message).

**After creation:** Route to `/dashboard/team/[newTeamId]`.

---

## 10. Backfill modal (web specifics)

Mobile doc §7 describes the flow. Web-specific implementation:

**Trigger location:** `src/app/(app)/layout.tsx` (the authenticated app layout). Server component checks `profiles.first_name` on every authenticated render.

```tsx
// (simplified)
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, onboarding_completed_at')
    .eq('id', user!.id)
    .single();

  const needsBackfill = profile?.onboarding_completed_at && !profile?.first_name;

  return (
    <div>
      <Sidebar />
      <main>{children}</main>
      {needsBackfill && <BackfillModal />}
    </div>
  );
}
```

**`BackfillModal` component:** `src/components/BackfillModal.tsx`. Client component (it has interactive form state and a close action).

- Renders as an overlay (`position: fixed`, dark backdrop, centered card).
- Title: "Quick update." Body copy per mobile doc §7.
- Inputs: First name, Last name.
- On submit, calls a server action that updates `profiles.first_name` and `profiles.last_name` (does NOT touch `onboarding_step` or `onboarding_completed_at`).
- After successful submit, the modal closes. Next page render won't include it (the trigger condition no longer holds).

**Not dismissible without submitting.** The mobile doc says the modal blocks the dashboard. On web, no close button — just the form. They have to fill it out to proceed. (If we discover this annoys users, soften to "Remind me later" in a follow-up.)

**Banner for legacy `organization_name` users:** Mobile doc §7 step 6 mentions a one-time banner on the team dashboard suggesting they create a league. On web, implement as a dismissible banner at the top of `/dashboard/team/[teamId]` when the team has a non-empty `organization_name` and the user is not already a member of any league. Track dismissal in localStorage (cheap, scoped per device — fine for an opt-in suggestion).

---

## 11. File-by-file change plan (web only)

Sticking to the same numbered convention as the mobile doc, but for the web codebase. Schema work (mobile doc files 1-6) is done — skip it.

### New routes under `(onboarding)/`

1. `src/app/(onboarding)/layout.tsx` — `OnboardingShell` with progress dots, centered card body, footer.
2. `src/app/(onboarding)/name/page.tsx` + `NameForm.tsx` + `actions.ts` — Step 1.
3. `src/app/(onboarding)/scope/page.tsx` — Step 2.
4. `src/app/(onboarding)/role/page.tsx` — Step 3 (Single Team branch).
5. `src/app/(onboarding)/create-league/page.tsx` + `actions.ts` — Step 4-League.
6. `src/app/(onboarding)/new-team/page.tsx` — Step 4-Single. Wraps the shared `TeamForm` in the onboarding shell.

### New routes under `(app)/`

7. `src/app/(app)/dashboard/page.tsx` — User dashboard (home). NEW. Always the post-login landing page.
8. `src/app/(app)/dashboard/league/[leagueId]/page.tsx` — League dashboard.
9. `src/app/(app)/dashboard/team/[teamId]/page.tsx` — Team dashboard (this is the OLD `/` page from before Build 1, moved here and updated with Captain toggle).
10. `src/app/(app)/teams/new/page.tsx` — Post-onboarding Add Team with smart League picker.

### Routes to delete or redirect

11. Delete: `src/app/(app)/team-setup/page.tsx` (the old team-setup screen, now replaced by the onboarding flow).
12. Delete: `src/app/(app)/page.tsx` if it still exists as the old dashboard. The new home for the team dashboard is `/dashboard/team/[teamId]`; the new home for the post-login landing is `/dashboard`.
13. Add a redirect: `/team-setup` → `/onboarding/scope` (for any user with a stale bookmark).

### Middleware update

14. `src/proxy.ts` — implement the routing logic from §5 above. Replaces the existing onboarding redirect logic.

### Shared components

15. `src/components/onboarding/OnboardingShell.tsx` — layout wrapper.
16. `src/components/onboarding/OnboardingProgress.tsx` — progress dots.
17. `src/components/onboarding/BigChoiceCard.tsx` — large clickable card for Single team vs League, Coach vs Captain.
18. `src/components/dashboard/LeagueDashboardCard.tsx` — used on the user dashboard and inside the league dashboard.
19. `src/components/dashboard/TeamDashboardCard.tsx` — used on the user dashboard.
20. `src/components/dashboard/CaptainViewToggle.tsx` — pill toggle on the team dashboard.
21. `src/components/teams/LeaguePicker.tsx` — smart picker (zero / one / multiple leagues).
22. `src/components/teams/TeamForm.tsx` — shared between `/onboarding/new-team` and `/teams/new`. Already partially exists in the current codebase as part of `team-setup` — extract and reuse.
23. `src/components/BackfillModal.tsx` — Quick Update modal from §10.

### Helpers / data layer

24. `src/lib/dashboard/user-home-data.ts` — server query for the user dashboard.
25. `src/lib/onboarding/state.ts` — helper that reads `profiles` and decides the next onboarding step. Used by middleware and as a defensive check on each onboarding page.
26. `src/lib/auth/route-after-login.ts` — implements the "always `/dashboard` if onboarding complete" rule from mobile doc §6.5.

### Tests (optional but recommended)

The existing web project doesn't have a test suite. Adding one isn't required for this build, but if you're set up to run Playwright:

27. `tests/e2e/onboarding/single-team-coach.spec.ts` — full flow for single team + coach.
28. `tests/e2e/onboarding/single-team-captain.spec.ts` — full flow for single team + captain.
29. `tests/e2e/onboarding/league.spec.ts` — full flow for league branch.
30. `tests/e2e/backfill.spec.ts` — existing user without first_name sees the modal.
31. `tests/e2e/dashboard/user-home.spec.ts` — verify the right sections render for each role combination.

---

## 12. Acceptance criteria (web-specific)

The build is done when ALL of these are true. These are the web equivalents of mobile doc §10; product-level criteria are the same, the wording is just specific to the web context.

**Onboarding flow.**
- A brand new user, after completing signup at `/signup`, lands on `/onboarding/name` (not on `/team-setup` or the old `/onboarding`).
- Each onboarding step uses the `OnboardingShell` layout: no sidebar, no bottom nav, progress dots at top.
- Each step works on a phone browser (375px) and on desktop (1280px+) — full-bleed mobile, centered card desktop.
- Refreshing the browser mid-flow brings the user back to the correct step (because `onboarding_step` is updated in the DB after each step, and middleware reads it).
- After completing all steps, `profiles.first_name`, `profiles.last_name`, `profiles.display_name`, and `profiles.onboarding_completed_at` are all populated.
- A user who picks Single Team + Coach ends up with a team row, a `team_members` row with role `coach`, and NO `team_players` row for themselves.
- A user who picks Single Team + Captain ends up with a team row, a `team_members` row with role `captain`, AND a `team_players` row with `is_captain = true`.
- A user who picks League ends up with a `leagues` row, a `league_members` row with role `league_admin`, and no teams yet.

**Routing and middleware.**
- Logged-out user hitting `/dashboard` → redirected to `/login`.
- Logged-in user with no onboarding → redirected to `/onboarding/name` (or wherever they left off).
- Logged-in user with onboarding complete hitting `/login` → redirected to `/dashboard`.
- Logged-in user hitting `/` → sees the marketing page (with a "Go to dashboard" CTA), not redirected away.
- `/team-setup` (old route) → redirects to `/onboarding/scope` for any user still navigating to it.

**Dashboards.**
- Every user lands on `/dashboard` (the user dashboard) after login when onboarding is complete.
- The user dashboard's "My leagues" section lists every league where the user is a `league_admin`. Hidden if zero.
- The user dashboard's "My teams" section lists every team the user is in `team_members` for, EXCLUDING teams that belong to one of their leagues. Hidden if zero.
- Teams belonging to a user's league appear ONLY inside the league dashboard, not duplicated on the user dashboard.
- Layout is responsive: single column on mobile, 2 columns at `md`, 3 columns at `lg+`.
- The user dashboard's empty state (zero leagues AND zero teams) renders correctly with both CTAs ("New league" and "New team").
- A league admin can see every team in their league on the league dashboard, including teams they did not personally create.
- A league admin can create a team from the league dashboard, and the new team has `league_id` set correctly.
- The Add Team flow at `/teams/new` shows the league picker per the rules in §9.4 (hide / pre-select / dropdown based on league count).
- A user who is a captain sees the Coach/Player view toggle on `/dashboard/team/[teamId]`.

**Backfill.**
- An existing user whose `first_name` is null sees the backfill modal on next login.
- The modal renders on top of whatever authenticated route they tried to visit.
- After submitting, the modal does not show again on the same session or subsequent sessions.
- Users with a non-null `first_name` never see the backfill modal.

**Build 1 alignment.**
- All new routes live under the correct route group: `(onboarding)/` for onboarding screens, `(app)/` for authenticated app screens.
- The onboarding routes use the `OnboardingShell` layout (no sidebar). The app routes use the `(app)/layout.tsx` shell from Build 1 (sidebar on desktop, bottom nav on mobile).
- No console errors during a full new-user flow on either mobile browser or desktop.

---

## 13. Web-specific risks

Mobile doc §12 covers the product-level risks. Web-specific risks to flag:

**Risk W1: Middleware latency from per-request Supabase checks.** Hitting Supabase on every authenticated page load adds 50-200ms. Mitigation: combine the path-filter approach with a cookie cache (§5). If we measure perceived slowness after launch, revisit.

**Risk W2: Server-side onboarding state vs. client-side branch choices.** The "scope" choice in Step 2 is in URL params on web, not the DB. If a user clears their browser history mid-flow, they could lose context. Mitigation: Step 3 and Step 4-Single defensively check the URL params and redirect back to Step 2 if missing. Step 4-League is its own route so it doesn't have this issue.

**Risk W3: The `(onboarding)` route group is new.** This is the first time we're using a route group for non-app, non-marketing, non-auth purposes. Make sure the layout is correctly scoped (no inherited sidebar from a parent layout).

**Risk W4: `TeamForm` reuse across two route contexts.** The component is rendered inside `(onboarding)` for first team creation and inside `(app)` for subsequent team creation. The component itself should know nothing about the context — it just renders the form. The wrapping page is responsible for layout differences. Mitigation: keep `TeamForm` as a pure form component; don't bake layout decisions into it.

**Risk W5: Backfill modal blocks legitimate work.** A user might hit the dashboard expecting to do something quick and get blocked by the modal. Mitigation: the modal is short (two fields), and the modal copy explains why. If complaints come in, add a "Remind me later" option in a follow-up build.

**Risk W6: Stale bookmarks to `/team-setup` and `/onboarding` (the old QB onboarding).** Old users with bookmarks could land on dead routes. Mitigation: redirect both to sensible homes (`/team-setup` → `/onboarding/scope`, `/onboarding` → `/dashboard`).

---

## 14. Out of scope (web-specific)

- Inviting other users via email link (mobile doc §2 lists this as out of scope; same on web)
- Migrating legacy `teams.organization_name` strings into real `leagues` records
- Multi-league support for a single user (one user belonging to two leagues at the same time)
- A dedicated `/leagues` index page (the user dashboard's "My leagues" section is the index for now)
- Public sharing of league or team dashboards
- Analytics on the onboarding funnel (worth adding later — drop-off rates between steps would be useful)

---

## 15. Definition of done (recap)

Built, tested, and shipped on web when:

1. Build 1 (Project relocation + responsive shell) has shipped first.
2. All new routes from §11 are in place; deleted routes are removed; redirects are working.
3. Middleware correctly routes new users into onboarding, existing users into the dashboard, and the backfill modal triggers correctly.
4. A new signup completing the League branch ends up on the League dashboard with one `league_members` row and zero teams.
5. A new signup completing the Single Team + Captain branch ends up on the team dashboard with a captain in `team_members` and a captain-player in `team_players`.
6. A league admin can create a team from the league dashboard and see it listed.
7. The user dashboard correctly renders the My leagues and My teams sections per the rules in §9.1.
8. The Captain view toggle works on the team dashboard.
9. Every onboarding step works on mobile browser (375px) and desktop (1280px+).
10. No console errors after a full new-user flow on either viewport.
11. `WEB_BUILD_PLAN.md` is updated to reflect this build's completion.

---

## 16. Documents this depends on or links to

- `ONBOARDING_LEAGUE_REDESIGN_WORKFLOW.md` (project root) — source of truth for schema, RLS, RPCs, copy, product logic
- `docs/WEB_PRD.md` — overall web vision
- `docs/WEB_SYSTEM_DESIGN.md` — web architecture, route groups, middleware patterns
- `docs/WEB_BUILD_PLAN.md` — phased build order (this work slots in as Build 2.5)
- `qb_supabase_full_package/` — schema migrations (47-52 already applied)
- `unlock-mobile/` — reference implementation; behavior and copy should match unless this doc explicitly diverges
