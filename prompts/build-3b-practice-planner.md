# Build 3b: Practice Planner

Read `CLAUDE.md` for design system and patterns. Read `../CLAUDE.md` for product context (Coach/Team Management MVP section, specifically "4. Practice Planner" under MVP Features). Read `../qb_supabase_full_package/docs/coach_mvp_schema_spec.md` for the `practice_plans` and `practice_plan_drills` table schemas.

## Context

Practice plans are built during the week for Sunday practice. Captains select drills from the library, assign time blocks, and set the order. The plan has a lifecycle: draft → finalized → completed (completed happens after post-practice logging, which is a future build).

Key product decisions:
- Plans are for a specific date (Sundays typically)
- Captains pull published drills from the team library into the plan
- Each drill gets a time allocation (minutes) and order position
- Benchmark data should inform what to prioritize (but this is a UX suggestion, not a hard requirement for MVP)
- Multiple captains can view and collaborate on the plan during the week

## Task: Build three pages

### 1. Practice Plans List Page (`/practice/page.tsx`)

Replace the current placeholder with a real implementation.

**Layout:**
- Header: "Practice Plans" + "New Plan" button (orange-500, right-aligned)
- List of practice plans sorted by date (newest first)
- Each plan card (outlined card style) shows:
  - Practice date (text-heading, font-medium, formatted like "Sun, May 11")
  - Title if set (text-body below date)
  - Status badge: "Draft" (muted dashed border), "Finalized" (green-400 text, green border), "Completed" (text-muted)
  - Drill count: "6 drills" (text-caption, text-secondary)
  - Total duration: "75 min" (text-caption, text-secondary)
  - Tap → navigate to `/practice/[id]`
- Empty state: "No practice plans yet. Plan your first session." with "New Plan" button.

**Data query:**
```
supabase.from('practice_plans')
  .select('id, practice_date, title, status, notes, practice_plan_drills(id, duration_minutes)')
  .eq('team_id', teamId)
  .order('practice_date', { ascending: false })
```

Calculate drill count and total duration client-side from the nested practice_plan_drills.

**Architecture:**
- Server component for auth + team check + data fetching
- Client component for the list rendering

### 2. Create/Edit Practice Plan Page (`/practice/new/page.tsx` and `/practice/[id]/edit/page.tsx`)

Replace the placeholder `/practice/new/page.tsx`. Also create the edit page.

**Layout — single scrollable page:**

**Header section:**
- Practice date (date picker input, required)
- Title (optional text input, placeholder: "e.g., Pre-tournament conditioning focus")
- Notes (optional textarea, placeholder: "General notes about this practice...")

**Drill selection section:**
- Header: "Drills" (text-heading) + "Add Drill" button
- Tapping "Add Drill" opens a drill picker (inline expandable section or modal-like overlay):
  - Shows all published drills from the team library
  - Filterable by category (same pill filter as drill library page)
  - Each drill row is tappable to add it to the plan
  - Already-added drills show a checkmark and are dimmed
- Added drills appear in an ordered list below:
  - Each row: drag handle (or up/down arrows for reordering), drill name, duration input (number, minutes), remove button (X)
  - Duration input: small numeric input with "min" label
  - Drill order is determined by list position (top = 1)

**Buttons at bottom:**
- "Save Draft" (secondary style) — saves with status = 'draft'
- "Finalize Plan" (primary orange) — saves with status = 'finalized'

**On submit:**
1. Insert/update `practice_plans`: team_id, created_by, practice_date, title, status, notes
2. For each drill in the list, insert into `practice_plan_drills`: practice_plan_id, drill_id, drill_order, duration_minutes, notes (null for now)
3. On edit: delete existing practice_plan_drills for this plan, then re-insert (simpler than tracking individual changes)
4. On success: redirect to `/practice/[id]`

**Architecture:**
- Server component fetches published drills + categories (for the picker) + existing plan data (for edit)
- Client component for the form (manages drill list state, reordering, etc.)
- For the edit page: same component, pre-populated with existing plan data

### 3. Practice Plan Detail Page (`/practice/[id]/page.tsx`)

**Layout:**
- Back link: "← Back to Plans" (links to `/practice`)
- Practice date as title (text-title, formatted like "Sunday, May 11, 2026")
- Title below if set (text-body, text-secondary)
- Status badge (same styling as list page)
- Notes section if present

**Drill schedule section:**
- Header: "Schedule" (text-heading)
- Ordered list of drills with:
  - Order number (text-muted, left side)
  - Drill name (text-body, font-medium) — tappable, links to `/drills/[drillId]`
  - Duration: "15 min" (text-caption, text-secondary, right-aligned)
  - Category pill (small, muted)
- Total duration at bottom: "Total: 75 minutes" (text-body, font-medium)

**Action buttons:**
- If status is "draft": "Edit Plan" (primary) + "Finalize" (secondary green)
- If status is "finalized": "Edit Plan" (secondary) + "Log Practice" button (primary orange) → links to `/practice/[id]/log` (placeholder for now, will be built in Build 4)
- If status is "completed": read-only, no action buttons

**Data query:**
```
supabase.from('practice_plans')
  .select('*, practice_plan_drills(*, team_drills(drill_name, drill_categories(category_name)))')
  .eq('id', params.id)
  .single()
```

Order practice_plan_drills by drill_order.

## Also create these stub pages:

- `/practice/[id]/log/page.tsx` — placeholder: "Post-practice logging coming in Build 4"

## Design rules reminder
- Dark mode always. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500). Never bold.
- Orange = interactive/CTA. Green = finalized/positive status.
- Touch targets 44px minimum.
- Screen padding px-xl (20px).
- The drill picker should be easy to use on mobile. Large tap targets for adding drills.
- Duration inputs should be compact (48px wide numeric inputs).
- Reordering: up/down arrow buttons are simpler than drag-and-drop on mobile. Each drill row gets a ↑ and ↓ button.
