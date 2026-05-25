# Prompt: Rebuild Onboarding Screen 2 + Screen 3

Read `CLAUDE.md` in this repo for full project context, design tokens, and component patterns.

The onboarding flow at `src/app/onboarding/page.tsx` needs two changes:

## 1. Screen 2: Change improvement_goals from free-text to multi-select pills

The `improvement_goals` field is currently a `<textarea>`. Replace it with multi-select pill buttons. The six options are: **Strength**, **Mobility**, **Throwing Mechanics**, **Pain Management**, **Football IQ**, **Conditioning**. The user can select multiple pills (toggling each on/off). Use the same `Pill` component pattern already in the file for format preference.

Update the `ProfileDraft` type so `improvement_goals` is `string[]` instead of `string`. Update all references (the `persist` function, the `useEffect` that loads existing profile data, etc.).

## 2. Screen 3: Replace "Choose starting point" with "Your Plan"

Delete the entire `StartingPointScreen` component. Replace it with a `YourPlanScreen` component that:

- Reads `draft.improvement_goals` (the array from Screen 2)
- Displays personalized plan cards based on what the user selected:
  - If any of ["Strength", "Mobility", "Conditioning"] → show card: "Workouts with muscle group balance and progress tracking"
  - If "Throwing Mechanics" → show card: "Throwing session tracking with mechanics quality monitoring"
  - If "Pain Management" → show card: "Elbow pain trends correlated with throwing volume"
  - If "Football IQ" → show card: "Routes, coverages, and play concepts in the playbook"
  - Always show (regardless of selections): "Weekly focus recommendations based on your activity"
- Each card is a static info card (NOT a link or button). Style them like the locked-insight cards on the dashboard: `surface-base` background, `border-subtle` dashed border, with an accent-colored label. Use these accent colors for the label text on each card:
  - Workouts card: `--color-green-400`
  - Throwing card: `--color-orange-400`
  - Pain Management card: `--color-orange-400`
  - Football IQ card: `--color-indigo-400`
  - Weekly focus card: `--color-blue-400`
- Header: "Here's your plan"
- Subtext: "Based on your goals, here's how Unlock will help you improve."
- One CTA button at the bottom: "Let's go" (uses the PrimaryButton component already in the file)
- The "Let's go" button calls `persist(2, true)` to mark onboarding complete, then `router.replace("/")`

## 3. Database migration

The `improvement_goals` column in the `profiles` table is currently `text`. It needs to be `text[]` (a PostgreSQL text array) to store multiple selections.

Run this migration in the Supabase SQL Editor (Dashboard > SQL Editor > New query):

```sql
ALTER TABLE public.profiles
  ALTER COLUMN improvement_goals TYPE text[]
  USING CASE WHEN improvement_goals IS NOT NULL
    THEN ARRAY[improvement_goals]
    ELSE NULL
  END;
```

This converts any existing text values into single-element arrays so nothing breaks.

**Important:** This migration must be run BEFORE testing the updated onboarding code, because the code will try to write an array to that column.

## 4. Update the persist function

In the `persist` function, `improvement_goals` is currently sent as `draft.improvement_goals.trim()`. Change it to send the array directly: `draft.improvement_goals` (which is now `string[]`). Remove the `.trim()` call. For the null check, use `draft.improvement_goals.length > 0 ? draft.improvement_goals : null`.

## 5. Remove dead code

- Delete the `StartingPoint` type
- Delete the `STARTING_ROUTES` constant
- Delete the `StartingPointScreen` component
- Update the `finish` function: it no longer takes a `StartingPoint` argument. Rename it to something like `completeOnboarding` and have it just call `persist(2, true)` then `router.replace("/")`

## Acceptance criteria

- Screen 2 shows 6 pill buttons for improvement goals (not a textarea)
- User can select multiple pills (they toggle on/off)
- Screen 3 shows personalized cards based on selected goals
- Screen 3 has a single "Let's go" button that completes onboarding and goes to dashboard
- Profile saves improvement_goals as a text array to Supabase
- Existing onboarding functionality (progress dots, back button, loading state, error handling) still works
- No TypeScript errors
