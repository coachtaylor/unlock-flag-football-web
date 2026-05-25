# Mobile App Build Plan: React Native (Expo)

Full port of the Unlock Flag Football coach MVP from Next.js to React Native with Expo. The Supabase backend stays exactly as-is. No schema changes, no migration changes. This is a frontend-only rebuild.

## Architecture Decisions

**Framework:** React Native with Expo SDK 52+ (managed workflow)
**Navigation:** Expo Router (file-based routing, same mental model as Next.js App Router)
**Styling:** NativeWind v4 (Tailwind CSS for React Native) — lets us reuse most of our Tailwind class names
**Auth:** Supabase Auth with `@supabase/supabase-js` + `expo-secure-store` for token persistence
**State:** React context (team context) + React hooks (same pattern as web app)
**Storage:** `expo-secure-store` for auth tokens, `@react-native-async-storage/async-storage` for preferences
**SVG:** `react-native-svg` for the diagram builder
**Icons:** `@expo/vector-icons` (Ionicons set)

## Project Structure

```
unlock-mobile/
  app/
    _layout.tsx              # Root layout: auth provider, team provider, tab nav
    (auth)/
      login.tsx
      signup.tsx
    (tabs)/
      _layout.tsx            # Bottom tab navigator (Dashboard, Drills, Roster, Practice)
      index.tsx              # Dashboard (home)
      drills/
        index.tsx            # Drill list
        new.tsx              # Create drill
        [id].tsx             # Drill detail
        [id]/edit.tsx        # Edit drill
      roster/
        index.tsx            # Roster list
        new.tsx              # Add player
        [id].tsx             # Player detail
        [id]/edit.tsx        # Edit player
      practice/
        index.tsx            # Practice plans list
        new.tsx              # Create practice plan
        [id].tsx             # Practice plan detail
        [id]/edit.tsx        # Edit practice plan
        [id]/log.tsx         # Post-practice logging
    benchmarks/
      index.tsx              # Benchmark hub (select drill + players)
      log.tsx                # Per-player benchmark logging
      complete.tsx           # Assessment complete
    team-setup.tsx           # Team creation (first-time flow)
  components/
    DiagramEditor.tsx        # Interactive SVG diagram (react-native-svg)
    DiagramRenderer.tsx      # Read-only SVG diagram
    ui/                      # Reusable UI primitives
      Card.tsx
      Button.tsx
      Tag.tsx
      Input.tsx
      TextArea.tsx
  lib/
    supabase.ts              # Single Supabase client (no server/client split needed in RN)
    team-context.tsx          # Team context provider (port directly)
    generate-setup-instructions.ts  # Pure function (port directly, no changes)
  types/
    diagram.ts               # DiagramData types (port directly, no changes)
    database.ts              # Supabase table types
  constants/
    design.ts                # Design tokens as JS objects (colors, spacing, typography)
  assets/                    # App icon, splash screen
  app.json                   # Expo config
  tailwind.config.ts         # NativeWind config with custom theme
```

## What Ports Directly (No Changes)

These files are pure TypeScript with no React DOM or Next.js dependencies:
- `types/diagram.ts` — copy as-is
- `lib/generate-setup-instructions.ts` — copy as-is
- All Supabase query logic (the actual `.from().select()` calls) — same API

## What Changes Significantly

- **Supabase client:** No server/client split. React Native uses a single client with `expo-secure-store` for token persistence instead of cookies.
- **Navigation:** Expo Router replaces Next.js App Router. File-based routing still, but different conventions.
- **Styling:** NativeWind maps most Tailwind classes, but some CSS (like `style={{}}` inline objects) need to become `StyleSheet.create()` or NativeWind classes.
- **SVG rendering:** `<svg>` becomes `<Svg>` from `react-native-svg`. All SVG elements change (`<circle>` → `<Circle>`, etc.).
- **Form inputs:** HTML `<input>`, `<textarea>`, `<select>` become React Native `<TextInput>`, `<Pressable>`, etc.
- **Server components don't exist:** All data fetching happens in `useEffect` or with a data-fetching hook. No server actions. Direct Supabase client calls.
- **Middleware doesn't exist:** Auth gating handled by Expo Router's layout redirects.

---

## Build Prompts (in order)

### Mobile Build 1: Project Scaffolding + Design System

Scaffold the Expo project, install dependencies, configure NativeWind, set up the design token system, and create reusable UI primitives.

