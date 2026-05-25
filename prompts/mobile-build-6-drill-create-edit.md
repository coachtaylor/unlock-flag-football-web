# Mobile Build 6 (Rerun): Drill Create + Edit Forms

Read `unlock-mobile/CLAUDE.md` for project context and design system. Read `unlock-app/src/app/drills/new/page.tsx` and `unlock-app/src/app/drills/[id]/edit/page.tsx` for the web form implementations to port.

## CRITICAL PROBLEM

The file `app/(tabs)/drills/new.tsx` does NOT exist. When the user navigates to `/drills/new`, Expo Router matches it to the `[id].tsx` dynamic route with `id = "new"`, which tries to fetch a drill with that ID from Supabase and shows "Drill not found." This means captains cannot create drills at all.

The file `app/(tabs)/drills/[id]/edit.tsx` also does NOT exist, so drills cannot be edited.

This build creates both missing files. Do NOT skip any file creation. Verify both files exist after you're done.

## Task 1: Create drill form

Create `app/(tabs)/drills/new.tsx`:

### Header
- Back button (chevron-left) → `router.back()`
- "New Drill" (text-title, font-medium)
- Safe area top padding

### Form fields (ScrollView with KeyboardAvoidingView)

**1. Drill name** (required)
- Input component or TextInput, label: "Drill Name", placeholder: "e.g., 5-10-5 Shuttle"

**2. Category** (optional)
- Label: "Category" (label-micro)
- Horizontal scrolling row of selectable Tag pills
- Fetch categories:
  ```typescript
  const { data: categories } = await supabase
    .from("drill_categories")
    .select("id, category_name, display_order")
    .or(`team_id.is.null,team_id.eq.${teamId}`)
    .order("display_order");
  ```
- Single-select: tap to select, orange when selected, surface-raised when not

**3. Description** (optional)
- TextArea or multiline TextInput, label: "Description", placeholder: "How to run this drill, coaching points..."
- 4 visible lines

**4. Source URL** (optional)
- TextInput, label: "Video Link", placeholder: "https://youtube.com/... or TikTok/Instagram link"
- `keyboardType="url"`, `autoCapitalize="none"`

**5. Benchmark type** (optional)
- Label: "Benchmark Type" (label-micro)
- Three selectable pills in a row: "None", "Timed", "Rated"
- Single-select, orange when selected, "None" is default
- If "Timed": show helper text "Players will be timed in seconds" (text-caption, text-muted)
- If "Rated": show helper text "Players will be rated 1-5" (text-caption, text-muted)

**6. Equipment** (optional)
- TextInput, label: "Equipment", placeholder: "e.g., 5 cones, 1 agility ladder"

**7. Diagram — handled in Build 6b**
- Add a placeholder section labeled "Setup Diagram" (label-micro)
- Show text: "Run Build 6b to add the interactive diagram editor here." (text-caption, text-muted, centered, with Ionicons `easel-outline` icon above it)
- Do NOT build the diagram editor in this prompt. It has its own dedicated prompt: `mobile-build-6b-diagram-editor.md`

### Save buttons (bottom, stacked vertically with 12px gap)
- "Save as Draft" (secondary style)
- "Publish Drill" (primary orange)

### On save
```typescript
const { data, error } = await supabase
  .from("team_drills")
  .insert({
    team_id: teamId,
    drill_name: drillName.trim(),
    description: description.trim() || null,
    source_url: sourceUrl.trim() || null,
    benchmark_type: benchmarkType === "none" ? null : benchmarkType,
    status: isPublishing ? "published" : "draft",
    category_id: selectedCategoryId || null,
    created_by: userId,
  })
  .select("id")
  .single();
```

On success: navigate to drill detail `router.replace(\`/drills/\${data.id}\`)`

### Validation
- Drill name is required. Show error text in red below the input if empty on submit.
- Loading state on submit button (spinner or "Saving...")

## Task 2: Edit drill form

**Important routing change required:** The existing `app/(tabs)/drills/[id].tsx` needs to be moved to `app/(tabs)/drills/[id]/index.tsx` so that the `[id]` segment becomes a directory that can hold both the detail view and the edit view. Steps:

1. Create directory `app/(tabs)/drills/[id]/`
2. Move `app/(tabs)/drills/[id].tsx` → `app/(tabs)/drills/[id]/index.tsx` (same code, just moved)
3. Create `app/(tabs)/drills/[id]/edit.tsx` (the edit form)

### Edit form (`app/(tabs)/drills/[id]/edit.tsx`)

Same form layout as create, but:
- Fetch the drill on mount and pre-populate all fields:
  ```typescript
  const { id } = useLocalSearchParams();
  const { data: drill } = await supabase
    .from("team_drills")
    .select("*")
    .eq("id", id)
    .single();
  ```
- Header: "Edit Drill"
- Submit does `update` instead of `insert`:
  ```typescript
  const { error } = await supabase
    .from("team_drills")
    .update({
      drill_name: drillName.trim(),
      description: description.trim() || null,
      source_url: sourceUrl.trim() || null,
      benchmark_type: benchmarkType === "none" ? null : benchmarkType,
      status: isPublishing ? "published" : "draft",
      category_id: selectedCategoryId || null,
    })
    .eq("id", id);
  ```
- Save buttons: "Save as Draft" and "Publish" (or "Save & Unpublish" if currently published)
- On success: `router.back()` to the drill detail

## Task 3: Wire up the edit button on drill detail

After moving `[id].tsx` to `[id]/index.tsx`, update the drill detail screen to have an "Edit Drill" button that navigates to:
```typescript
router.push(`/drills/${drill.id}/edit`);
```

Check if the detail screen already has this button. If yes, verify the route. If no, add it as a secondary button below the drill info.

## Design rules

- Dark mode. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500). Never bold.
- Screen padding: 20px horizontal.
- Form section spacing: 24px between fields.
- Input/TextArea: surface-raised background, 1px border in border-subtle, rounded-xl, 16px padding.
- Tag pills: orange selected state (orange-500 bg at 15% opacity, orange text), surface-raised with border-subtle when not selected.
- Touch targets: 44px minimum height.
- All buttons get press states (opacity 0.85).
- Wrap in KeyboardAvoidingView with `behavior="padding"` on iOS.

## Verification

After completing this build, confirm ALL of the following:

1. The file `app/(tabs)/drills/new.tsx` EXISTS
2. The file `app/(tabs)/drills/[id]/index.tsx` EXISTS (moved from `[id].tsx`)
3. The file `app/(tabs)/drills/[id]/edit.tsx` EXISTS
4. The old file `app/(tabs)/drills/[id].tsx` NO LONGER EXISTS (was moved)
5. Navigating to `/drills/new` shows the create form, NOT "Drill not found."
6. Navigating to `/drills/[id]` still shows the drill detail (not broken by the move)
7. Navigating to `/drills/[id]/edit` shows the edit form

## Testing

1. From the dashboard, tap "Add Drill" quick action. Should open the CREATE form (not "Drill not found.").
2. Fill in a drill name and category. Tap "Publish Drill". Should save and navigate to the drill detail.
3. On the drill detail, tap "Edit Drill". Should open the edit form with all fields pre-populated.
4. Change the name, save. Verify the change on the detail page.
5. From the drill list, tap "+". Should open the create form.
6. Create a drill as "Draft". Verify draft status badge on the list.
7. Try saving with no name. Should show validation error.
8. Select a benchmark type. Helper text should appear below.
9. Go back to the drills list. New drills should appear.
