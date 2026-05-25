# Build 3a: Benchmark Assessment Logging

Read `CLAUDE.md` for design system and patterns. Read `../CLAUDE.md` for product context (Coach/Team Management MVP section, specifically "3. Benchmark Assessments" under MVP Features, and "Benchmark Rating Scale Anchors"). Read `../qb_supabase_full_package/docs/coach_mvp_schema_spec.md` for the `benchmark_results` table schema.

## Context

Benchmark assessments are how captains measure player performance. A captain picks a drill that has been flagged as a benchmark (benchmark_type = "timed" or "rated"), selects players, and logs a result for each player. This is the core data that feeds the team dashboard.

Key product decisions:
- Timed drills: captain enters a time in seconds (e.g., 4.52)
- Rated drills: captain taps a 1-5 rating. Scale anchors: 1 = Can't execute, 2 = Struggles, 3 = Gets it done but inconsistent, 4 = Solid, 5 = Reliable under pressure
- Tags per player: quick-select from consistent options like "good hands", "needs help with footwork", "sharpen route", plus free-text notes
- The assessed_by field tracks which captain logged the result
- Logging needs to be FAST since captains are doing this during practice between reps

## Task: Build three pages

### 1. Benchmarks Hub Page (`/benchmarks/page.tsx`)

This is a NEW route (not currently in the bottom nav, accessed from drill detail pages and dashboard). Create the directory.

**Purpose:** Start a benchmark assessment session. Two ways to get here:
- From a drill's detail page (a "Run Benchmark" button we'll add)
- From a direct link/URL

**Layout:**
- Header: "Run Assessment"
- Step 1: Select a drill. Show only drills where benchmark_type is NOT null (i.e., drills flagged as benchmarks). Display as tappable cards with drill name and benchmark type badge ("Timed" or "Rated").
- Step 2 (after drill selected): Select players. Show all active team_players as a checklist. "Select All" button at top. Each player row has name + positions. Selected state uses orange highlight.
- Step 3 (after players selected): "Start Assessment" button (primary orange)
- On tap: navigate to `/benchmarks/log?drill={drillId}&players={comma-separated-playerIds}`

**Architecture:**
- Server component fetches benchmark drills and active players
- Client component for the selection flow (tracks selected drill and players in state)

### 2. Benchmark Logging Page (`/benchmarks/log/page.tsx`)

**Purpose:** Log results for each selected player, one at a time.

**URL params:** `?drill={drillId}&players={id1,id2,id3,...}`

**Layout — one player at a time:**
- Progress indicator at top: "Player 3 of 8" (text-caption, text-secondary)
- Player name (text-title, font-medium)
- Player positions (small muted pills below name)

**For TIMED drills:**
- Large number input for seconds (numeric keyboard, allow decimals like 4.52)
- Label: "Time (seconds)"
- Input should be big and easy to tap (text-display size, centered)

**For RATED drills:**
- Five tappable circles/buttons labeled 1-5
- Below the buttons, show the anchor text for the currently selected rating:
  - 1: "Can't execute"
  - 2: "Struggles, needs significant work"
  - 3: "Gets it done but inconsistent"
  - 4: "Solid, minor refinements needed"
  - 5: "Reliable under pressure"
- Selected rating uses orange fill. Unselected uses surface-raised.

**Tags section (both drill types):**
- Label: "Quick tags" (label-micro)
- Pre-defined tag pills (multi-select): "Good hands", "Quick feet", "Needs footwork help", "Sharp routes", "Slow reaction", "Strong arm", "Good vision"
- All use the standard pill selected/unselected styles

**Notes section:**
- Small textarea: "Additional notes..." (optional, collapsible behind "Add notes" text link to keep the screen compact)

**Navigation:**
- "Next Player →" button (primary orange) — saves current player's result and advances to next
- "← Previous" text link (text-secondary) — goes back to previous player (doesn't lose data)
- On the last player: button says "Finish Assessment"

**On save (per player):**
```
supabase.from('benchmark_results').insert({
  team_id: teamId,
  drill_id: drillId,
  player_id: currentPlayerId,
  assessed_by: userId,
  assessment_date: today (YYYY-MM-DD),
  time_seconds: timeValue || null,     // for timed drills
  rating: ratingValue || null,         // for rated drills
  tags: selectedTags,                  // text array
  notes: notesText || null
})
```

**After last player saved:** Navigate to `/benchmarks/complete?drill={drillId}&count={playerCount}`

**Architecture:**
- Client component (heavy interactivity, manages state for all players)
- Load drill info and player names from URL params on mount
- Store all results in local state, bulk-save to Supabase as you go (save each player when "Next" is tapped, not all at the end — avoids data loss if they close the app)

### 3. Assessment Complete Page (`/benchmarks/complete/page.tsx`)

Simple confirmation page after finishing an assessment.

**Layout:**
- Checkmark icon (green-400, large)
- "Assessment Complete" (text-title)
- "Logged results for {count} players on {drill name}" (text-body, text-secondary)
- Two buttons:
  - "View Results" → navigates to the drill's detail page `/drills/{drillId}` (we'll add a benchmark results section there in a future build)
  - "Run Another" → navigates back to `/benchmarks`
  - "Back to Dashboard" → navigates to `/`

### 4. Add "Run Benchmark" button to drill detail page

Update `/drills/[id]/page.tsx` to show a "Run Benchmark" button IF the drill has a benchmark_type set. Place it above the "Edit" button. Style: full-width, green-800 background with green-400 text and green-600 border (it's an insight/action, not a standard CTA). Links to `/benchmarks?drill={drillId}` (pre-selects the drill).

### 5. Add Benchmarks link to dashboard quick actions

On the home page (`/page.tsx`), add a fourth quick action card: "Run Assessment" → links to `/benchmarks`.

## Design rules reminder
- Dark mode always. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500). Never bold.
- Orange = interactive/CTA. Green = positive/insights.
- Touch targets 44px minimum. This is critical for the rating buttons and tag pills.
- The time input needs to be large and easy to use on mobile during practice.
- Screen padding px-xl (20px).
- Rating buttons should be at least 48px circles for easy tapping.
- Keep the per-player screen compact. A captain needs to log a result in under 10 seconds per player for timed drills. Don't make them scroll.