**What to build:**
- `npx create-expo-app unlock-mobile --template blank-typescript`
- Install: `nativewind`, `tailwindcss`, `react-native-svg`, `@supabase/supabase-js`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `expo-router`, `@expo/vector-icons`, `react-native-safe-area-context`, `react-native-screens`, `react-native-gesture-handler`, `react-native-reanimated`
- Configure NativeWind with the design system tokens (colors, spacing, typography, border radius) matching the web app's `globals.css`
- Create `constants/design.ts` with all design tokens as exportable JS objects
- Create reusable UI components: `Button`, `Card`, `Tag`, `Input`, `TextArea`
- Create the root `app/_layout.tsx` with dark theme, safe area, status bar config
- Create placeholder tab layout `app/(tabs)/_layout.tsx` with 4 tabs: Dashboard, Drills, Roster, Practice (icons from Ionicons)
- Create placeholder screens for each tab (just the tab name centered)

**This gives us:** A running app with navigation, dark theme, and the full design system ready.

---

### Mobile Build 2: Supabase Client + Auth Screens

Set up the Supabase client for React Native and build the login/signup screens.

**What to build:**
- `lib/supabase.ts`: Initialize Supabase client using `expo-secure-store` for auth token storage
- Auth context provider in `app/_layout.tsx` that tracks session state
- `app/(auth)/login.tsx`: Email + password form, sign in with Supabase, redirect to tabs on success
- `app/(auth)/signup.tsx`: Email + password form, sign up with Supabase, redirect to team-setup on success
- Auth gating: root layout checks session. No session → redirect to login. Has session → check for team membership → redirect to team-setup or tabs.
- Style: same dark surface-raised card design as web, centered on screen

**Port from web:** `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/lib/supabase/client.ts`, `src/middleware.ts` (auth logic only)

---

### Mobile Build 3: Team Setup + Team Context

Team creation flow and the shared team context provider.

**What to build:**
- `app/team-setup.tsx`: Team name input, calls `create_team_with_member()` RPC, redirects to tabs on success
- `lib/team-context.tsx`: React context providing `teamId`, `teamName`, `userRole`. Queries `team_members` joined with `teams` on mount. Same logic as web version.
- Wrap tab layout with team context provider
- If user has no team membership, redirect to team-setup from root layout

**Port from web:** `src/app/team-setup/page.tsx`, `src/lib/team-context.tsx`

---

### Mobile Build 4: Dashboard (Home Tab)

The main dashboard with real aggregated data.

**What to build:**
- `app/(tabs)/index.tsx`: Dashboard screen
- Team header (team name + "Team Dashboard" subtitle)
- Team strengths/weaknesses card (from `vw_team_strength_weakness`)
- Stat cards row: active players, published drills, benchmark assessments, completed practices
- Recent benchmarks section (last 5, from `benchmark_results` joined with player + drill names)
- Recent practices section (last 3, from `vw_practice_history`)
- Quick actions at bottom (Add drill, Add player, Plan practice, Run assessment)
- Empty/getting-started state for new teams
- All data fetched in parallel using `Promise.all` inside `useEffect`
- Pull-to-refresh using `RefreshControl`

**Port from web:** `src/app/page.tsx`

---

### Mobile Build 5: Drill Library (List + Detail)

Drill list with category filtering and drill detail view.

**What to build:**
- `app/(tabs)/drills/index.tsx`: Drill list with category filter pills at top, search, FAB or header button for "New Drill"
- `app/(tabs)/drills/[id].tsx`: Drill detail page showing name, category, description, source URL, benchmark type, equipment list, setup instructions, read-only diagram
- `components/DiagramRenderer.tsx`: Port the SVG diagram renderer using `react-native-svg` (Svg, Circle, Line, Text, Rect, G, Path, Polygon, Polyline components)
- Category filtering, draft/published status display

**Port from web:** `src/app/drills/page.tsx`, `src/app/drills/[id]/page.tsx`, `src/components/DiagramRenderer.tsx`

---

### Mobile Build 6: Drill Create + Edit

Drill creation and editing forms with the interactive diagram builder.

**What to build:**
- `app/(tabs)/drills/new.tsx`: Create drill form (name, category, description, source URL, equipment, diagram)
- `app/(tabs)/drills/[id]/edit.tsx`: Edit drill form (same fields, pre-populated)
- `components/DiagramEditor.tsx`: Port the interactive diagram builder to `react-native-svg` with gesture handling (`react-native-gesture-handler` for drag). This is the most complex port: cone placement, dragging, path drawing, route drawing with straight/zigzag/curve segments.
- Draft/publish workflow
- `types/diagram.ts`: Copy directly
- `lib/generate-setup-instructions.ts`: Copy directly

