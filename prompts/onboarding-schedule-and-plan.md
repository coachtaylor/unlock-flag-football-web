# Prompt: Add Onboarding Screen 3 (Schedule) + Rebuild Screen 4 (Plan Preview)

Read `CLAUDE.md` in this repo for full project context, design tokens, and component patterns.

The onboarding flow at `src/app/onboarding/page.tsx` currently has 3 screens (steps 0, 1, 2). This prompt adds a new Screen 3 (schedule capture) and transforms the existing Screen 3 into Screen 4 (plan preview with generated weekly plan).

## Overview of changes

The onboarding goes from 3 screens to 4 screens:
- Step 0: Welcome (unchanged)
- Step 1: Profile + Goals (unchanged)
- Step 2: **Your Schedule** (NEW)
- Step 3: **Your Plan** (REBUILT -- currently step 2's YourPlanScreen)

## 1. Database migration

Run this in the Supabase SQL Editor BEFORE testing:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_schedule jsonb;
```

## 2. Update ProfileDraft type and state

Add `weekly_schedule` to the `ProfileDraft` type:

```typescript
type DayStatus = "open" | "game" | "practice";

type WeeklySchedule = {
  sunday: DayStatus;
  monday: DayStatus;
  tuesday: DayStatus;
  wednesday: DayStatus;
  thursday: DayStatus;
  friday: DayStatus;
  saturday: DayStatus;
};

type ProfileDraft = {
  display_name: string;
  primary_position: string;
  format_preference: Format | "";
  improvement_goals: string[];
  weekly_schedule: WeeklySchedule;
};
```

Default schedule (all open):

```typescript
const DEFAULT_SCHEDULE: WeeklySchedule = {
  sunday: "open",
  monday: "open",
  tuesday: "open",
  wednesday: "open",
  thursday: "open",
  friday: "open",
  saturday: "open",
};

const EMPTY_DRAFT: ProfileDraft = {
  display_name: "",
  primary_position: "QB",
  format_preference: "",
  improvement_goals: [],
  weekly_schedule: DEFAULT_SCHEDULE,
};
```

## 3. Update the useEffect that loads existing profile data

Add `weekly_schedule` to the select query:

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select(
    "display_name, primary_position, format_preference, improvement_goals, weekly_schedule, onboarding_step, onboarding_completed_at"
  )
  .eq("id", id)
  .maybeSingle();
```

When loading the draft, parse `weekly_schedule`:

```typescript
weekly_schedule: (profile.weekly_schedule as WeeklySchedule) ?? DEFAULT_SCHEDULE,
```

## 4. Update the persist function

Add `weekly_schedule` to the upsert payload:

```typescript
const payload: Record<string, unknown> = {
  id: userId,
  display_name: draft.display_name.trim() || null,
  primary_position: draft.primary_position || "QB",
  format_preference: draft.format_preference || null,
  improvement_goals: draft.improvement_goals.length > 0 ? draft.improvement_goals : null,
  weekly_schedule: draft.weekly_schedule,
  onboarding_step: nextStep,
};
```

## 5. Update step navigation

The flow now has 4 steps (0-3). Update:

- `ProgressDots` total from 3 to 4
- `goNext` max from 2 to 3: `const nextStep = Math.min(step + 1, 3);`
- `completeOnboarding` uses step 3: `const ok = await persist(3, true);`

Update the render section:

```tsx
<ProgressDots current={step} total={4} />

{step === 0 && <WelcomeScreen onNext={goNext} saving={saving} />}
{step === 1 && (
  <ProfileScreen
    draft={draft}
    setDraft={setDraft}
    onNext={goNext}
    onBack={goBack}
    saving={saving}
  />
)}
{step === 2 && (
  <ScheduleScreen
    schedule={draft.weekly_schedule}
    setSchedule={(s) => setDraft({ ...draft, weekly_schedule: s })}
    onNext={goNext}
    onBack={goBack}
    saving={saving}
  />
)}
{step === 3 && (
  <YourPlanScreen
    goals={draft.improvement_goals}
    schedule={draft.weekly_schedule}
    onComplete={completeOnboarding}
    onBack={goBack}
    saving={saving}
  />
)}
```

## 6. Build the ScheduleScreen component

New component: `ScheduleScreen`. This is where the user tells us which days they have games or practices.

**Header:** "What does your week look like?"

**Subtext:** "Tap each day to mark games or practices. We'll build your training around them."

**UI:** Display 7 day buttons in a vertical list or 2-column grid. Each day shows:
- Day name (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
- Current status label ("Open", "Game", "Practice")

Each button cycles through states on tap: open > game > practice > open.

**Styling per state:**
- **Open:** `surface-base` background, `border-subtle` solid border, `text-secondary` label
- **Game:** `surface-base` background, `orange-500` solid border (2px), orange-400 "Game" label text
- **Practice:** `surface-base` background, `blue-400` solid border (2px), blue-400 "Practice" label text

Use 44px minimum height for each day button. `rounded-lg`, `p-md`.

**Validation:** The "Continue" button is disabled if no day is marked as game or practice. Show helper text below the grid when all days are open: "Mark at least one game or practice day."

**Day order:** Start with Sunday (consistent with the `WeeklySchedule` type). The days array is: `["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]`.

**Cycle function:**

```typescript
function cycleDayStatus(current: DayStatus): DayStatus {
  if (current === "open") return "game";
  if (current === "game") return "practice";
  return "open";
}
```

Props: `schedule`, `setSchedule`, `onNext`, `onBack`, `saving`.

## 7. Rebuild the YourPlanScreen component

The current `YourPlanScreen` shows goal-based info cards. Replace it with a plan preview that shows the generated 7-day schedule.

**New props:** Add `schedule: WeeklySchedule` alongside the existing `goals`.

**Plan generation:** Import and call the plan generation function (built separately in `src/lib/plan-generator.ts`). For now, if that file does not exist yet, inline a simplified version that:

1. Marks game/practice days as locked
2. Assigns session categories to open days based on goals and the intensity rules

Use `useMemo` to generate the plan from goals + schedule so it only recalculates when inputs change.

**Display:** Show a 7-day list. Each day is a card showing:
- Day name (full: Sunday, Monday, etc.)
- Session label (e.g., "Lower Body Strength", "Game Day", "Recovery + Mobility")
- Estimated duration (e.g., "~65 min") for training days; omit for game/practice days

**Card accent colors by session category:**
- strength_lower: left border `--color-green-400`
- strength_upper: left border `--color-green-400`
- conditioning: left border `--color-orange-400`
- fundamentals: left border `--color-indigo-400`
- recovery: left border `--color-blue-400`
- football_iq: left border `--color-indigo-400`
- game: left border `--color-orange-500`
- practice: left border `--color-blue-400`

Each card uses `surface-base` background, `rounded-lg`, `p-md`, with a 3px left border in the accent color.

**Header:** "Here's your plan"

**Subtext:** "Based on your goals and schedule. You can adjust this later."

**CTA:** "Let's go" button. On tap:
1. Calls `onComplete()` which calls `persist(3, true)` to save the profile with `onboarding_completed_at`
2. Redirects to dashboard

**Note on integration with Phase 2a:** This screen uses the inline `generatePlanPreview` function (Section 8 below) to show the preview. The actual creation of `program_templates`, `program_days`, and `program_day_exercises` rows in Supabase is handled by a separate plan generation module (`src/lib/plan-generator.ts`, built in the Phase 2a prompt). For this prompt, just show the preview using the inline function. When the Phase 2a prompt is built, it will add a `savePlanToDatabase` call inside `completeOnboarding()` that writes the real rows.

## 8. Simplified inline plan generator (temporary)

Until the full `src/lib/plan-generator.ts` is built, use this inline logic in YourPlanScreen:

```typescript
type SessionCategory = "strength_lower" | "strength_upper" | "conditioning" | "fundamentals" | "recovery" | "football_iq" | "game" | "practice";

type DayPlan = {
  dayNumber: number; // 1=Sunday, 2=Monday, ... 7=Saturday
  day: string; // "Sunday", "Monday", etc.
  category: SessionCategory;
  label: string; // Display name
  sessionType: string; // Maps to program_days.session_type
  duration: number | null; // minutes, null for game/practice
};

function generatePlanPreview(schedule: WeeklySchedule, goals: string[]): DayPlan[] {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const makePlan = (i: number, category: SessionCategory, label: string, sessionType: string, duration: number | null): DayPlan => ({
    dayNumber: i + 1, day: dayNames[i], category, label, sessionType, duration,
  });

  // Step 1: Lock game/practice days, default open days to recovery
  const plan: DayPlan[] = days.map((day, i) => {
    if (schedule[day] === "game") return makePlan(i, "game", "Game Day", "game", null);
    if (schedule[day] === "practice") return makePlan(i, "practice", "Practice Day", "throwing", null);
    return makePlan(i, "recovery", "Recovery + Mobility", "recovery", 35);
  });

  // Step 2: Identify open day indexes
  const openIndexes = days.map((d, i) => schedule[d] === "open" ? i : -1).filter(i => i >= 0);

  // Step 3: Identify days before/after games
  const gameIndexes = days.map((d, i) => schedule[d] === "game" ? i : -1).filter(i => i >= 0);
  const dayBeforeGame = new Set(gameIndexes.map(i => (i - 1 + 7) % 7));
  const dayAfterGame = new Set(gameIndexes.map(i => (i + 1) % 7));

  // Step 4: Assign sessions to open days
  const hasGoal = (g: string) => goals.includes(g);
  let strengthCount = 0;
  let conditioningDone = false;
  let fundamentalsDone = false;
  let iqDone = false;

  for (const idx of openIndexes) {
    // Day after game = recovery (Rule 3)
    if (dayAfterGame.has(idx)) {
      plan[idx] = makePlan(idx, "recovery", "Recovery + Mobility", "recovery", 35);
      continue;
    }

    // Day before game = light (Rule 2)
    if (dayBeforeGame.has(idx)) {
      if (hasGoal("Football IQ") && !iqDone) {
        plan[idx] = makePlan(idx, "football_iq", "Football IQ", "study", 30);
        iqDone = true;
      } else if (hasGoal("Throwing Mechanics") && !fundamentalsDone) {
        plan[idx] = makePlan(idx, "fundamentals", "Fundamentals + Mechanics", "throwing_mechanics", 45);
        fundamentalsDone = true;
      } else {
        plan[idx] = makePlan(idx, "recovery", "Recovery + Mobility", "recovery", 35);
      }
      continue;
    }

    // Open day, not adjacent to game: assign hard sessions
    if (hasGoal("Strength") && strengthCount < 2) {
      if (strengthCount === 0) {
        plan[idx] = makePlan(idx, "strength_lower", "Lower Body Strength + Hip Power", "strength", 70);
      } else {
        plan[idx] = makePlan(idx, "strength_upper", "Upper Body Strength + Arm Care", "strength", 65);
      }
      strengthCount++;
      continue;
    }

    if (hasGoal("Conditioning") && !conditioningDone) {
      plan[idx] = makePlan(idx, "conditioning", "Conditioning + Agility", "speed", 55);
      conditioningDone = true;
      continue;
    }

    if (hasGoal("Throwing Mechanics") && !fundamentalsDone) {
      plan[idx] = makePlan(idx, "fundamentals", "Fundamentals + Mechanics", "throwing_mechanics", 45);
      fundamentalsDone = true;
      continue;
    }

    if (hasGoal("Football IQ") && !iqDone) {
      plan[idx] = makePlan(idx, "football_iq", "Football IQ", "study", 30);
      iqDone = true;
      continue;
    }

    // Fallback: recovery
    plan[idx] = makePlan(idx, "recovery", "Recovery + Mobility", "recovery", 35);
  }

  return plan;
}
```

This is a simplified version. The full plan generator (Phase 2a) will handle the Thursday override edge case, consecutive-hard-day checks, and exercise assignment. This inline version is good enough for the preview screen.

## 9. Remove dead code

The old `YourPlanScreen` that only showed goal-based info cards is replaced by the new version. No other dead code to remove at this stage.

## Acceptance criteria

- Screen 2 (Profile + Goals) still works as before
- Screen 3 (Schedule) shows 7 day buttons that cycle through Open/Game/Practice on tap
- Continue button is disabled until at least one day is marked Game or Practice
- Screen 4 (Plan Preview) shows a 7-day plan with session assignments based on goals + schedule
- Each day card has the correct accent color for its session category
- Game/practice days show as locked (no duration, just "Game Day" / "Practice Day")
- "Let's go" button saves profile with `weekly_schedule` and `onboarding_completed_at`, then redirects to `/`
- Progress dots show 4 dots instead of 3
- Back button works on all screens
- Existing functionality (loading state, error handling, draft persistence) still works
- No TypeScript errors
