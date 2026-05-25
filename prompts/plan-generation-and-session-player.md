# Prompt: Plan Generation Engine + Session Player + Custom Workout

Read `CLAUDE.md` in this repo for full project context, design tokens, and component patterns. Also read `docs/PLAN_GENERATION_SPEC.md` for the full product spec behind this feature.

This prompt builds three things:
1. The plan generation utility function
2. The planned session player (the primary workout experience)
3. The custom workout fallback

## 1. Plan generation utility: `src/lib/plan-generator.ts`

Create a pure utility module with no React or UI dependencies. This function will be called from the onboarding completion flow and (later) from a "regenerate plan" settings action.

### Types

```typescript
export type DayStatus = "open" | "game" | "practice";

export type WeeklySchedule = {
  sunday: DayStatus;
  monday: DayStatus;
  tuesday: DayStatus;
  wednesday: DayStatus;
  thursday: DayStatus;
  friday: DayStatus;
  saturday: DayStatus;
};

export type SessionCategory =
  | "strength_lower"
  | "strength_upper"
  | "conditioning"
  | "fundamentals"
  | "recovery"
  | "football_iq"
  | "game"
  | "practice";

export type DayPlan = {
  dayNumber: number; // 1=Sunday, 2=Monday, ... 7=Saturday
  dayName: string; // "Sunday", "Monday", etc.
  dayKey: keyof WeeklySchedule; // "sunday", "monday", etc.
  category: SessionCategory;
  label: string; // Human-readable: "Lower Body Strength + Hip Power"
  sessionType: string; // Maps to program_days.session_type: "strength", "mobility", "speed", etc.
  estimatedMinutes: number | null;
};

export type GeneratedPlan = {
  days: DayPlan[];
  templateName: string;
  goals: string[];
};
```

### Function: `generateWeeklyPlan(schedule: WeeklySchedule, goals: string[]): GeneratedPlan`

This is the core rules engine. It takes the user's weekly schedule and improvement goals and returns a 7-day plan.

**Rules (apply in this order):**

1. **Lock game/practice days.** Any day marked "game" or "practice" becomes a Game Day or Practice Day. Not assignable.

2. **Day before game = light.** The day immediately before a game should be Fundamentals, Football IQ, or Recovery. Never Strength or Conditioning.

3. **Day after game = recovery.** The day immediately after a game should be Recovery + Mobility. **Exception (Thursday override):** If the day after a game is the ONLY available training day before the next game (meaning the day after that is also before a game), assign a hard session instead. The user needs at least one hard training day per week.

4. **No consecutive hard days.** Strength (upper or lower) and Conditioning are "hard" sessions. Never schedule them back-to-back.

5. **Goal-based assignment.** Fill remaining open days based on selected goals:
   - "Strength" selected: assign up to 2 Strength sessions (1 lower, 1 upper)
   - "Conditioning" selected: assign 1 Conditioning + Agility session
   - "Throwing Mechanics" selected: assign 1 Fundamentals session
   - "Mobility" selected: add 1 Recovery + Mobility session (beyond the mandatory post-game recovery)
   - "Pain Management" selected: cap Strength at 1 session max, add an extra Recovery + Mobility session
   - "Football IQ" selected: assign 1 Football IQ session

6. **Fill remaining days.** Any unassigned open days default to: Fundamentals > Recovery + Mobility > Football IQ (in that priority order).

7. **Minimum recovery.** Every week must have at least 1 Recovery + Mobility day.

**Label mapping:**

| Category | label | sessionType | estimatedMinutes |
|---|---|---|---|
| strength_lower | "Lower Body Strength + Hip Power" | "strength" | 70 |
| strength_upper | "Upper Body Strength + Arm Care" | "strength" | 65 |
| conditioning | "Conditioning + Agility" | "speed" | 55 |
| fundamentals | "Fundamentals + Mechanics" | "throwing_mechanics" | 45 |
| recovery | "Recovery + Mobility" | "recovery" | 35 |
| football_iq | "Football IQ" | "study" | 30 |
| game | "Game Day" | "game" | null |
| practice | "Practice Day" | "throwing" | null |

