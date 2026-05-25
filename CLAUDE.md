# Unlock Flag Football — Engineering Implementation Guide

You are building a mobile-first PWA for flag football QBs to track their development. The app is called Unlock Flag Football and lives at unlockflagfootball.com.

## Project Context

This is a Next.js 16 project using the App Router, Tailwind CSS v4, and Supabase (PostgreSQL + Auth + RLS). The app is dark-mode-first, mobile-first, and designed for fast data entry on the sideline after games.

The project structure is already scaffolded with all routes, a bottom navigation bar, Supabase client utilities, and placeholder pages. Your job is to build out each screen with real functionality.

## Tech Stack

- Next.js 16 (App Router, `src/` directory)
- Tailwind CSS v4 (tokens defined in `src/app/globals.css` via `@theme inline`)
- Supabase (`@supabase/supabase-js` + `@supabase/ssr`)
- TypeScript (strict mode)
- Deployed to Vercel

## Project Structure

```
unlock-app/
  src/
    app/
      layout.tsx          # App shell: dark bg, bottom nav, PWA metadata
      globals.css         # ALL design tokens (colors, type, spacing, radius)
      page.tsx            # / — Dashboard (home for returning users)
      log/
        page.tsx          # /log — Hub: pick what to log
        workout/page.tsx  # /log/workout — Multi-screen workout logging
        throwing/page.tsx # /log/throwing — Throwing session + elbow pain
        game-recap/page.tsx # /log/game-recap — 5-screen post-game flow
        recovery/page.tsx # /log/recovery — Weekly recovery check-in
      progress/page.tsx   # /progress — Charts and trends
      library/
        page.tsx          # /library — Hub: routes, coverages, concepts
        routes/page.tsx   # /library/routes — 10 pre-seeded routes
        coverages/page.tsx # /library/coverages — 6 defensive looks
        concepts/page.tsx # /library/concepts — 6 play concepts
      onboarding/page.tsx # /onboarding — 3-screen first-time flow
      settings/page.tsx   # /settings — Profile, theme, account
    components/
      BottomNav.tsx       # 4-tab nav: Dashboard, Log, Progress, Library
    lib/
      supabase/
        client.ts         # Browser-side Supabase client (use in "use client" components)
        server.ts         # Server-side Supabase client (use in Server Components)
  public/
    manifest.json         # PWA manifest
  .env.local              # NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Design System Quick Reference

All tokens are in `globals.css`. Here is how to use them:

### Colors (use as Tailwind classes or CSS variables)

**Orange (interactive, CTAs, selected states):**
`bg-orange-500` for primary buttons, `text-orange-400` for active nav/labels, `border-orange-500` for selected tags.

**Green (positive signals, insights):**
`bg-green-800` for insight card backgrounds, `text-green-400` for positive icons/text.

**Blue (data, charts):**
`bg-blue-800` for chart backgrounds, `text-blue-400` for data labels.

**Indigo (education, study, football IQ):**
`bg-indigo-800` for study card backgrounds, `text-indigo-400` for education labels.

**Surfaces:**
`bg-surface-base` (#0D1117) for app background, `bg-surface-raised` (#161C24) for cards, `bg-surface-overlay` (#1E2530) for modals.

**Text:**
`text-text-primary` for headings/body, `text-text-secondary` for subtitles, `text-text-muted` for placeholders.

**Borders:**
`border-border-subtle` for dividers, `border-border-default` for inputs, `border-border-strong` for focus.

### Typography

Use these as classes: `text-title`, `text-heading`, `text-body`, `text-caption`, `text-stat`, `text-display`, `text-micro`.

Only two font weights: `font-normal` (400) and `font-medium` (500). Never use bold/semibold/700.

### Spacing

`p-xs` (4px), `p-sm` (8px), `p-md` (12px), `p-lg` (16px), `p-xl` (20px), `p-2xl` (24px), `p-3xl` (32px). Same for `m-`, `gap-`, etc.

### Border Radius

`rounded-sm` (6px), `rounded-md` (8px), `rounded-lg` (12px), `rounded-xl` (14px), `rounded-pill` (20px), `rounded-full` (9999px).

### Key CSS Classes

`.label-micro` — 11px uppercase section labels with letter-spacing (defined in globals.css).
`.tabular-nums` — Tabular figures for stat numbers that don't jump.

## Component Patterns

### Tag/Chip (used in game recap struggle tags, filters)

```tsx
// Unselected
<button
  className="px-[14px] py-[8px] rounded-pill text-caption font-medium transition-all"
  style={{
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.45)',
    border: '1px solid rgba(255,255,255,0.08)',
  }}
