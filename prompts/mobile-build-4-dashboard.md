# Mobile Build 4: Dashboard (Home Tab)

Read `unlock-mobile/CLAUDE.md` for project context and design system. Read `unlock-app/src/app/page.tsx` for the web dashboard implementation to port.

## Context

The dashboard is the first screen users see after signing in. It shows team stats, strengths/weaknesses, recent benchmarks, recent practices, and quick actions. All data comes from Supabase views and tables that already exist. This is a read-only screen with navigation links to other parts of the app.

## Task 1: Dashboard screen

Replace the placeholder `app/(tabs)/index.tsx` with the full dashboard.

### Data fetching

Use a `useEffect` + state pattern. Fetch all data in parallel on mount:

```typescript
const { teamId } = useTeam();

const [loading, setLoading] = useState(true);
const [strengths, setStrengths] = useState([]);
const [recentBenchmarks, setRecentBenchmarks] = useState([]);
const [practiceHistory, setPracticeHistory] = useState([]);
const [playerCount, setPlayerCount] = useState(0);
const [drillCount, setDrillCount] = useState(0);
const [benchmarkCount, setBenchmarkCount] = useState(0);
const [practiceCount, setPracticeCount] = useState(0);

useEffect(() => {
  async function load() {
    const [s, rb, ph, pc, dc, bc, prc] = await Promise.all([
      supabase.from("vw_team_strength_weakness").select("*").eq("team_id", teamId),
      supabase.from("benchmark_results").select("*, team_players(player_name), team_drills(drill_name, benchmark_type)").eq("team_id", teamId).order("created_at", { ascending: false }).limit(5),
      supabase.from("vw_practice_history").select("*").eq("team_id", teamId).order("practice_date", { ascending: false }).limit(3),
      supabase.from("team_players").select("id", { count: "exact", head: true }).eq("team_id", teamId).eq("status", "active"),
      supabase.from("team_drills").select("id", { count: "exact", head: true }).eq("team_id", teamId).eq("status", "published"),
      supabase.from("benchmark_results").select("id", { count: "exact", head: true }).eq("team_id", teamId),
      supabase.from("practice_plans").select("id", { count: "exact", head: true }).eq("team_id", teamId),
    ]);
    // Set all state...
    setLoading(false);
  }
  load();
}, [teamId]);
```

Add pull-to-refresh using `RefreshControl` on a `ScrollView`.

### Layout (top to bottom)

**1. Header**
- Team name (text-title, font-medium)
- "Team Dashboard" subtitle (text-caption, text-secondary)
- Top padding to account for safe area (use `useSafeAreaInsets` from react-native-safe-area-context)

**2. Team Strengths & Weaknesses Card**
- Section label: "Team Overview" (label-micro style: 11px, uppercase, letter-spacing, text-secondary)
- Show each drill category with its average rating from `vw_team_strength_weakness`
- Each row: category name on left, average rating number on right
- Color code: green-400 for ratings >= 4, orange-400 for 2.5-3.9, error color for < 2.5
- Card: surface-raised background, rounded-lg, padding-lg
- If no benchmark data: show a "locked insight" card with dashed border, muted text: "Run benchmark assessments to see team strengths and weaknesses here"

**3. Stat Cards (2x2 grid)**
- Four cards in a 2-column layout (use `flexDirection: "row", flexWrap: "wrap"` or two rows)
- Each card: surface-raised, rounded-lg, padding-lg
- Stat number in text-stat size (28px), font-medium
- Label below in text-caption, text-secondary
- Cards: Active Players, Published Drills, Assessments, Practices

**4. Recent Benchmarks Section**
- Section label: "Recent Assessments" (label-micro)
- List of the 5 most recent benchmark results
- Each row: player name, drill name, result (time or rating), date
- Tap navigates to player detail: `router.push(\`/roster/\${playerId}\`)`
- Surface-raised card wrapping the list, rows separated by border-subtle dividers
- If none: "No assessments yet. Run your first benchmark to track player performance." (text-caption, text-secondary)

**5. Practice History Section**
- Section label: "Recent Practices" (label-micro)
- Last 3 completed practices from `vw_practice_history`
- Each card: date, drills completed/planned (e.g., "6/8 drills"), attendance, energy level shown as a number
- Tap navigates to practice detail: `router.push(\`/practice/\${planId}\`)`
- If none: "No practices logged yet." (text-caption, text-secondary)

**6. Quick Actions**
- Section label: "Quick Actions" (label-micro)
- Four tappable cards in a 2x2 grid:
  - "Add Drill" → `/drills/new`
  - "Add Player" → `/roster/new`
  - "Plan Practice" → `/practice/new`
  - "Run Assessment" → `/benchmarks`
- Each card: surface-raised, rounded-lg, padding-lg, icon above label
- Use Ionicons: `add-circle-outline`, `person-add-outline`, `calendar-outline`, `stopwatch-outline`

### Empty state (brand new team)

If no players, no drills, no benchmarks, and no practices (all counts are 0), show a getting-started view instead of the normal dashboard:

- "Welcome to your team dashboard" (text-title)
- Three step cards stacked vertically:
  1. "Add your players" → `/roster/new`
  2. "Create your drills" → `/drills/new`
  3. "Run your first assessment" → `/benchmarks`
- Each card: surface-raised, orange-500 left border accent, padding-lg, tap navigates to the relevant screen
- The step number (1, 2, 3) as text-heading in orange-500 on the left

### Loading state

While `loading` is true, show skeleton placeholders:
- For cards: surface-raised rectangles with a subtle pulse animation (opacity oscillating between 0.3 and 0.6)
- Match the approximate size and layout of the real content
- Don't overengineer this: simple pulsing rectangles are fine

## Design rules

- Dark mode. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500).
- Screen padding: 20px horizontal (px-xl).
- Vertical spacing between sections: 24px (gap-2xl).
- Card padding: 16px (p-lg).
- Section labels: label-micro (11px, uppercase, 0.5px letter-spacing, text-secondary). Add 8px margin-bottom before the content.
- Touch targets: 44px minimum height on all tappable elements.
- The dashboard should scroll naturally. Use ScrollView, not FlatList (the content is not a homogeneous list).

## Testing

1. Open the app with a team that has no data. Should see the getting-started view with 3 step cards.
2. After adding players and drills and running benchmarks, reload. Should see the full dashboard with real data.
3. Pull down to refresh. Data should reload.
4. Tap a recent benchmark row. Should navigate (even if the destination is a placeholder for now).
5. Tap a quick action card. Should navigate to the correct screen.
6. Verify the loading skeleton appears briefly before data loads.
7. Verify the stat cards show correct counts.