**Template name:** `"[User's name]'s Weekly Plan"` (or just `"My Weekly Plan"` if no name provided).

### Function: `savePlanToDatabase(supabase, userId, plan: GeneratedPlan, exercises: ExerciseRow[]): Promise<void>`

This function writes the plan to Supabase. It creates:

1. A `program_templates` row:
   ```typescript
   {
     owner_user_id: userId,
     template_name: plan.templateName,
     sport: "flag_football",
     position: "QB",
     goal: plan.goals.join(", "),
     description: "Auto-generated weekly plan based on your goals and schedule.",
     total_weeks: 8,
     is_active: true,
     tags: ["auto-generated", "flag-football", "QB"]
   }
   ```

2. A `program_days` row for each day:
   ```typescript
   {
     template_id: templateId, // from step 1
     day_number: day.dayNumber,
     day_name: day.dayName,
     focus: day.label,
     session_type: day.sessionType,
     estimated_minutes: day.estimatedMinutes,
     notes: null,
     tags: [day.category]
   }
   ```

3. For each training day (not game/practice), `program_day_exercises` rows. Map exercises from the global seed template by matching `session_type`. The logic:
   - Query `exercise_library` for global exercises (`owner_user_id IS NULL`) matching the day's category
   - Use the global seed template's exercise assignments as the source (query `program_day_exercises` joined to `program_days` where the global template's `session_type` matches)
   - Copy those exercise assignments to the user's plan day, preserving `exercise_order`, `prescribed_sets`, `prescribed_reps`, `prescribed_rpe`, `rest_seconds`, and `notes`

**Important:** This function should be called from the onboarding completion flow. In `src/app/onboarding/page.tsx`, update `completeOnboarding()` to:
1. Call `persist(3, true)` to save the profile
2. Fetch the global exercises from `exercise_library`
3. Call `savePlanToDatabase(supabase, userId, plan, exercises)`
4. Then `router.replace("/")`