**Port from web:** `src/app/drills/new/page.tsx`, `src/app/drills/[id]/edit/page.tsx`, `src/components/DiagramEditor.tsx`, `src/types/diagram.ts`, `src/lib/generate-setup-instructions.ts`

**Note:** The diagram editor is the hardest screen to port because of SVG touch interactions. May need to break this into sub-prompts if it's too large.

---

### Mobile Build 7: Roster (List + Detail + Add + Edit)

Full roster management.

**What to build:**
- `app/(tabs)/roster/index.tsx`: Roster list with active/inactive sections
- `app/(tabs)/roster/new.tsx`: Add player form (name, positions multi-select, jersey number, notes)
- `app/(tabs)/roster/[id].tsx`: Player detail with benchmark history
- `app/(tabs)/roster/[id]/edit.tsx`: Edit player form
- Deactivate/reactivate functionality

**Port from web:** `src/app/roster/page.tsx`, `src/app/roster/new/page.tsx`, `src/app/roster/[id]/page.tsx`, `src/app/roster/[id]/edit/page.tsx`

---

### Mobile Build 8: Benchmark Logging

The assessment flow: select drills and players, log results per player.

**What to build:**
- `app/benchmarks/index.tsx`: Benchmark hub (select a benchmark drill, select players)
- `app/benchmarks/log.tsx`: Per-player logging screen (timed input or 1-5 rating buttons, quick tags, notes). This needs to be fast: one number or one tap per player.
- `app/benchmarks/complete.tsx`: Assessment complete summary
- "Run Benchmark" button on drill detail pages
- "Run Assessment" quick action on dashboard

**Port from web:** `src/app/benchmarks/page.tsx`, `src/app/benchmarks/log/page.tsx`, `src/app/benchmarks/complete/page.tsx`

---

### Mobile Build 9: Practice Planner (List + Create + Detail + Edit)

Practice plan management with drill picker.

**What to build:**
- `app/(tabs)/practice/index.tsx`: Practice plans list
- `app/(tabs)/practice/new.tsx`: Create practice plan with date picker, drill picker (search + add from library), drag-to-reorder, time allocation per drill
- `app/(tabs)/practice/[id].tsx`: Practice plan detail with drill schedule, status display, "Log Practice" button
- `app/(tabs)/practice/[id]/edit.tsx`: Edit practice plan
- Finalize workflow (draft → finalized)
- Drill picker as a bottom sheet or modal

**Port from web:** `src/app/practice/page.tsx`, `src/app/practice/new/page.tsx`, `src/app/practice/[id]/page.tsx`, `src/app/practice/[id]/edit/page.tsx`

---

### Mobile Build 10: Post-Practice Logging

Structured capture after practice.

**What to build:**
- `app/(tabs)/practice/[id]/log.tsx`: Post-practice log form
- Drills completed/skipped toggles (each planned drill as a row, tap to toggle green check / red X)
- Team performance notes textarea
- Highlights and areas to improve textareas
- Attendance count (number input)
- Energy level (1-5 tappable buttons)
- Save: insert practice_log + update practice plan status to "completed"
- Show log data on practice plan detail when completed

**Port from web:** `src/app/practice/[id]/log/page.tsx`

---

### Mobile Build 11: Polish + App Store Prep

Final touches before the app is usable at practice.

**What to build:**
- Loading states (skeleton screens) on all list/detail pages
- Error handling with retry on all data-fetching screens
- Pull-to-refresh on all list screens
- App icon and splash screen (orange-on-dark branding)
- `app.json` configuration (name, slug, scheme, iOS/Android bundle IDs)
- EAS Build configuration for development builds
- Keyboard-aware scroll views on all form screens
- Haptic feedback on tag selection and toggle actions (`expo-haptics`)
- Test on iOS simulator and Android emulator

---

## CLI Prompt Format

Each build prompt should be entered into Claude CLI as:

```
Read unlock-app/prompts/mobile-build-[N]-[name].md and implement all changes described.
```

The individual prompt files will be created as we go, one at a time, same pattern as the web builds.

## Key Risks

1. **Diagram builder SVG port:** Touch interactions in `react-native-svg` are different from DOM SVG events. Drag handling needs `react-native-gesture-handler` PanGesture instead of pointer events. This is the highest-risk screen.
2. **NativeWind compatibility:** Not every Tailwind class has a NativeWind equivalent. Some inline styles from the web app will need manual conversion.
3. **Expo Router maturity:** File-based routing in Expo Router is stable but has quirks with nested dynamic routes. May need workarounds.
4. **Build time:** 11 builds is a lot. If October feels tight, the diagram builder (Build 6) can be deferred since captains can create drills on the web app and view them read-only on mobile.
