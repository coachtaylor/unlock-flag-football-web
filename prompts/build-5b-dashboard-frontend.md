# Build 5b: Dashboard Frontend with Real Data

Read `CLAUDE.md` for design system and patterns. Read `../CLAUDE.md` for product context (Coach/Team Management MVP section, "Dashboard (the payoff)"). Look at the current home page (`/page.tsx`) to understand the existing layout.

## Context

The dashboard currently shows placeholder stat counts (players, drills, benchmarks, practices). This build replaces it with real aggregated data from the views created in Build 5a. The dashboard is "the payoff" — it's where captains see team strengths and weaknesses, player standouts, practice trends, and what to focus on next.

## Task: Update the home page (`/page.tsx`)

### Layout (top to bottom):

**1. Header**
- Team name (text-title, font-medium)
- "Team Dashboard" subtitle (text-caption, text-secondary)

**2. Team Strengths & Weaknesses Card**
- Section header: "Team Overview" (label-micro)
- Show each drill category with its average rating (from vw_team_strength_weakness)
- Display as horizontal bars or simple rows:
  - Category name on left
  - Average rating displayed as filled dots (e.g., 3.5 out of 5) or a simple number
  - Color code: green-400 for ratings >= 4, orange-400 for 2.5-3.9, error color for < 2.5
- Only show categories that have benchmark data
- If no benchmark data exists: show a "locked insight" card: "Run benchmark assessments to see team strengths and weaknesses here"

**3. Stat Cards Row (keep existing, but with real counts)**
- Four cards in a 2x2 grid:
  - Active players count
  - Published drills count
  - Total benchmark assessments logged
  - Completed practices count
- These already exist — just verify they use real queries (they should from Build 1)

**4. Recent Benchmarks Section**
- Section header: "Recent Assessments" (label-micro)
- Show the 5 most recent benchmark results (from benchmark_results, joined with player + drill names)
- Each row: player name, drill name, result (time or rating), date
- Tap → navigate to player detail page (`/roster/[playerId]`)
- If none: "No assessments yet. Run your first benchmark to track player performance."

**5. Practice History Section**
- Section header: "Recent Practices" (label-micro)
- Show last 3 completed practices (from vw_practice_history)
- Each card: date, drills completed/planned ratio (e.g., "6/8 drills"), attendance, energy dots (1-5)
- Tap → navigate to practice plan detail (`/practice/[planId]`)
- If none: "No practices logged yet."

**6. Quick Actions (keep existing)**
- The existing quick action cards (Add drill, Add player, Plan practice, Run assessment)
- Move to bottom of page since the real data is now more important

### Data fetching

All queries in the server component, run in parallel:

```typescript
const [strengths, recentBenchmarks, practiceHistory, playerCount, drillCount, benchmarkCount, practiceCount] = await Promise.all([
  supabase.from('vw_team_strength_weakness').select('*').eq('team_id', teamId),
  supabase.from('benchmark_results').select('*, team_players(player_name), team_drills(drill_name, benchmark_type)').eq('team_id', teamId).order('created_at', { ascending: false }).limit(5),
  supabase.from('vw_practice_history').select('*').eq('team_id', teamId).order('practice_date', { ascending: false }).limit(3),
  supabase.from('team_players').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'active'),
  supabase.from('team_drills').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'published'),
  supabase.from('benchmark_results').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
  supabase.from('practice_plans').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
])
```

### Empty state (brand new team)

If the team has no data at all (no players, no drills, no benchmarks), show a streamlined getting-started view:
- "Welcome to your team dashboard"
- Three step cards: "1. Add your players" → "2. Create your drills" → "3. Run your first assessment"
- Each links to the relevant page

## Design rules
- Dark mode. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500).
- Green = strengths/positive. Orange = needs work. Error = weakness.
- "Locked insight" pattern: dashed border, muted text, orange nudge text for what to do next.
- Screen padding px-xl.
- The dashboard should feel useful and actionable, not just a data dump. Each section should imply a next action.