Wrap the plan save in a try/catch. If it fails, still complete onboarding (the user shouldn't be stuck). Log the error and show the dashboard. The plan can be regenerated later.

## 2. Dashboard "Today's Session" card

Update `src/app/page.tsx` (the dashboard) to show a card for today's planned session.

### Data fetching

Query the user's active plan:

```typescript
// 1. Get the user's active template
const { data: template } = await supabase
  .from("program_templates")
  .select("id")
  .eq("owner_user_id", userId)
  .eq("is_active", true)
  .maybeSingle();

// 2. Get today's program day (day_number: 1=Sun, 2=Mon, etc.)
const today = new Date();
const dayNumber = today.getDay() + 1; // getDay() returns 0=Sun, we need 1=Sun

const { data: todayPlan } = await supabase
  .from("program_days")
  .select("id, day_name, focus, session_type, estimated_minutes, tags")
  .eq("template_id", template.id)
  .eq("day_number", dayNumber)
  .maybeSingle();

// 3. Get exercises for today (if it's a training day)
const { data: exercises } = await supabase
  .from("program_day_exercises")
  .select("id, exercise_order, prescribed_sets, prescribed_reps, prescribed_rpe, rest_seconds, notes, exercise:exercise_library(id, exercise_name, coaching_cue, category)")
  .eq("program_day_id", todayPlan.id)
  .order("exercise_order");

// 4. Check if today's session is already logged
const todayStr = today.toISOString().split("T")[0];
const { data: existingSession } = await supabase
  .from("workout_sessions")
  .select("id")
  .eq("user_id", userId)
  .eq("session_date", todayStr)
  .eq("template_day_id", todayPlan.id)
  .maybeSingle();
```

### Card UI

Show at the top of the dashboard:

**If today is a training day (not game/practice) and not yet logged:**
- Card with left accent border (color by session type, same mapping as onboarding plan preview)
- Title: today's `focus` (e.g., "Lower Body Strength + Hip Power")
- Subtitle: `estimated_minutes` + "min" and exercise count (e.g., "~65 min, 7 exercises")
- CTA: "Start Session" button (orange-500 PrimaryButton style)
- Tapping navigates to `/log/workout?plan_day_id=[todayPlan.id]`

**If today is a game day:**
- Card with orange-500 left border
- Title: "Game Day"
- CTA: "Log Game Recap" linking to `/log/game-recap`

**If today is a practice day:**
- Card with blue-400 left border
- Title: "Practice Day"
- CTA: "Log Game Recap" linking to `/log/game-recap?type=practice`

**If today's session is already logged:**
- Card in muted state with checkmark
- Title: today's `focus` + " (Done)"
- No CTA button

**Below the primary card:** A text link: "Log a custom workout" that navigates to `/log/workout?custom=true`.

## 3. Planned Session Player: `/log/workout`

This is the core workout experience. When the user taps "Start Session" from the dashboard, they land here with the day's exercises pre-loaded.

### Route behavior

`/log/workout` checks for query params:
- `?plan_day_id=[uuid]`: Load the planned session for that program day
- `?custom=true`: Show the custom workout flow (Section 4 below)
- No params: redirect to dashboard

### Session player layout

**Top bar:**
- Back arrow (navigates to dashboard with "Discard session?" confirmation if any sets are logged)
- Session title (from `program_days.focus`)
- Timer (auto-starts when page loads, shows elapsed time in MM:SS)

**Exercise list (scrollable):**

Each exercise is a card (`surface-raised`, `rounded-lg`, `p-lg`, `mb-md`):

- **Exercise name** (`text-heading`, `text-text-primary`)
- **Coaching cue** (`text-caption`, `text-text-secondary`, italic) -- from `exercise_library.coaching_cue`
- **Prescribed** line: "4 x 6-8 @ RPE 7" (from `prescribed_sets`, `prescribed_reps`, `prescribed_rpe`)
- **Set checkboxes:** One row per prescribed set. Each row shows:
  - Set number ("Set 1", "Set 2", etc.)
  - Checkbox (44x44 touch target). Tap to mark complete. Completed sets show orange-500 checkmark.
  - "Add details" text button (appears on the right of each set row)

**Tier 2 expand (per set):** When "Add details" is tapped, a row expands below that set showing:
- Weight input (numeric) + unit toggle (lb/kg/bodyweight/band) -- pre-fill from the user's last logged weight for this exercise
- Reps input (numeric)
- RPE pills: Easy (5) / Moderate (7) / Hard (9)

**Skip exercise:** Swipe left on the exercise card or tap a "Skip" text button. The exercise grays out and `completed_sets` is set to 0.

**Bottom area (sticky):**
- Progress bar showing completed sets / total sets across all exercises
- "Finish Workout" button (PrimaryButton). Enabled once at least one set is checked.

### Data model on save

When the user taps "Finish Workout":

1. Create a `workout_sessions` row:
   ```typescript
   {
     user_id: userId,
     template_day_id: planDayId, // from query param
     session_date: new Date().toISOString().split("T")[0],
     title: programDay.focus, // e.g., "Lower Body Strength + Hip Power"
     focus: programDay.session_type, // e.g., "strength"
     start_time: sessionStartTime, // captured when page loaded
     end_time: new Date().toISOString(),
     duration_minutes: Math.round((Date.now() - startTime) / 60000),
     perceived_performance: null, // could add a completion screen rating later
     energy_level: null,
     notes: null
   }
   ```

2. For each exercise, create a `workout_session_exercises` row:
   ```typescript
   {
     user_id: userId,
     workout_session_id: sessionId, // from step 1
     exercise_id: exercise.exercise_id,
     exercise_order: exercise.exercise_order,
     planned_sets: exercise.prescribed_sets,
     completed_sets: completedSetCount, // number of checked sets
     pain_during: null, // Tier 3
     notes: null
   }
   ```

3. For each completed set (checkbox checked), create an `exercise_sets` row:
   ```typescript
   {
     user_id: userId,
     workout_session_exercise_id: sessionExerciseId, // from step 2
     set_number: setIndex + 1,
     weight: enteredWeight || null, // Tier 2
     weight_unit: selectedUnit || "lb", // Tier 2
     reps: enteredReps || null, // Tier 2
     rpe: selectedRpe || null, // Tier 2
     completed: true,
     pain_score: null // Tier 3
   }
   ```

4. For skipped sets (checkbox not checked), create `exercise_sets` rows with `completed: false` and no other data.

### Completion screen

After saving, show a brief completion screen:
- "Nice work" heading
- Summary: X exercises, Y sets completed, duration
- "Back to Dashboard" button

### Weight pre-fill logic

For each exercise, query the user's most recent logged weight for that exercise:

```typescript
const { data: lastSet } = await supabase
  .from("exercise_sets")
  .select("weight, weight_unit")
  .eq("user_id", userId)
  .eq("completed", true)
  .not("weight", "is", null)
  .order("created_at", { ascending: false })
  .limit(1);
```

This query needs to be scoped to the specific exercise. Join through `workout_session_exercises`:

```typescript
const { data: lastSet } = await supabase
  .from("exercise_sets")
  .select("weight, weight_unit, workout_session_exercise:workout_session_exercises!inner(exercise_id)")
  .eq("workout_session_exercise.exercise_id", exerciseId)
  .eq("user_id", userId)
  .eq("completed", true)
  .not("weight", "is", null)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

Pre-fill the weight and unit fields with this data. If no previous data exists, leave fields empty.

## 4. Custom Workout Flow

When the user navigates to `/log/workout?custom=true`, show a different flow:

### Screen 1: Name your session

- Text input with placeholder: "e.g., Upper body push, Pickup game warmup"
- Optional (defaults to "Custom Workout" + today's date)
- "Next" button

### Screen 2: Add exercises

Two ways to add:

**Search library:** Search bar at top. Query `exercise_library` where `owner_user_id IS NULL OR owner_user_id = userId`. Fuzzy match on `exercise_name`. Show results as tappable list items. Tapping adds the exercise to the session.

**Type it in:** Below search results, show "Can't find it? Add a custom exercise" link. Tapping opens a text input. On submit, creates a new `exercise_library` row:
```typescript
{
  owner_user_id: userId,
  exercise_name: enteredName,
  category: "strength", // default; user can't set this in MVP
  primary_muscles: [],
  secondary_muscles: [],
  equipment: []
}
```

The added exercise appears in the session exercise list.

**Exercise list:** Shows exercises added so far with drag handles for reordering (or up/down arrows for simplicity). Each has an "X" to remove.

"Start Workout" button when at least 1 exercise is added.

### Screen 3: Log sets

Same session player UI as the planned session player, but:
- `template_day_id` is null (custom workout)
- Default to 3 sets per exercise (since there's no prescribed_sets)
- User can tap "+" to add more sets or "-" to remove

### Save

Same data model as planned sessions, but with `template_day_id: null` and `title` from the user's input.

## 5. State management approach

Use React state for the session in progress. Do NOT use localStorage (not supported in this environment).

Key state:
```typescript
type SessionState = {
  exercises: {
    exerciseId: string;
    exerciseName: string;
    coachingCue: string | null;
    prescribedSets: number;
    prescribedReps: string | null;
    prescribedRpe: number | null;
    sets: {
      completed: boolean;
      weight: number | null;
      weightUnit: string;
      reps: number | null;
      rpe: number | null;
    }[];
    skipped: boolean;
  }[];
  startTime: Date;
};
```

Initialize from the program_day_exercises query. Update in-place as the user interacts.

## Acceptance criteria

- Plan generator produces correct output for Taylor's schedule (Wed + Sat games): Sun=Recovery, Mon=Strength, Tue=Fundamentals/light, Wed=Game, Thu=Strength (override), Fri=Light, Sat=Game
- Plan is saved to `program_templates` + `program_days` + `program_day_exercises` when onboarding completes
- Dashboard shows today's planned session with correct title, duration, and exercise count
- Tapping "Start Session" opens the session player with exercises pre-loaded
- User can check off sets (Tier 1) and save the session in under 60 seconds for a simple workout
- Tier 2 expand shows weight/reps/RPE fields; weight pre-fills from last logged value
- Custom workout flow: user can search library, add exercises, and log sets
- Custom workout saves with `template_day_id = null`
- Typing a new exercise name creates a user-owned `exercise_library` row
- No TypeScript errors
- All Supabase queries use the correct column names (see CLAUDE.md schema section)