>
  Reading coverage
</button>

// Selected (all tags use orange, never color-code by category)
<button
  className="px-[14px] py-[8px] rounded-pill text-caption font-medium transition-all"
  style={{
    backgroundColor: '#5C3308',
    color: '#F0B870',
    border: '1px solid #D48A30',
  }}
>
  Reading coverage
</button>
```

Minimum touch target: 44x44px. Use `aria-pressed="true/false"` for accessibility.

### Card Variants

**Surface card** (stat cards, input containers): `bg-surface-raised`, no border, `rounded-lg`, `p-lg`.

**Outlined card** (list items, reference entries): `bg-surface-base`, `border border-border-subtle`, `rounded-lg`, `p-lg`.

**Accent card** (insights, patterns): Color-specific background (e.g., `bg-green-800` + `border border-green-600`), `rounded-lg`, `p-lg`.

### Primary Button

```tsx
<button
  className="w-full py-lg rounded-xl text-body font-medium tracking-wide"
  style={{ backgroundColor: '#D48A30', color: '#FFFFFF', letterSpacing: '0.3px' }}
>
  Save Workout
</button>
```

Height: 52px. Full-width in logging flows. Active state: scale 0.98, brightness -5%.

### Slider

Track height 4px, thumb 24px circle in orange-500. Filled portion orange-500, unfilled border-subtle. Display value right-aligned in text-heading or text-stat.

## Supabase Database Schema

The database has 28 tables. Here are the ones you will interact with most:

### workout_sessions
```sql
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_day_id UUID REFERENCES program_days(id) ON DELETE SET NULL, -- links to planned session (null for custom/ad-hoc)
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  focus TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  perceived_performance INTEGER CHECK (perceived_performance BETWEEN 1 AND 10),
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### workout_session_exercises
```sql
CREATE TABLE workout_session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercise_library(id),
  exercise_order INTEGER NOT NULL,
  planned_sets NUMERIC(4,1),
  completed_sets NUMERIC(4,1),
  pain_during INTEGER CHECK (pain_during BETWEEN 0 AND 10),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### exercise_sets
```sql
CREATE TABLE exercise_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_session_exercise_id UUID NOT NULL REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  weight NUMERIC(8,2),
  weight_unit TEXT NOT NULL DEFAULT 'lb' CHECK (weight_unit IN ('lb','kg','bodyweight','band')),
  reps INTEGER CHECK (reps >= 0),
  duration_seconds INTEGER CHECK (duration_seconds >= 0),
  distance_yards NUMERIC(8,2),
  rpe NUMERIC(3,1) CHECK (rpe BETWEEN 1 AND 10),
  velocity_quality INTEGER CHECK (velocity_quality BETWEEN 1 AND 10),
  completed BOOLEAN NOT NULL DEFAULT true,
  pain_score INTEGER CHECK (pain_score BETWEEN 0 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workout_session_exercise_id, set_number)
);
```

### exercise_library (pre-seeded with 48 exercises)
```sql
CREATE TABLE exercise_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null = global, set = user-created
  exercise_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'mobility', 'strength', 'power', 'speed', 'arm_care', 'throwing_mechanics', 'conditioning', 'recovery'
  sub_category TEXT,
  movement_pattern TEXT, -- 'squat', 'hinge', 'push', 'pull', 'carry', 'rotation', 'sprint', etc.
  primary_muscles TEXT[] DEFAULT '{}',
  secondary_muscles TEXT[] DEFAULT '{}',
  equipment TEXT[] DEFAULT '{}',
  qb_transfer TEXT,
  tags TEXT[] DEFAULT '{}',
  default_sets NUMERIC(4,1),
  default_reps TEXT, -- text because some are '8/side' or '20-30 sec/side'
  default_duration_seconds INTEGER,
  default_rpe NUMERIC(3,1) CHECK (default_rpe BETWEEN 1 AND 10),
  progression TEXT,
  regression TEXT,
  pain_rule TEXT,
  coaching_cue TEXT,
  phase TEXT,
  recommended_frequency TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Global exercises: owner_user_id IS NULL (unique on lower(exercise_name))
