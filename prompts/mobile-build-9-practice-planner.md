# Mobile Build 9: Practice Planner (List + Create + Detail + Edit)

Read `unlock-mobile/CLAUDE.md` for project context and design system. Read `unlock-app/src/app/practice/PracticeListClient.tsx`, `unlock-app/src/app/practice/PracticePlanForm.tsx`, `unlock-app/src/app/practice/[id]/page.tsx`, and `unlock-app/src/app/practice/[id]/edit/page.tsx` for the web implementations to port.

## Context

Practice planning is how captains structure their weekly practices. They build a plan during the week (pick drills, assign time blocks, set a date), then finalize it before practice day. After practice, they log what happened (Build 10, separate prompt). The planner needs to be fast and simple. If it's slower than texting the group chat, captains won't use it.

## Task 1: Practice plans list screen

Replace the placeholder `app/(tabs)/practice/index.tsx`:

### Header
- "Practice" (text-title, font-medium)
- Safe area top padding
- "+" button in top-right to create a new plan → `/practice/new`

### Plans list
- Fetch all practice plans:
  ```typescript
  const { data: plans } = await supabase
    .from("practice_plans")
    .select("id, practice_date, start_time, end_time, title, status, notes, practice_plan_drills(id, duration_minutes)")
    .eq("team_id", teamId)
    .order("practice_date", { ascending: false });
  ```
- Each plan is a card (surface-raised, rounded-xl, 1px border in border-subtle):
  - Date formatted long: "Sunday, May 11" (text-body, font-medium)
  - Optional title below date (text-caption, text-secondary)
  - Drill count: "5 drills" (text-caption, text-secondary)
  - Total duration: sum of `practice_plan_drills` durations, e.g., "75 min" (text-caption, text-secondary)
  - Status badge on the right:
    - "Draft" — dashed border, text-muted
    - "Finalized" — green-400 text, green background at 15% opacity
    - "Completed" — text-muted, surface-raised background
  - Chevron right icon
  - Left orange accent bar for finalized plans (the next one to run)
- Tap navigates to detail: `router.push(\`/practice/\${plan.id}\`)`

### Empty state
- "No practice plans yet. Plan your first practice to keep the team on track."
- CTA button: "Plan a Practice" (primary orange) → `/practice/new`

### Pull-to-refresh
- RefreshControl to reload the list

## Task 2: Create practice plan

Create `app/(tabs)/practice/new.tsx`:

### Header
- Back button → `router.back()`
- "New Practice Plan" (text-title, font-medium)

### Form fields (ScrollView with KeyboardAvoidingView)

**1. Practice date** (required)
- Label: "Date" (label-micro)
- Date picker button showing the selected date in readable format ("Sunday, May 11, 2026")
- Use a native date picker (React Native DateTimePicker or a simple modal date selector)
- Default to the next upcoming Sunday (most common practice day)

**2. Start time** (optional)
- Label: "Start Time" (label-micro)
- Time picker button showing selected time ("10:00 AM")
- Default to empty / not set

**3. End time** (optional)
- Label: "End Time" (label-micro)
- Time picker button showing selected time ("12:00 PM")
- Validation: if both start and end are set, end must be after start

**4. Title** (optional)
- Input component, label: "Title", placeholder: "e.g., Pre-tournament conditioning"

**5. Notes** (optional)
- TextArea, label: "Notes", placeholder: "Goals for this practice, things to focus on..."

**6. Drills section**
- Section label: "Drills" (label-micro) with count: "3 drills · 60 min total"
- Duration calculator: if start and end times are set, show remaining time: "15 min remaining of 120 min window"
- List of added drills, each showing:
  - Drill name (text-body, font-medium)
  - Category tag (text-micro pill)
  - Duration input: number input showing minutes, e.g., "15 min"
  - Reorder buttons: up arrow / down arrow (Ionicons `chevron-up` / `chevron-down`, 20px)
  - Remove button: X icon (Ionicons `close-circle-outline`, 20px, text-muted)
  - Reorder buttons disabled at boundaries (first item can't go up, last can't go down)
- "Add Drill" button at end of drill list (secondary style, full width)
- Tapping "Add Drill" opens the drill picker (see below)

**7. Drill picker (modal or bottom sheet)**
- Full-screen modal or bottom sheet that overlays the form
- Header: "Add Drills" with "Done" button to close
- Category filter: horizontal scrolling row of pill buttons ("All" + each category)
- Drill list filtered by selected category:
  - Each drill row: drill name, category tag, "+" button to add
  - Already-added drills show a checkmark instead of "+"
  - Tap "+" adds the drill to the plan with a default duration of 15 minutes
- Fetch drills:
  ```typescript
  const { data: drills } = await supabase
    .from("team_drills")
    .select("id, drill_name, category_id, drill_categories(category_name)")
    .eq("team_id", teamId)
    .eq("status", "published")
    .order("drill_name");
  
  const { data: categories } = await supabase
    .from("drill_categories")
    .select("id, category_name, display_order")
    .or(`team_id.is.null,team_id.eq.${teamId}`)
    .order("display_order");
  ```

### Save buttons (bottom of form)
- Two buttons side by side:
  - "Save as Draft" (secondary) — saves with status "draft"
  - "Save & Finalize" (primary orange) — saves with status "finalized"
- Both buttons full width if stacked, or 50/50 if side by side

