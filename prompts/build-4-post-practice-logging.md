# Build 4: Post-Practice Logging

Read `CLAUDE.md` for design system and patterns. Read `../CLAUDE.md` for product context (Coach/Team Management MVP section, specifically "5. Post-Practice Logging" under MVP Features). Read `../qb_supabase_full_package/docs/coach_mvp_schema_spec.md` for the `practice_logs` table schema.

## Context

Post-practice logging is the structured capture right after practice while observations are fresh. It references the practice plan but captures what actually happened. The key insight: comparing planned vs. actual drills over time reveals patterns (e.g., "you keep skipping footwork drills").

A practice plan goes through this lifecycle: draft → finalized → completed. Logging a post-practice entry is what moves the plan to "completed" status.

## Task: Replace the stub at `/practice/[id]/log/page.tsx`

### Post-Practice Log Page (`/practice/[id]/log/page.tsx`)

Replace the placeholder with a real implementation. This is a single scrollable form.

**Header:**
- "Post-Practice Log" (text-title)
- Practice date below (text-caption, text-secondary, e.g., "Sunday, May 11, 2026")

**Section 1: Drills Completed vs. Skipped**
- Load the practice plan's drills (from practice_plan_drills joined with team_drills)
- Show each planned drill as a row with the drill name and two toggle states:
  - Completed (green checkmark, default state — assume drills were done unless marked otherwise)
  - Skipped (red X mark)
- Tapping toggles between completed and skipped
- This maps to the `drills_completed` and `drills_skipped` uuid arrays on practice_logs

**Section 2: Team Performance**
- "How did the team perform?" (label-micro)
- Team performance notes (textarea, placeholder: "Overall observations on how the team did...")

**Section 3: Highlights & Areas to Improve**
- "What went well?" (label-micro)
- Highlights textarea (placeholder: "Best moments, standout players, things that clicked...")
- "What needs work?" (label-micro)
- Areas to improve textarea (placeholder: "Gaps to address, drills to revisit, adjustments for next time...")

**Section 4: Quick Stats**
- Attendance count (number input, label: "Players present", placeholder: "e.g., 12")
- Energy level (1-5 tappable buttons, same style as benchmark rating buttons):
  - 1: Low energy
  - 2: Sluggish
  - 3: Average
  - 4: Good energy
  - 5: Fired up

**Button:**
- "Save Practice Log" (primary orange, full-width)

**On submit:**
1. Insert into `practice_logs`:
   - practice_plan_id: from URL params
   - team_id: from team context
   - logged_by: current user id
   - drills_completed: array of drill IDs that were marked completed
   - drills_skipped: array of drill IDs that were marked skipped
   - team_performance_notes
   - highlights
   - areas_to_improve
   - attendance_count
   - energy_level
2. Update the practice_plan status to "completed":
   - `supabase.from('practice_plans').update({ status: 'completed' }).eq('id', planId)`
3. On success: redirect to `/practice/[id]`

**Architecture:**
- Server component fetches practice plan + its drills
- Client component for the form
- Verify the plan belongs to the user's team
- Only allow logging if plan status is "finalized" (don't allow logging against a draft plan). If status is draft, redirect to the plan detail page.

### Update Practice Plan Detail Page (`/practice/[id]/page.tsx`)

When a practice plan has status "completed" and has an associated practice_log:
- Show a "Practice Log" section below the drill schedule
- Display: drills completed count vs. planned count (e.g., "6 of 8 drills completed")
- Show which drills were skipped (if any) with a subtle red indicator
- Show highlights, areas to improve, attendance, and energy level
- Team performance notes

Query: `supabase.from('practice_logs').select('*').eq('practice_plan_id', planId).single()`

If the plan is "finalized" and has no practice log yet, the "Log Practice" button should be prominent. If it's "completed" with a log, show the log data and change the button to "View Log" or just show inline.

## Design rules
- Dark mode. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500).
- The drill completed/skipped toggles should be large and easy to tap (44px minimum height per row). Green for completed, red/error for skipped.
- Energy level buttons: same size and style as the 1-5 benchmark rating buttons.
- Keep the form compact. A captain should be able to fill this out in under 2 minutes right after practice.
- Screen padding px-xl (20px).