-- User exercises: owner_user_id IS NOT NULL (unique per user on lower(exercise_name))
```

### throwing_sessions
```sql
CREATE TABLE throwing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT DEFAULT 'Throwing Session',
  location TEXT,
  pre_throw_elbow_pain INTEGER CHECK (pre_throw_elbow_pain BETWEEN 0 AND 10),
  post_throw_elbow_pain INTEGER CHECK (post_throw_elbow_pain BETWEEN 0 AND 10),
  next_morning_elbow_pain INTEGER CHECK (next_morning_elbow_pain BETWEEN 0 AND 10),
  shoulder_pain INTEGER CHECK (shoulder_pain BETWEEN 0 AND 10),
  total_throws INTEGER CHECK (total_throws >= 0),
  max_intensity_percent INTEGER CHECK (max_intensity_percent BETWEEN 0 AND 100),
  average_intensity_percent INTEGER CHECK (average_intensity_percent BETWEEN 0 AND 100),
  mechanics_quality INTEGER CHECK (mechanics_quality BETWEEN 1 AND 10),
  hip_use_quality INTEGER CHECK (hip_use_quality BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### game_practice_logs
```sql
CREATE TABLE game_practice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type TEXT NOT NULL CHECK (session_type IN ('game','practice')),
  league_team TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('5v5','7v7')),
  performance_rating INTEGER CHECK (performance_rating BETWEEN 1 AND 10),
  what_went_well TEXT,
  struggles TEXT,
  struggle_tags TEXT[] DEFAULT '{}',
  arm_feel INTEGER CHECK (arm_feel BETWEEN 1 AND 10),
  legs_mobility_feel INTEGER CHECK (legs_mobility_feel BETWEEN 1 AND 10),
  overall_energy INTEGER CHECK (overall_energy BETWEEN 1 AND 10),
  weekly_focus_action TEXT,
  completions INTEGER,
  attempts INTEGER,
  touchdowns INTEGER,
  interceptions INTEGER,
  opponent TEXT,
  defensive_looks_seen TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
-- GIN index for fast tag queries:
-- CREATE INDEX idx_game_practice_logs_struggle_tags ON game_practice_logs USING GIN(struggle_tags);
```

### recovery_logs
```sql
CREATE TABLE recovery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours NUMERIC(4,2) CHECK (sleep_hours BETWEEN 0 AND 24),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
  stress INTEGER CHECK (stress BETWEEN 1 AND 10),
  soreness INTEGER CHECK (soreness BETWEEN 1 AND 10),
  hydration INTEGER CHECK (hydration BETWEEN 1 AND 10),
  nutrition_quality INTEGER CHECK (nutrition_quality BETWEEN 1 AND 10),
  mood_energy INTEGER CHECK (mood_energy BETWEEN 1 AND 10),
  elbow_pain_rest INTEGER CHECK (elbow_pain_rest BETWEEN 0 AND 10),
  shoulder_pain INTEGER CHECK (shoulder_pain BETWEEN 0 AND 10),
  hip_mobility_feel INTEGER CHECK (hip_mobility_feel BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, log_date)
);
```

### profiles (onboarding + schedule)
```sql
-- Key columns (not the full table, see 01_schema.sql + 05_profile_onboarding.sql for all):
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT,
  primary_position TEXT DEFAULT 'QB',
  format_preference TEXT CHECK (format_preference IN ('5v5','7v7','both')),
  improvement_goals TEXT[], -- ['Strength', 'Mobility', 'Throwing Mechanics', 'Pain Management', 'Football IQ', 'Conditioning']
  weekly_schedule JSONB, -- {"sunday":"open","monday":"open",...,"saturday":"game"} values: 'open'|'game'|'practice'
  onboarding_step INTEGER DEFAULT 0,
  onboarding_completed_at TIMESTAMPTZ
```

### program_templates (user's active training plan)
```sql
CREATE TABLE program_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null = global seed, set = user's plan
  template_name TEXT NOT NULL,
  sport TEXT DEFAULT 'flag_football',
  position TEXT DEFAULT 'QB',
  goal TEXT,
  description TEXT,
  total_weeks INTEGER DEFAULT 8,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### program_days (7 days of a weekly plan)
```sql
CREATE TABLE program_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  day_name TEXT NOT NULL, -- 'Monday', 'Tuesday', etc.
  focus TEXT NOT NULL, -- 'Lower Body Strength + Hip Power', 'Recovery + Mobility', etc.
  session_type TEXT NOT NULL, -- 'strength', 'mobility', 'speed', 'power', 'throwing', 'recovery', 'game', 'study'
  estimated_minutes INTEGER,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (template_id, day_number)
);
```

### program_day_exercises (exercises mapped to each day)
```sql
CREATE TABLE program_day_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_day_id UUID NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercise_library(id),
  exercise_order INTEGER NOT NULL,
  prescribed_sets NUMERIC(4,1),
  prescribed_reps TEXT, -- text because some are '8/side'
  prescribed_duration_seconds INTEGER,
  prescribed_rpe NUMERIC(3,1) CHECK (prescribed_rpe BETWEEN 1 AND 10),
  rest_seconds INTEGER,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (program_day_id, exercise_order)
);
```

### Reference tables (pre-seeded)

**route_library** (10 routes): id, owner_user_id, route_name, route_family, depth_yards, timing, break_type, leverage_rules, best_vs_coverages (text[]), coaching_points, tags (text[])

**defensive_looks** (6 coverages): id, owner_user_id, coverage_name, coverage_family, shell, personnel_clues, pre_snap_indicators, post_snap_indicators, strengths, weaknesses, how_to_attack, flag_football_notes, tags (text[])

**play_concepts** (6 concepts): id, owner_user_id, concept_name, concept_family, route_combo, primary_read, secondary_read, outlet_read, progression, best_vs_coverages (text[]), alert_rules, notes, tags (text[])

All reference tables use `owner_user_id` (null = global/pre-seeded, set = user-created). No `is_global` column.

### Dashboard Views (pre-built in Supabase)

```sql
-- Weekly training summary (workouts, throws, games, pain)
SELECT * FROM vw_weekly_training_summary WHERE user_id = $1 ORDER BY week_start DESC LIMIT 1;

