# Coach MVP Build 1: App Restructure + Drill Library

## Context

Read `CLAUDE.md` in this directory for full tech stack, design system, and component patterns. Read `../CLAUDE.md` (the parent project CLAUDE.md) for all product decisions, especially the "Coach/Team Management MVP" section. Read `../qb_supabase_full_package/docs/coach_mvp_schema_spec.md` for the full database schema spec.

The app currently has auth (login/signup) working and routes to an individual QB tracker dashboard. We're shifting the app to serve the Coach/Team Management MVP instead. The individual tracking features are paused. After login, users should land on the coach/team experience.

The Supabase database already has the coach MVP tables deployed: `teams`, `team_members`, `team_players`, `team_drills`, `drill_categories`, `benchmark_results`, `practice_plans`, `practice_plan_drills`, `practice_logs`, and the `create_team_with_member()` function. All tables have RLS policies scoped to team membership.

## What to build (in this order)

### Step 1: Update the bottom navigation

Replace the current 4-tab nav (Dashboard, Log, Progress, Library) with coach MVP tabs:

- **Dashboard** (`/`) — grid icon (keep existing icon)
- **Drills** (`/drills`) — whistle or play/clipboard icon
- **Roster** (`/roster`) — people/users icon
- **Practice** (`/practice`) — calendar/clipboard icon

Keep the same styling patterns from the existing BottomNav.tsx: orange-400 for active, white at 40% opacity for inactive. Same 56px height, safe-area padding, 9px labels.

Hide the nav on `/login`, `/signup`, and `/team-setup`.

### Step 2: Team setup flow (new route: `/team-setup`)

After login, check if the user is a member of any team (query `team_members` where `user_id = auth.uid()`). If they have a team, redirect to `/` (dashboard). If they don't have a team, redirect to `/team-setup`.

The team setup is a simple single screen:
- Header: "Create your team"
- Fields: Team name (required text input), Organization name (optional text input), Format (pills: "5v5", "7v7", "Both")
- CTA: "Create Team" button
- On submit: call the `create_team_with_member()` Supabase RPC function, which creates the team and adds the current user as the first captain in one atomic transaction
- On success: redirect to `/`

RPC call pattern:
```typescript
const { data, error } = await supabase.rpc('create_team_with_member', {
  p_team_name: teamName,
  p_organization_name: orgName || null,
  p_format: format
})
```

Style the page like the existing login/signup pages: centered surface-raised card on surface-base background. No bottom nav on this screen.

Update the middleware to allow `/team-setup` as a protected route (requires auth but no team check). Update the login page: after successful login, instead of checking `profiles.onboarding_completed_at`, check `team_members` for the logged-in user. If they have a team, go to `/`. If not, go to `/team-setup`.

The signup page should also redirect to `/team-setup` after successful signup (instead of `/onboarding`).

### Step 3: Team context provider

Create a React context that loads the current user's team membership on app load. This context provides `teamId`, `teamName`, and `userRole` to all pages.

File: `src/lib/team-context.tsx`

The root layout should wrap children in this provider (only for authenticated routes). Every page that queries team-scoped data uses `teamId` from this context.

Pattern:
```typescript
// In any client component:
const { teamId } = useTeam()

// In server components, query team_members directly:
const { data: membership } = await supabase
  .from('team_members')
  .select('team_id, role, teams(team_name)')
  .eq('user_id', user.id)
  .single()
```

### Step 4: Dashboard home page (`/`)

Replace the current individual QB dashboard with a team dashboard placeholder. This will be built out fully later, but for now show:

- Header: team name (from context) + "Dashboard"
- Four stat cards (placeholder zeros for now):
  - "Players" (count from team_players where status = 'active')
  - "Drills" (count from team_drills where status = 'published')
  - "Benchmarks" (count from benchmark_results)
  - "Practices" (count from practice_plans)
- A "Quick Actions" section with three tappable cards:
  - "Add a drill" → links to `/drills/new`
  - "Add a player" → links to `/roster/new`
  - "Plan practice" → links to `/practice/new`

Use the existing design system: surface-raised cards, label-micro for labels, text-stat for numbers, orange-400 for quick action links.

### Step 5: Drill library list page (`/drills`)

The drill library is the first real feature. Build the list page:

