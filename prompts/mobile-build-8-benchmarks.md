# Mobile Build 8: Benchmark Logging (Hub + Log + Complete)

Read `unlock-mobile/CLAUDE.md` for project context and design system. Read `unlock-app/src/app/benchmarks/BenchmarksHubClient.tsx`, `unlock-app/src/app/benchmarks/log/BenchmarkLogClient.tsx`, and `unlock-app/src/app/benchmarks/complete/page.tsx` for the web implementations to port.

## Context

Benchmark assessments are how captains evaluate players on specific drills. The flow is: pick a drill, pick which players to assess, then log a result for each player one at a time. Timed drills get a time in seconds, rated drills get a 1-5 rating. Every player can also get quick-select tags and optional notes. This is the core data-capture feature that feeds the dashboard.

## Task 1: Benchmark hub screen

Create `app/benchmarks/index.tsx`:

### Header
- "Run Assessment" (text-title, font-medium)
- Safe area top padding
- Back button (chevron-left) if navigated from a drill detail or dashboard quick action

### Step 1: Select a drill
- Section label: "Select a drill" (label-micro)
- Fetch benchmark-eligible drills:
  ```typescript
  const { data: drills } = await supabase
    .from("team_drills")
    .select("id, drill_name, benchmark_type, category")
    .eq("team_id", teamId)
    .eq("status", "published")
    .not("benchmark_type", "is", null)
    .order("drill_name");
  ```
- Each drill is a tappable card (surface-raised, rounded-xl, 1px border in border-subtle):
  - Drill name (text-body, font-medium)
  - Badge showing "Timed" or "Rated" (small pill, orange background at 15% opacity, orange text)
  - Category below the name (text-caption, text-secondary)
  - Left orange accent bar (3-4px) on the selected drill
  - Chevron right icon
- Tap selects the drill (highlight with orange left border and slightly brighter background)
- Only one drill selected at a time

### Empty state for drills
- If no benchmark drills exist: "No benchmark drills yet. Create a drill and set its benchmark type to get started."
- CTA button: "Go to Drills" navigating to `/drills`

### Step 2: Select players (shown after drill is selected)
- Section label: "Select players" (label-micro) with count: "3 of 12 selected"
- Quick actions row: "Select All" and "Clear" as text buttons (text-caption, orange text)
- Fetch active players:
  ```typescript
  const { data: players } = await supabase
    .from("team_players")
    .select("id, player_name, positions")
    .eq("team_id", teamId)
    .eq("status", "active")
    .order("player_name");
  ```
- Each player is a tappable row:
  - Checkbox indicator on the left (circle, orange fill when selected, border-subtle when not)
  - Player name (text-body, font-medium)
  - Positions as small pills (text-micro, non-interactive display)
  - Tap toggles selection
- Haptic feedback on toggle (light impact)

### Empty state for players
- If no active players: "No players on the roster yet."
- CTA button: "Add Players" navigating to `/roster/new`

### Start button
- "Start Assessment" (primary orange, full width, 52px height)
- Disabled until both a drill AND at least one player are selected
- Disabled state: reduced opacity (0.5)
- On press: navigate to log screen with query params:
  ```typescript
  router.push(`/benchmarks/log?drill=${selectedDrill.id}&players=${selectedPlayerIds.join(",")}`);
  ```

### Pre-selection from drill detail
- If navigated with a query param `?drill=<id>`, pre-select that drill on mount
- Skip straight to the player selection step

## Task 2: Per-player logging screen

Create `app/benchmarks/log.tsx`:

### Data setup
```typescript
const { drill: drillId, players: playerIdsStr } = useLocalSearchParams();
const playerIds = (playerIdsStr as string).split(",");
```

Fetch the drill and players on mount:
```typescript
const { data: drill } = await supabase
  .from("team_drills")
  .select("id, drill_name, benchmark_type")
  .eq("id", drillId)
  .single();

const { data: players } = await supabase
  .from("team_players")
  .select("id, player_name")
  .in("id", playerIds);
```

### State management
```typescript
type PlayerResult = {
  playerId: string;
  timeSeconds: string;   // empty string default (for timed)
  rating: number | null;  // null default (for rated)
  tags: string[];
  notes: string;
};

const [currentIndex, setCurrentIndex] = useState(0);
const [results, setResults] = useState<PlayerResult[]>(
  playerIds.map((id) => ({
    playerId: id,
    timeSeconds: "",
    rating: null,
    tags: [],
    notes: "",
  }))
);
```

### Layout (KeyboardAvoidingView + ScrollView)

**Progress bar:**
- Horizontal bar at top, `(currentIndex + 1) / players.length` filled in orange
- Text below: "Player 1 of 5 · 40-Yard Dash" (text-caption, text-secondary)

**Player name:**
- Large player name (text-title, font-medium)
- Centered or left-aligned at the top of the form area

**Result input (conditional on benchmark_type):**

For **timed** drills:
- Label: "Time (seconds)" (label-micro)
- Large numeric input (TextInput, fontSize 28, font-medium, centered)
- `keyboardType="decimal-pad"`
- Placeholder: "0.00"
- Auto-focus on mount and when navigating between players
- Validation: must be a number > 0

For **rated** drills:
- Label: "Rating" (label-micro)
- Five large tappable buttons in a horizontal row, numbered 1-5
- Selected button: orange background, white text
- Unselected buttons: surface-raised, border-subtle, text-secondary
- Each button: 52px wide, 52px tall, rounded-xl
- Below the buttons, show the anchor text for the selected rating:
  - 1: "Can't execute the drill"
  - 2: "Struggles, needs significant work"
  - 3: "Gets it done but inconsistent"
  - 4: "Solid, minor refinements needed"
  - 5: "Reliable under pressure"
