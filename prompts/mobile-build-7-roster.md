# Mobile Build 7: Roster (List + Add + Detail + Edit)

Read `unlock-mobile/CLAUDE.md` for project context and design system. Read `unlock-app/src/app/roster/page.tsx`, `unlock-app/src/app/roster/new/page.tsx`, `unlock-app/src/app/roster/[id]/page.tsx`, and `unlock-app/src/app/roster/[id]/edit/page.tsx` for the web implementations to port.

## Context

The roster is where captains manage their team's players. It shows active and inactive players, lets captains add new players, view player details with benchmark history, and edit player info. All four screens are straightforward data entry and display with no complex interactions.

## Task 1: Roster list screen

Replace the placeholder `app/(tabs)/roster/index.tsx`:

### Header
- "Roster" (text-title, font-medium)
- Safe area top padding
- "+" button in top-right to add a player → `/roster/new`

### Active players section
- Section label: "Active" (label-micro) with count, e.g., "Active (12)"
- FlatList or ScrollView of active players
- Query: `supabase.from("team_players").select("*").eq("team_id", teamId).eq("status", "active").order("player_name")`
- Each row is a card (surface-raised, rounded-lg, padding-lg):
  - Player name (text-body, font-medium)
  - Positions as small tag pills (non-interactive, display only), e.g., "QB", "WR"
  - Jersey number on the right side (text-caption, text-secondary) if set
  - Chevron right icon
- Tap navigates to player detail: `router.push(\`/roster/\${player.id}\`)`

### Inactive players section
- Section label: "Inactive" (label-micro) with count
- Same card layout but with lower opacity (0.6) to visually distinguish
- Only show this section if there are inactive players
- Query: same table, `status: "inactive"`

### Empty state
- If no players at all: "No players yet. Add your first player to get started." (text-body, text-secondary, centered)
- "Add Player" button below (orange-500)

### Pull-to-refresh
- RefreshControl on the ScrollView to reload the roster

### Loading state
- Skeleton cards (3-4 pulsing rectangles)

## Task 2: Add player form

Create `app/(tabs)/roster/new.tsx`:

### Header
- Back button (chevron-left) → `router.back()`
- "Add Player" (text-title, font-medium)

### Form fields (ScrollView with KeyboardAvoidingView)

1. **Player name** (required)
   - Input component, label: "Player Name", placeholder: "e.g., Marcus Johnson"

2. **Positions** (optional, multi-select)
   - Label: "Positions" (label-micro)
   - Multi-select Tag pills in a wrapping row: QB, WR, RB, TE, C, S, CB, LB, DL, K
   - Multiple can be selected (orange when selected)
   - Stored as a text array

3. **Jersey number** (optional)
   - Input component, label: "Jersey Number", placeholder: "e.g., 7"
   - `keyboardType="number-pad"`

4. **Notes** (optional)
   - TextArea component, label: "Notes", placeholder: "Anything to remember about this player..."

### Submit button
- "Add Player" (primary orange, full width, 52px height)
- Loading state while saving

### On submit
```typescript
const { error } = await supabase.from("team_players").insert({
  team_id: teamId,
  player_name: name,
  positions: selectedPositions.length > 0 ? selectedPositions : null,
  jersey_number: jerseyNumber || null,
  notes: notes || null,
  status: "active",
});
```

On success: `router.back()` to the roster list.

### Validation
- Name is required. Show error if empty on submit.

## Task 3: Player detail screen

Create `app/(tabs)/roster/[id].tsx`:

### Data fetching
```typescript
const { id } = useLocalSearchParams();

// Fetch player info
const { data: player } = await supabase
  .from("team_players")
  .select("*")
  .eq("id", id)
  .single();

// Fetch benchmark history for this player
const { data: benchmarks } = await supabase
  .from("benchmark_results")
  .select("*, team_drills(drill_name, benchmark_type)")
  .eq("player_id", id)
  .order("created_at", { ascending: false });
```

### Layout (ScrollView)

**Header:**
- Back button → `router.back()`
- Player name (text-title, font-medium)
- Positions as tag pills
- Jersey number (text-caption, text-secondary)
- Status badge: "Active" in green-400 text or "Inactive" in text-muted

**Notes section** (if notes exist):
- Section label: "Notes" (label-micro)
- Notes text (text-body, text-secondary)

**Benchmark history section:**
- Section label: "Benchmark History" (label-micro)
- List of all benchmark results for this player
- Each row (surface-raised card):
  - Drill name (text-body, font-medium)
  - Result: time in seconds (for timed) or rating out of 5 (for rated)
  - Date (text-caption, text-secondary)
  - Tags as small pills if any exist
  - Notes preview if any (text-caption, text-muted, single line truncated)
- If no benchmarks: "No assessments yet. Run a benchmark to see this player's results here." (text-caption, text-secondary)

**Action buttons (bottom):**
- "Edit Player" (secondary, full width)
- "Deactivate Player" (destructive text button, error color) if player is active
- "Reactivate Player" (secondary, full width) if player is inactive

**Deactivate/Reactivate:**
```typescript
// Deactivate
await supabase.from("team_players").update({ status: "inactive" }).eq("id", playerId);
// Reactivate
await supabase.from("team_players").update({ status: "active" }).eq("id", playerId);
```
After either action, refresh the player data. Optionally navigate back to roster list.

## Task 4: Edit player form

Create `app/(tabs)/roster/[id]/edit.tsx`:

Same form as add player, but:
- Fetch player on mount and pre-populate all fields
- Header: "Edit Player" instead of "Add Player"
- Submit does an `update` instead of `insert`
- Button text: "Save Changes"

```typescript
const { error } = await supabase
  .from("team_players")
  .update({
    player_name: name,
    positions: selectedPositions.length > 0 ? selectedPositions : null,
    jersey_number: jerseyNumber || null,
    notes: notes || null,
  })
  .eq("id", playerId);
```

On success: `router.back()` to the player detail.

## Design rules

- Dark mode. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500).
- Screen padding: 20px horizontal.
- Card padding: 16px.
- Position pills: small (text-micro size), non-interactive on list/detail, interactive (tappable Tag component) on forms.
- Touch targets: 44px minimum height.
- Dividers between list items: border-subtle, 1px.
- Section spacing: 24px vertical gap between sections.

## Testing

1. Open Roster tab. Should show empty state if no players.
2. Tap "Add Player". Fill in name and positions. Tap "Add Player". Should save and return to roster list.
3. New player should appear in the Active section.
4. Tap the player. Should show detail page with name, positions, and empty benchmark history.
5. Tap "Edit Player". Fields should be pre-populated. Change the name. Save. Verify the change on detail page.
6. Tap "Deactivate Player". Player should move to the Inactive section on the roster list.
7. Tap the inactive player. Tap "Reactivate Player". Player should move back to Active.
8. Add 3+ players. Verify the list sorts alphabetically.
9. Pull to refresh on the roster list. Should reload.
10. Try submitting the add form with no name. Should show validation error.
