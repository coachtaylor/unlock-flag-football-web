# Build 2b: Player Detail + Edit Player

Read `CLAUDE.md` for design system. Read `../CLAUDE.md` for product context. Read `../qb_supabase_full_package/docs/coach_mvp_schema_spec.md` for the `team_players` and `benchmark_results` table schemas.

Look at how existing detail/edit pages are structured (e.g., `/drills/[id]` if it exists) for the architecture pattern.

## Task: Build two pages

### 1. Player Detail Page (`/roster/[id]/page.tsx`)

A view of a single player with their info and benchmark history.

**Layout:**
- Back link: "← Back to Roster" (links to `/roster`)
- Player name as page title (text-title, font-medium)
- Jersey number next to name if set (text-secondary)
- Position pills row (muted style, informational)
- Status indicator: "Active" in green-400 text, or "Inactive" in text-muted
- Notes section (if present): text-body, text-secondary

**Benchmark History section:**
- Header: "Benchmark Results" (text-heading)
- If no benchmarks exist: "No benchmark data yet. Run an assessment to see results here." (muted text, dashed border card)
- If benchmarks exist: list them grouped by drill name. For each:
  - Drill name (text-body, font-medium)
  - Most recent result: time (e.g., "4.52s") for timed drills, or rating (e.g., "4/5") for rated drills
  - Assessment date (text-caption, text-muted)
  - Tags if any (small muted pills)
- Query: `supabase.from('benchmark_results').select('*, team_drills(drill_name, benchmark_type)').eq('player_id', playerId).order('assessment_date', { ascending: false })`

**Buttons at bottom:**
- "Edit Player" (primary orange, full-width) → `/roster/[id]/edit`
- "Deactivate" (text-only button, text-muted, below Edit) — sets status to 'inactive' and redirects to /roster. If player is already inactive, show "Reactivate" instead.

**Architecture:**
- Server component: auth check, team check, fetch player + benchmarks in parallel
- Verify the player belongs to the user's team

### 2. Edit Player Page (`/roster/[id]/edit/page.tsx`)

Same form as add player, but pre-populated.

**Fields (pre-filled):**
- Player name (text input)
- Positions (multi-select pills, pre-selected based on current positions)
- Jersey number (text input)
- Notes (textarea)

**Button:**
- "Save Changes" (primary orange CTA)
- On submit: `supabase.from('team_players').update({...}).eq('id', playerId)`
- On success: redirect to `/roster/[id]`

**Architecture:**
- Server component fetches existing player data
- Client component for the form

## Design rules reminder
- Dark mode always. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500).
- Orange = interactive. Green = positive signals.
- Touch targets 44px minimum. Screen padding px-xl.
- Benchmark results should use outlined card style (surface-base + border-subtle).