-- Focus recommendations (auto-generated from struggle tags + training gaps)
SELECT * FROM vw_focus_recommendations WHERE user_id = $1;

-- QB performance dashboard (composite development score)
SELECT * FROM vw_qb_performance_dashboard WHERE user_id = $1 ORDER BY week_start DESC LIMIT 1;

-- Struggle tag frequency (for pattern detection)
SELECT * FROM vw_struggle_tag_frequency WHERE user_id = $1;

-- Game performance by week and format
SELECT * FROM vw_game_performance_weekly WHERE user_id = $1 ORDER BY week_start DESC LIMIT 8;

-- Exercise progress (per-exercise strength trends)
SELECT * FROM vw_exercise_progress WHERE user_id = $1;

-- Muscle group weekly focus
SELECT * FROM vw_muscle_focus_weekly WHERE user_id = $1 ORDER BY week_start DESC LIMIT 1;
```

All tables have RLS policies: `user_id = auth.uid()`. Users can only read/write their own data. Reference tables where `owner_user_id IS NULL` (global/pre-seeded) are readable by everyone.

## Build Order

Build screens in this order. Each is a self-contained unit that can be tested independently.

**Build status (last updated 2026-04-30):**
- ✅ Phase 1a — Auth pages (`/login`, `/signup`) shipped
- ✅ Phase 1b — Auth middleware shipped (note: filename is `src/middleware.ts`; Next 16 deprecates this in favor of `src/proxy.ts` — rename when convenient)
- 🔶 Phase 1c — Onboarding: Screens 1-2 done (pills for improvement_goals shipped). Screen 3 (schedule capture) and Screen 4 (plan preview) not yet built. DB migration for `weekly_schedule` not yet run.
- ⏳ Phase 2a — Plan generation + session player (next up after 1c is complete). Old blank-slate workout logger prompt is INVALID. Use the plan generation spec.
- ⏳ Phase 2b-2d — Throwing, game recap, recovery logging (not started, prompts are valid)

### Phase 1: Auth + Onboarding (FIRST)

Build the Supabase auth flow before anything else, because every other screen depends on having a logged-in user.

**1a. Auth pages:** `/login` and `/signup` ✅ DONE
- Email + password form using Supabase Auth
- After signup, redirect to `/onboarding`
- After login, redirect to `/` (dashboard)
- Style: surface-raised card centered on surface-base background
- Implementation notes: card uses inline `width: 100%; maxWidth: 384px` instead of `w-full max-w-sm` Tailwind utilities (the utility classes weren't expanding inside the flex centering wrapper). `BottomNav.tsx` early-returns `null` on `/login` and `/signup` so the nav doesn't render on auth screens.
- Supabase setup required: Authentication → Providers → Email enabled. For local dev, "Confirm email" should be off, otherwise signup creates a user without a session and the `/onboarding` redirect bounces back to `/login`.

**1b. Auth middleware:** `src/middleware.ts` ✅ DONE
- Redirect unauthenticated users to `/login`
- Redirect authenticated users away from `/login` and `/signup`
- Allow `/onboarding` only for users without a profile record — NOT YET WIRED UP. Currently `/onboarding` is treated as any other authenticated route. Wire the profile check during 1c when the `profiles` table is in use.
- Next 16 deprecation: filename `middleware.ts` works but logs a warning. Rename to `proxy.ts` (and rename the exported `middleware` function to `proxy`) at some point.

**1c. Onboarding:** `/onboarding` (4 screens)
- Screen 1: Welcome message + "Get Started" button ✅
- Screen 2: Quick profile ✅ — `improvement_goals` as multi-select pills (Strength, Mobility, Throwing Mechanics, Pain Management, Football IQ, Conditioning) stored as `text[]`. Format preference as single-select pills (5v5/7v7/both).
- Screen 3: "Your Schedule" (NEW — NOT YET BUILT) — 7-day week picker. Each day cycles: Open > Game > Practice > Open on tap. Open = `surface-base` + `border-subtle`. Game = orange-500 accent border + "Game" label. Practice = blue-400 accent border + "Practice" label. Validates at least one game or practice day. Saves to `profiles.weekly_schedule` as JSONB: `{"sunday":"open","monday":"open",...}`.
- Screen 4: "Your Plan" (NOT YET BUILT — replaces the old Screen 3) — Runs plan generation logic against schedule + goals. Shows a 7-day plan preview: each day displays session name, duration, and accent color by category. Game/practice days shown as locked. Header: "Here's your plan". CTA: "Let's go" → creates user's `program_templates` + `program_days` + `program_day_exercises` rows, saves profile with `onboarding_completed_at` and `weekly_schedule`, redirects to `/`.
- DB migrations required:
  1. `improvement_goals` text → text[] (ALREADY RUN): `ALTER TABLE public.profiles ALTER COLUMN improvement_goals TYPE text[] USING CASE WHEN improvement_goals IS NOT NULL THEN ARRAY[improvement_goals] ELSE NULL END;`
  2. Add `weekly_schedule` JSONB column (NOT YET RUN): `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_schedule jsonb;`
- Full spec: see `docs/PLAN_GENERATION_SPEC.md`

### Phase 2: Logging Flows (CORE VALUE)

**2a. Plan generation + session player:** `/log/workout`

The app generates a personalized weekly training plan during onboarding and presents each day's session as a ready-to-go workout. Full spec: `docs/PLAN_GENERATION_SPEC.md`.

**Plan generation (runs at onboarding completion):**
- Rules-based function (NOT AI): takes `weekly_schedule` + `improvement_goals` as inputs
- Assigns a session category to each open day: Strength, Conditioning+Agility, Fundamentals, Recovery+Mobility, or Football IQ
- Intensity rules: no hard training day before game, recovery after game, no consecutive hard days
- Creates user's `program_templates` + `program_days` + `program_day_exercises` rows
- Exercise selection: clone exercises from the global seed template's matching session type
- Pure function in `src/lib/plan-generator.ts` (keep isolated from UI for future reuse by coach platform)

**Planned session player (primary workout experience):**
- Dashboard shows "Today: [Session Name]" card. Tap to start.
- Session screen shows exercises pre-loaded with prescribed sets/reps/coaching cues
- Tier 1 (required): tap checkbox per set to mark complete (~30 sec/exercise)
- Tier 2 (optional, behind "Add details"): weight, reps, RPE per set. RPE as pills: Easy/Moderate/Hard (maps to 5/7/9)
- Tier 3 (nice-to-have): pain score per exercise, notes
- Save creates: `workout_sessions` (with `template_day_id`) + `workout_session_exercises` + `exercise_sets`
- Weight pre-fills from last logged value for that exercise

**Custom workout fallback (secondary action on dashboard):**
- "Log a custom workout" link below the primary CTA
- User names the session, adds exercises from library search or types new ones
- Same tiered logging as planned sessions
- Save creates: `workout_sessions` (with `template_day_id = null`) + `workout_session_exercises` + `exercise_sets`
- New typed-in exercises create `exercise_library` rows with `owner_user_id` set

- Acceptance: plan generates correctly for Taylor's schedule (Wed+Sat games), session player saves with Tier 1 only, custom workout search < 200ms, weight pre-fills work

**2b. Throwing session:** `/log/throwing`
- Single screen with Tier 1 visible, Tier 2 expandable
- Tier 1: date, total throws, elbow pain after (0-10 slider)
- Tier 2: pain before, intensity (Low/Med/High pills), mechanics quality (Rough/Okay/Smooth/Locked In), hip-use quality (Forgot/Sometimes/Mostly/Every Throw)
- Pain slider anchors: 0=None, 3=Noticeable, 5=Moderate, 7=Significant, 10=Severe
- Save creates: throwing_sessions record
- Next-morning follow-up: in-app prompt next day to log `next_morning_elbow_pain`

**2c. Game recap:** `/log/game-recap` (5-screen flow)
- Pre-screen: session type (Game/Practice pills), format (5v5/7v7 pills), league/team (text, remembers last), date
- Screen 1: "How'd you play today?" — 1-10 slider
- Screen 2: "What went well?" — text area
- Screen 3: "What did you struggle with?" — text area + struggle tags (multi-select pills). Tags: Reading coverage, Route decisions, Telegraphing, Timing, Accuracy, Pocket awareness, Scramble decisions, Arm pain, Leadership, Communication, Conditioning
- Screen 4: "How does your body feel?" — 3 sliders: Arm/Elbow, Legs/Mobility, Overall Energy (1-10 each)
- Screen 5: "One thing to focus on this week" — text area + show last 2-3 focus entries below
- Save creates: game_practice_logs record
- Progress dots at bottom (8px circles, current=full, past=30%, future=20% opacity)
- Swipe left/right navigation between screens
- Save draft to localStorage if user closes mid-flow
- Acceptance: completes in under 3 minutes, all tags queryable, draft persistence works

**2d. Recovery check-in:** `/log/recovery`
- Single screen: sleep quality, stress, elbow pain at rest (three 1-10 sliders)
- Optional: notes text area
- Save creates: recovery_logs record
- Acceptance: completes in under 30 seconds

### Phase 3: Reference Libraries

**3a. Route library:** `/library/routes`
- List of outlined cards from `route_library` where `owner_user_id IS NULL OR owner_user_id = user_id`
- Each card: route_name, route_family tag, depth_yards
- Tap to expand: full details including best_vs_coverages (highlight this prominently)
- "Add Custom Route" button for user-created entries
- Search bar with fuzzy matching on route_name

**3b. Defensive coverages:** `/library/coverages`
- Same pattern from `defensive_looks` table (`owner_user_id IS NULL OR owner_user_id = user_id`)
- Organize by shell (1-high vs 2-high)
- "How to Attack" field should be visually prominent (this is the actionable payoff)

**3c. Play concepts:** `/library/concepts`
- Same pattern from `play_concepts` table (`owner_user_id IS NULL OR owner_user_id = user_id`)
- Show read progression clearly: primary_read > secondary_read > outlet_read
- best_vs_coverages prominently displayed

### Phase 4: Dashboard (THE PAYOFF)

Build this after logging flows work, because it needs real data to be meaningful.

**Dashboard sections (top to bottom):**
1. Header: "Hey [name]" + week date
2. Weekly focus card (green accent): auto-populated from last game recap's `weekly_focus_action`
3. Stat cards (2x2 grid): Workouts count, Throws count, Games count, Elbow pain avg. Each from `vw_weekly_training_summary`.
4. Focus recommendations: from `vw_focus_recommendations`. Show as cards with priority badges.
5. Locked insight cards: show when Tier 2 data is missing. Pattern: "Add [field] to unlock [insight]". Dashed border, muted text, orange nudge text.

**Dashboard states:**
- Loading: skeleton pulse animation
- Empty (new user): single "Get started" card
- Partial data: show available cards + locked insights for missing data
- Error: "Couldn't load your data. Tap to retry."

### Phase 5: Progress + Polish

**Progress page:** `/progress`
- Elbow pain vs throwing volume chart (line chart, two series)
- Game performance trend by format
- Muscle group balance
- Use Recharts library for charts

**Polish:**
- PWA install prompt
- Loading states on all screens
- Error handling with retry
- Mobile viewport testing (375px minimum)

## Design Rules (Follow These Strictly)

1. **Dark mode is the default.** Background is always `surface-base` (#0D1117). Cards are `surface-raised` (#161C24).

2. **Two font weights only.** `font-normal` (400) and `font-medium` (500). Never use bold, semibold, or 700.

3. **Color has one job per screen.** Orange = interactive/CTA. Green = positive/insights. Blue = data/charts. Indigo = education/study. Never use orange for data or green for buttons.

4. **All tags in a group use the same color.** Selected tags are always orange. Never color-code tags by category within a multi-select.

5. **"Locked insight" language pattern:** "Add [field] to unlock [insight]" not "You haven't logged [field]." Never guilt or warn about missing data.

6. **Touch targets: 44x44px minimum.** This is non-negotiable for mobile.

7. **Logging speed matters more than features.** If a screen takes longer than 60 seconds to complete, cut fields.

8. **No decorative animations.** Tag selection: 100ms scale. Button press: 100ms scale. Screen transitions: 200ms slide. That is the complete animation budget.

9. **Screen horizontal padding: 20px** (`px-xl`). Content is single-column on mobile.

10. **Tiered data entry:** Tier 1 fields are always visible. Tier 2 appears behind a single "Add details" tap. Tier 3 is buried deeper. Never make optional fields look required.

## Supabase Usage Patterns

### Reading data (Server Component)
```tsx
import { createClient } from '@/lib/supabase/server'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: summary } = await supabase
    .from('vw_weekly_training_summary')
    .select()
    .order('week_start', { ascending: false })
    .limit(1)
    .single()

  return <div>{summary?.workouts_logged} workouts this week</div>
}
```

### Writing data (Client Component with Server Action)
```tsx
// src/app/log/workout/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'