- Header: "Drill Library" + an "Add Drill" button (orange-500, right-aligned)
- Filter row: horizontal scroll of pill-shaped buttons for categories (query `drill_categories` table, sorted by `display_order`). "All" pill selected by default. Tapping a category filters the list.
- Drill cards: one outlined card per drill (from `team_drills` where `team_id` matches and `status = 'published'`, plus `status = 'draft'` since captains should see their own drafts)
  - Card shows: drill_name (text-heading, font-medium), category name (label-micro pill), benchmark badge if benchmark_type is set ("Timed" or "Rated" in a small pill)
  - Draft drills show a "Draft" badge (muted, dashed border)
  - Tap a card → navigate to `/drills/[id]`
- Empty state: "No drills yet. Add your first drill to get started." with an "Add Drill" button.
- Query joins team_drills with drill_categories to get category_name.

### Step 6: Create/edit drill page (`/drills/new` and `/drills/[id]/edit`)

Build the drill creation form. This is a single scrollable page (not multi-screen):

**Fields:**
- Drill name (required text input)
- Category (dropdown or pill selector, populated from `drill_categories`)
- Description (textarea, placeholder: "How to run this drill, coaching cues...")
- Source URL (optional text input, placeholder: "TikTok, Instagram, or YouTube link")
- Benchmark type (optional pills: "None", "Timed", "Rated". Default "None". When "None" is selected, benchmark_type is saved as null)
- Equipment (optional, text input for additional items beyond cones)

**Save behavior:**
- "Save as Draft" button (secondary style: outlined, not filled) — saves with status = 'draft'
- "Publish" button (primary orange CTA) — saves with status = 'published'
- When editing an existing published drill, show "Unpublish" option (moves back to draft) and "Save" (keeps published)

**What to skip for now:** The setup diagram builder. Add a placeholder section that says "Diagram builder coming soon" with a dashed border card. We'll build the diagram builder as a separate prompt because it's a complex interactive component. The drill form should work fully without it.

Insert: `supabase.from('team_drills').insert({ team_id, created_by: user.id, drill_name, category_id, description, source_url, benchmark_type: type === 'None' ? null : type.toLowerCase(), status, equipment: equipmentJson })`

### Step 7: Drill detail page (`/drills/[id]`)

View page for a single drill:

- Back button → `/drills`
- Drill name as page title
- Category pill, benchmark type badge (if set), status badge (if draft)
- Description (full text)
- Source URL as a tappable link (if present, opens in new tab)
- Equipment list (if present)
- Setup instructions (if present, will be populated once diagram builder exists)
- "Edit" button at bottom → `/drills/[id]/edit`

### Step 8: Create placeholder pages for other tabs

Create simple placeholder pages so the bottom nav works:

- `/roster/page.tsx` — "Roster" header + "Coming in Build 2" message
- `/practice/page.tsx` — "Practice" header + "Coming in Build 4" message

Also create stub routes:
- `/roster/new/page.tsx` — placeholder
- `/practice/new/page.tsx` — placeholder

### Step 9: Clean up old individual tracking routes

Don't delete the old route files yet (we may come back to them), but remove them from the bottom nav and add a comment at the top of each file marking them as paused:

- `/log/*` routes
- `/progress` route
- `/library/*` routes
- `/onboarding` route

## Design rules (from CLAUDE.md, follow strictly)

- Dark mode always. Background: surface-base (#0D1117). Cards: surface-raised (#161C24).
- Two font weights only: font-normal (400) and font-medium (500). Never bold/semibold.
- Orange = interactive/CTA. Green = positive/insights. Blue = data.
- Touch targets: 44x44px minimum.
- Screen horizontal padding: 20px (px-xl).
- Use CSS variables from globals.css, not hardcoded colors (except where existing patterns use inline styles).
- Pills/tags: selected = orange treatment (bg #5C3308, text #F0B870, border #D48A30). Unselected = muted (bg rgba(255,255,255,0.04), text rgba(255,255,255,0.45), border rgba(255,255,255,0.08)).

## Important notes

- All data queries must include `team_id` filtering. Use the team context for client components. For server components, query team_members to get the team_id first.
- The `create_team_with_member()` function already exists in Supabase. Don't create a new one. Just call it via RPC.
- The `drill_categories` table is already seeded with: offense, defense, conditioning, footwork, agility, warmup, cooldown, other.
- Don't touch the existing Supabase client setup in `src/lib/supabase/`. It works.
- TypeScript strict mode is on. Type everything properly.
- Use Server Components where possible (data fetching). Use Client Components ("use client") only where you need interactivity (forms, state, event handlers).
