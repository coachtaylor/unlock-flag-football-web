# Mobile Build 10: Post-Practice Logging

Read `unlock-mobile/CLAUDE.md` for project context and design system. Read `unlock-app/src/app/practice/[id]/log/PracticeLogClient.tsx` for the web implementation to port.

## Context

After a finalized practice is run, captains log what actually happened. This is a quick structured capture: which drills were completed or skipped, general notes on how the team performed, attendance, and energy level. Completing the log moves the practice plan status to "completed" and feeds data to the dashboard. This form must be fast. Captains fill it out right after practice while it's fresh, often standing on the field.

## Task 1: Post-practice log screen

Create `app/(tabs)/practice/[id]/log.tsx`:

### Guard
- Only accessible when the practice plan has `status = "finalized"`
- On mount, fetch the plan and check status. If status is "draft", show a message: "This plan hasn't been finalized yet." with a button to go back. If status is "completed", show: "This practice has already been logged." with a button to view the plan.

### Data fetching
```typescript
const { id } = useLocalSearchParams();

// Fetch plan with drills
const { data: plan } = await supabase
  .from("practice_plans")
  .select("id, team_id, practice_date, status, practice_plan_drills(id, drill_id, drill_order, duration_minutes, team_drills(id, drill_name))")
  .eq("id", id)
  .single();

// Sort drills by drill_order
const drills = (plan.practice_plan_drills ?? [])
  .sort((a, b) => a.drill_order - b.drill_order);
```

### Layout (KeyboardAvoidingView + ScrollView)

**Header:**
- Back button → `router.back()`
- "Log Practice" (text-title, font-medium)
- Practice date subtitle: "Sunday, May 11" (text-caption, text-secondary)

**Section 1: Drills completed / skipped**
- Section label: "Drills" (label-micro) with summary: "4 completed · 1 skipped"
- Each drill is a tappable toggle card:
  - Drill name (text-body, font-medium)
  - Toggle state: **completed** (default) or **skipped**
  - Completed state: green-400 left border (3px), checkmark icon (Ionicons `checkmark-circle`, green-400) on the right
  - Skipped state: orange-500 left border (3px), X icon (Ionicons `close-circle`, orange-500) on the right
  - Card: surface-raised, rounded-xl, 1px border (border-subtle), padding 14px
  - Tap toggles between completed and skipped
  - Haptic feedback on toggle (light impact)
- All drills default to "completed" on mount
- 10px gap between drill cards

**Section 2: Team performance notes**
- Section label: "How did the team perform?" (label-micro)
- TextArea, 3 lines, placeholder: "General observations about today's practice..."
- surface-raised background, border-subtle border, rounded-xl

**Section 3: Highlights**
- Section label: "What went well?" (label-micro)
- TextArea, 3 lines, placeholder: "Best moments, breakthroughs, good reps..."

**Section 4: Areas to improve**
- Section label: "What needs work?" (label-micro)
- TextArea, 3 lines, placeholder: "Things to focus on next practice..."

**Section 5: Attendance**
- Section label: "Players present" (label-micro)
- Number input, `keyboardType="number-pad"`
- Placeholder: "e.g., 12"
- Small helper text: "How many players showed up?" (text-caption, text-muted)

**Section 6: Team energy**
- Section label: "Team energy level" (label-micro)
- 5 tappable buttons in a horizontal row (1-5):
  - Each button: 52px wide, 48px tall, rounded-xl
  - Selected: orange-500 background, white text
  - Unselected: surface-raised, border-subtle, text-secondary
  - Haptic on selection (light impact)
- Anchor text below the selected button:
  - 1: "Low energy"
  - 2: "Sluggish"
  - 3: "Average"
  - 4: "Good energy"
  - 5: "Fired up"

### Submit button
- "Complete Practice Log" (primary orange, full width, 52px height)
- Loading state while saving (spinner or "Saving...")
- 32px top margin above the button, 40px bottom margin for breathing room

### On submit
```typescript
// Separate drills into completed and skipped arrays
const drillsCompleted = drills
  .filter((_, i) => completedState[i])
  .map((d) => d.drill_id);
const drillsSkipped = drills
  .filter((_, i) => !completedState[i])
  .map((d) => d.drill_id);

// 1. Insert practice log
const { error: logError } = await supabase.from("practice_logs").insert({
  practice_plan_id: id,
  team_id: teamId,
  logged_by: userId,
  drills_completed: drillsCompleted.length > 0 ? drillsCompleted : null,
  drills_skipped: drillsSkipped.length > 0 ? drillsSkipped : null,
  team_performance_notes: performanceNotes.trim() || null,
  highlights: highlights.trim() || null,
  areas_to_improve: areasToImprove.trim() || null,
  attendance_count: attendanceCount ? parseInt(attendanceCount, 10) : null,
  energy_level: energyLevel,
});

// 2. Update practice plan status to completed
if (!logError) {
  await supabase
    .from("practice_plans")
    .update({ status: "completed" })
    .eq("id", id);
}
```

On success: navigate to the practice plan detail view `router.replace(\`/practice/\${id}\`)` which should now show the log data.

### Validation
- No required fields. Captains can submit with minimal input (even just the drill toggles at their defaults).
- If attendance is entered, validate it's a number >= 0.
- Show error text below the submit button if save fails.

## Task 2: Wire up from practice detail

The practice plan detail screen (Build 9) already has a "Log Practice" button for finalized plans. Verify it navigates to `/practice/${id}/log`.

## Task 3: Display log data on practice detail

Update the practice plan detail screen (`app/(tabs)/practice/[id].tsx`) to show the log data when the plan status is "completed":

- Section label: "Practice Log" (label-micro)
- Card (surface-raised, rounded-xl, border-subtle):
  - Drill summary: "4 of 5 drills completed" (text-body)
  - Attendance: "12 players present" (text-caption, text-secondary)
  - Energy level: show the number and label, e.g., "Energy: 4 — Good energy" (text-caption, text-secondary)
- Performance notes (if any): quoted text block style
- Highlights (if any): section with green-400 accent
- Areas to improve (if any): section with orange-500 accent

## Design rules

- Dark mode. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500). Never bold.
- Screen padding: 20px horizontal.
- Section spacing: 24px between sections.
- Drill toggle cards: clear visual difference between completed (green left border + checkmark) and skipped (orange left border + X). The toggle should feel satisfying to tap.
- Energy buttons: same pattern as the benchmark rating buttons (52px wide, orange when selected).
- TextAreas: 3 visible lines, expandable. Surface-raised background with border.
- The whole form should be completable in under 60 seconds. No friction.
- All tappable elements get press states and haptic feedback.

## Testing

1. Open a finalized practice plan detail. Tap "Log Practice".
2. All drills should show as "completed" (green) by default.
3. Tap a drill to toggle it to "skipped" (orange). Tap again to toggle back.
4. Drill summary count should update as you toggle.
5. Type notes in each textarea field.
6. Enter an attendance count.
7. Tap an energy level button. Anchor text should appear.
8. Tap "Complete Practice Log". Should save and redirect to detail view.
9. Detail view should now show "Completed" status and display the log data.
10. The "Log Practice" button should no longer appear (completed state is read-only).
11. Try navigating to the log screen for a draft plan. Should show guard message.
12. Try navigating to the log screen for an already-completed plan. Should show guard message.
13. Submit with no fields filled (just default completed drills). Should save successfully.