### On save
```typescript
// 1. Insert the practice plan
const { data: plan, error } = await supabase
  .from("practice_plans")
  .insert({
    team_id: teamId,
    practice_date: selectedDate,  // YYYY-MM-DD
    start_time: startTime || null,  // HH:MM or null
    end_time: endTime || null,
    title: title || null,
    notes: notes || null,
    status: isFinalizing ? "finalized" : "draft",
    created_by: userId,
  })
  .select("id")
  .single();

// 2. Insert drill associations
if (selectedDrills.length > 0) {
  await supabase.from("practice_plan_drills").insert(
    selectedDrills.map((d, idx) => ({
      practice_plan_id: plan.id,
      drill_id: d.drillId,
      drill_order: idx + 1,
      duration_minutes: d.durationMinutes,
    }))
  );
}
```

On success: navigate to the detail view `router.replace(\`/practice/\${plan.id}\`)`

### Validation
- Date is required. Show error if not set.
- At least one drill should be added (warn but don't block — a plan with notes and no drills is still valid as a draft).

## Task 3: Practice plan detail

Create `app/(tabs)/practice/[id].tsx`:

### Data fetching
```typescript
const { id } = useLocalSearchParams();

// Fetch plan with drills
const { data: plan } = await supabase
  .from("practice_plans")
  .select("*, practice_plan_drills(id, drill_id, drill_order, duration_minutes, team_drills(id, drill_name, drill_categories(category_name)))")
  .eq("id", id)
  .single();

// If completed, fetch the practice log
let log = null;
if (plan?.status === "completed") {
  const { data } = await supabase
    .from("practice_logs")
    .select("*")
    .eq("practice_plan_id", id)
    .single();
  log = data;
}
```

### Layout (ScrollView)

**Header:**
- Back button → `router.back()`
- Plan date as title: "Sunday, May 11" (text-title, font-medium)
- Optional title below (text-body, text-secondary)
- Status badge
- Time range if set: "10:00 AM - 12:00 PM" (text-caption, text-secondary)

**Notes section** (if notes exist):
- Section label: "Notes" (label-micro)
- Notes text (text-body, text-secondary)

**Drill schedule section:**
- Section label: "Schedule" (label-micro) with summary: "5 drills · 75 min"
- Numbered list of drills, each in a card row:
  - Index number (text-caption, text-muted): "1."
  - Drill name (text-body, font-medium)
  - Category as small pill (text-micro)
  - Duration on the right: "15 min" (text-caption, text-secondary)
- If no drills: "No drills added to this plan."

**Duration overview:**
- If start/end times set: progress bar showing planned time vs. available time
- Text: "75 min planned of 120 min window" (text-caption, text-secondary)
- Highlight in orange if planned exceeds available

**Practice log section** (only shown if status = "completed"):
- Section label: "Practice Log" (label-micro)
- Drills completed vs. skipped counts
- Attendance count
- Energy level (1-5 with label)
- Performance notes, highlights, areas to improve (each in its own sub-section)

**Action buttons (bottom):**
- **Draft status:**
  - "Edit Plan" (secondary, full width)
  - "Finalize" (primary orange, full width) — updates status to "finalized"
- **Finalized status:**
  - "Log Practice" (primary orange, full width) → navigates to `/practice/${id}/log`
  - "Edit Plan" (secondary, full width) → navigates to `/practice/${id}/edit`
- **Completed status:**
  - No action buttons (read-only view)

### Finalize action
```typescript
await supabase
  .from("practice_plans")
  .update({ status: "finalized" })
  .eq("id", id);
```
Refresh the plan data after finalizing.

## Task 4: Edit practice plan

Create `app/(tabs)/practice/[id]/edit.tsx`:

Same form as create, but:
- Fetch plan on mount and pre-populate all fields including drills
- Header: "Edit Practice Plan"
- On save: update the plan record and replace drill associations
  ```typescript
  // Update plan
  await supabase
    .from("practice_plans")
    .update({ practice_date, start_time, end_time, title, notes, status })
    .eq("id", planId);
  
  // Replace drills: delete old, insert new
  await supabase
    .from("practice_plan_drills")
    .delete()
    .eq("practice_plan_id", planId);
  
  if (selectedDrills.length > 0) {
    await supabase.from("practice_plan_drills").insert(
      selectedDrills.map((d, idx) => ({
        practice_plan_id: planId,
        drill_id: d.drillId,
        drill_order: idx + 1,
        duration_minutes: d.durationMinutes,
      }))
    );
  }
  ```
- On success: `router.back()` to the detail view

## Design rules

- Dark mode. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500). Never bold.
- Screen padding: 20px horizontal.
- Card padding: 16px.
- Status badges: small pills (text-micro, rounded-pill)
  - Draft: dashed 1px border, text-muted
  - Finalized: green-400 text on green background at 15% opacity
  - Completed: text-muted on surface-raised
- Touch targets: 44px minimum.
- Date/time pickers: use native controls. On iOS this means the built-in date picker wheel or compact style.
- Drill picker modal: full-screen or large bottom sheet, not a small popover.
- Reorder buttons: clear up/down arrows, disabled state at boundaries.
- Duration inputs: compact number inputs with "min" suffix label.
- Section spacing: 24px between major sections.

## Testing

1. Open Practice tab. Should show empty state.
2. Tap "+" or the CTA button. Create form should open with next Sunday pre-selected.
3. Set a date, add a title, add 3 drills via the drill picker.
4. In the drill picker, filter by category. Add drills. Close picker.
5. Reorder drills using up/down buttons. Verify boundaries work.
6. Set durations for each drill. Total should update.
7. Set start/end times. Remaining time calculator should show.
8. Tap "Save as Draft". Should navigate to detail view showing "Draft" status.
9. On detail view, tap "Finalize". Status should change to "Finalized".
10. Tap "Edit Plan". Form should pre-populate with all plan data including drills in correct order.
11. Change something, save. Verify changes on detail view.
12. Create another plan and tap "Save & Finalize" directly. Should show as finalized.
13. Pull to refresh on the list. Both plans should appear sorted by date.
14. Try saving with no date. Should show validation error.