export async function saveWorkout(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('workout_sessions').insert({
    user_id: user.id,
    session_date: formData.get('date'),
    title: formData.get('title'),
    focus: formData.get('focus'),
    template_day_id: formData.get('template_day_id') || null,
    // ... etc
  })
  if (error) throw error
}
```

### Auth check in middleware
```tsx
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Create a Supabase client attached to the request cookies
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login (except login/signup pages)
  const publicPaths = ['/login', '/signup']
  if (!user && !publicPaths.includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-*).*)'],
}
```

## Dashboard View Schemas (columns returned)

These views are pre-built in Supabase. Here is what each returns so you know which columns to use in the UI:

### vw_weekly_training_summary
Returns one row per user per week. Key columns:
- `user_id`, `week_start` (date)
- `workout_sessions` (int), `workout_minutes` (int)
- `strength_sets` (int), `strength_reps` (int), `strength_volume` (numeric)
- `avg_lift_rpe` (numeric), `avg_lift_pain` (numeric)
- `total_throws` (int), `avg_throw_intensity` (numeric)
- `avg_elbow_pain_before` (numeric), `avg_elbow_pain_after` (numeric), `avg_next_morning_elbow_pain` (numeric)
- `avg_mechanics_quality` (numeric), `avg_hip_use_quality` (numeric)
- `games_played` (int), `practices_logged` (int)
- `avg_game_performance` (numeric), `avg_game_arm_feel` (numeric), `avg_game_legs_feel` (numeric), `avg_game_energy` (numeric)

### vw_focus_recommendations
Returns multiple rows per user per week, one per recommendation. Key columns:
- `user_id`, `week_start` (date)
- `focus_area` (text, e.g., "Throwing Volume", "Reading Coverage")
- `priority` ('high' | 'medium' | 'low')
- `recommendation` (text, human-readable recommendation)
- `data_basis` (text, what data triggered this)

### vw_game_performance_weekly
Returns one row per user per week per format. Key columns:
- `user_id`, `week_start` (date), `format` ('5v5' | '7v7')
- `games_played` (int), `practices_logged` (int)
- `avg_performance_rating` (numeric)
- `avg_arm_feel` (numeric), `avg_legs_mobility` (numeric), `avg_energy` (numeric)
- `completion_pct` (numeric, null if no attempts logged)
- `total_tds` (int), `total_ints` (int)

### vw_struggle_tag_frequency
Returns one row per tag per week per format. Key columns:
- `user_id`, `week_start` (date), `format` ('5v5' | '7v7')
- `tag_name` (text, e.g., "Reading coverage")
- `occurrences` (int)

### vw_qb_performance_dashboard
Returns one row per user per week. Key columns:
- `user_id`, `week_start` (date)
- `qb_development_score` (numeric, 0-100 composite)
- `physical_consistency_score` (numeric)
- `education_consistency_score` (numeric)
- `elbow_health_score` (numeric)
- `recovery_score` (numeric)
- `game_activity_score` (numeric)

### vw_muscle_focus_weekly
Returns one row per muscle group per week. Key columns:
- `user_id`, `week_start` (date)
- `muscle_name` (text)
- `completed_sets` (int), `reps` (int), `volume` (numeric), `avg_rpe` (numeric)

### vw_exercise_progress
Returns one row per exercise per week. Key columns:
- `user_id`, `week_start` (date)
- `exercise_name` (text)
- `sessions` (int), `sets` (int), `max_weight` (numeric), `avg_rpe` (numeric)

## What NOT To Build

- No social features, sharing, or team dashboards
- No push notifications (use in-app prompts only)
- No AI/ML recommendations (use simple threshold rules in dashboard views)
- No video, images, or media uploads
- No offline-first architecture (online required)
- No light mode toggle yet (dark mode only for now)
- No tackle football content (flag football only)
- No multi-position support (QB only)