- Haptic feedback on selection (light impact)

**Quick tags:**
- Label: "Tags" (label-micro)
- Wrapping row of pill buttons (Tag component if available, or custom pills):
  - "Good hands"
  - "Quick feet"
  - "Needs footwork help"
  - "Sharp routes"
  - "Slow reaction"
  - "Strong arm"
  - "Good vision"
- Multi-select: tap toggles, orange when selected, surface-raised when not
- Haptic on toggle

**Notes:**
- Collapsible section. Show "+ Add notes" text button by default.
- When tapped, expand to show a TextArea / multiline TextInput
- Label: "Notes" (label-micro when expanded)
- Placeholder: "Optional observations about this player..."
- 3-4 lines tall

**Navigation buttons (bottom, sticky or at end of scroll):**
- Two buttons side by side:
  - "Previous" (secondary style, left side) — disabled on first player
  - "Next" / "Finish" (primary orange, right side) — "Finish" on last player
- On "Next": validate input, save to database, advance to next player
- On "Previous": save current input to state (no DB write needed), go back
- On "Finish": validate, save, navigate to complete screen

### Save logic (on Next / Finish)
```typescript
const result = results[currentIndex];
const payload = {
  team_id: teamId,
  drill_id: drillId,
  player_id: result.playerId,
  assessed_by: userId,
  assessment_date: new Date().toISOString().split("T")[0],
  time_seconds: drill.benchmark_type === "timed" ? parseFloat(result.timeSeconds) : null,
  rating: drill.benchmark_type === "rated" ? result.rating : null,
  tags: result.tags.length > 0 ? result.tags : null,
  notes: result.notes || null,
};

const { error } = await supabase.from("benchmark_results").insert(payload);
```

### Validation
- Timed: time must be a valid number > 0. Show error text below input in red if invalid.
- Rated: rating must be selected (1-5). Show error if trying to advance without selecting.
- Tags and notes are always optional.

### Loading state
- Show a brief loading indicator on the Next/Finish button while saving (spinner or "Saving...")
- Disable the button during save to prevent double-tap

## Task 3: Assessment complete screen

Create `app/benchmarks/complete.tsx`:

### Layout (centered content)
- Large green checkmark icon (Ionicons `checkmark-circle`, 64px, green-400)
- "Assessment Complete" (text-title, font-medium, centered)
- Summary text: "Logged results for {playerCount} players on {drillName}" (text-body, text-secondary, centered)
- 24px gap between icon and text

### Read drill name from query params
```typescript
const { drill: drillId, count } = useLocalSearchParams();
// Fetch drill name for display
```

### Action buttons (full width, stacked with 12px gap)
- "Run Another Assessment" (primary orange) → navigates to `/benchmarks`
- "Back to Dashboard" (secondary) → navigates to `/` (tabs root)

## Task 4: Wire up entry points

### Drill detail page
- If a drill has a `benchmark_type`, show a "Run Benchmark" button on the drill detail page
- Button navigates to `/benchmarks?drill=${drill.id}` to pre-select the drill

### Dashboard quick action
- The "Run Assessment" quick action on the dashboard already points to `/benchmarks`
- Verify this route works after creating the benchmarks screens

## Design rules

- Dark mode. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500). Never bold.
- Screen padding: 20px horizontal.
- Card padding: 16px.
- Tag pills: use orange selected state (orange-500 background at 15% opacity, orange text when selected; surface-raised with border-subtle when not).
- Touch targets: 44px minimum height for all tappable elements.
- Rating buttons: 52x52px for easy thumb tapping.
- The numeric input for timed drills should be large and centered (this is the primary action).
- Progress bar: 4px tall, rounded-pill, orange fill on surface-raised track.
- All interactive elements get press states (opacity 0.85 or background shift).
- Use `expo-haptics` light impact on tag selection and rating button taps.

## Navigation structure

These screens live outside the tab bar since they're a focused flow:
- `app/benchmarks/index.tsx` (hub)
- `app/benchmarks/log.tsx` (per-player logging)
- `app/benchmarks/complete.tsx` (done screen)

They should be stack screens (push on top of tabs, with back navigation). Make sure the Expo Router file structure supports this. If benchmarks routes need to be added to the root stack in `app/_layout.tsx`, do that.

## Testing

1. Open Dashboard, tap "Run Assessment" quick action. Should open the benchmark hub.
2. Hub should show benchmark-eligible drills. Select one. Player list should appear.
3. Tap "Select All" then "Clear". Toggle individual players. Count should update.
4. Tap "Start Assessment". Should navigate to the log screen.
5. For a timed drill: enter a time, tap Next. Should save and show next player.
6. For a rated drill: tap a rating (1-5). Anchor text should appear below. Tap Next.
7. Select some tags. They should toggle orange. Add a note.
8. Tap Previous. Should go back to the previous player with their data preserved.
9. On the last player, tap Finish. Should navigate to the complete screen.
10. Complete screen should show correct player count and drill name.
11. Tap "Run Another Assessment". Should return to hub.
12. Try submitting without entering a time (timed) or rating (rated). Should show validation error.
13. Open a drill detail page for a benchmark drill. "Run Benchmark" button should appear and pre-select that drill in the hub.
