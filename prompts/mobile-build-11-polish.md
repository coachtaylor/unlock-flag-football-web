# Mobile Build 11: Polish + App Store Prep

Read `unlock-mobile/CLAUDE.md` for project context and design system. This is the final polish pass before the app ships to real users at practice.

## Context

All features are built. This build is about making the app feel complete and reliable: loading states, error handling, keyboard behavior, haptics, and the configuration needed to run on a real device. The app needs to be ready for Taylor and co-captains to use every Sunday at practice starting now.

## Task 1: Loading states on every screen

Every screen that fetches data should show skeleton loading, not a blank screen.

### Screens that need loading skeletons:
- Dashboard (`app/(tabs)/index.tsx`) — already has one, verify it works
- Drill list (`app/(tabs)/drills/index.tsx`) — 3-4 skeleton cards
- Drill detail (`app/(tabs)/drills/[id].tsx`) — skeleton blocks for header, description, diagram area
- Roster list (`app/(tabs)/roster/index.tsx`) — 3-4 skeleton cards
- Player detail (`app/(tabs)/roster/[id].tsx`) — skeleton for header, info, benchmark list
- Practice list (`app/(tabs)/practice/index.tsx`) — 3-4 skeleton cards
- Practice detail (`app/(tabs)/practice/[id].tsx`) — skeleton for header, drill schedule
- Benchmark hub (`app/benchmarks/index.tsx`) — skeleton for drill list, player list

### Skeleton pattern
Use the `SkeletonBlock` component from the dashboard (pulsing animated rectangle) or create a shared one in `components/ui/Skeleton.tsx`:

```tsx
// Reusable skeleton component
function Skeleton({ height, width, style }: { height: number; width?: number | `${number}%`; style?: ViewStyle }) {
  // Animated opacity pulse between 0.3 and 0.6
  // Background: surface-raised (#161C24)
  // Border radius: 12px
}
```

Each screen should have its own skeleton layout that roughly matches the shape of the loaded content. Don't use a single generic spinner.

## Task 2: Error handling on every screen

Every screen that fetches data should handle errors gracefully.

### Error pattern
When a fetch fails, show a centered error state:

```tsx
<View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
  <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.25)" />
  <Text style={{ color: "rgba(255,255,255,0.60)", fontSize: 15, textAlign: "center", marginTop: 12 }}>
    Something went wrong loading this page.
  </Text>
  <Pressable
    onPress={retry}
    style={({ pressed }) => ({
      marginTop: 16,
      paddingVertical: 10,
      paddingHorizontal: 24,
      borderRadius: 20,
      backgroundColor: "rgba(212,138,48,0.12)",
      borderWidth: 1,
      borderColor: "rgba(212,138,48,0.25)",
      opacity: pressed ? 0.85 : 1,
    })}
  >
    <Text style={{ color: "#D48A30", fontSize: 14, fontWeight: "500" }}>Try Again</Text>
  </Pressable>
</View>
```

The "Try Again" button should re-trigger the data fetch. Consider extracting this into a shared `ErrorState` component.

### Form submission errors
All forms (add player, create drill, save practice plan, log benchmark, log practice) should:
- Catch Supabase errors on submit
- Show error text below the submit button in red (error color #EF4444)
- Not navigate away on error
- Keep the form data intact so the user can retry

## Task 3: KeyboardAvoidingView on all form screens

Wrap every form screen in a `KeyboardAvoidingView` so the keyboard doesn't cover input fields.

### Screens with forms:
- Add player (`app/(tabs)/roster/new.tsx`)
- Edit player (`app/(tabs)/roster/[id]/edit.tsx`)
- Create drill (`app/(tabs)/drills/new.tsx`)
- Edit drill (`app/(tabs)/drills/[id]/edit.tsx`)
- Create practice plan (`app/(tabs)/practice/new.tsx`)
- Edit practice plan (`app/(tabs)/practice/[id]/edit.tsx`)
- Benchmark log (`app/benchmarks/log.tsx`)
- Post-practice log (`app/(tabs)/practice/[id]/log.tsx`)
- Settings (if it has any inputs)

### Pattern
```tsx
import { KeyboardAvoidingView, Platform } from "react-native";

<KeyboardAvoidingView
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  style={{ flex: 1 }}
  keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
>
  <ScrollView ...>
    {/* form content */}
  </ScrollView>
</KeyboardAvoidingView>
```

Adjust `keyboardVerticalOffset` based on the header height. Test on iOS simulator with the keyboard open to verify inputs aren't hidden.

## Task 4: Pull-to-refresh on all list screens

Every list screen should support pull-to-refresh.

### Screens:
- Dashboard — already has it, verify
- Drill list
- Roster list
- Practice list

### Pattern
```tsx
<ScrollView
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="#D48A30"
    />
  }
>
```

Or use `FlatList` with the same `refreshControl` prop. The refresh tint color should be orange-500.

## Task 5: Haptic feedback audit

Make sure `expo-haptics` light impact fires on:
- Tag/pill selection toggles (drill categories, player positions, benchmark tags)
- Rating button taps (benchmark 1-5, energy 1-5)
- Drill completed/skipped toggles (post-practice log)
- Card presses that navigate (step cards, drill cards, player cards, practice cards)
- Toggle actions (select all / clear on benchmark hub)

Use `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` wrapped in a `.catch(() => {})` so it doesn't crash on simulators.

Don't add haptics to:
- Regular button presses (Save, Submit, Back)
- Text input focus
- Scroll actions

## Task 6: App configuration

### app.json updates
```json
{
  "expo": {
    "name": "Unlock Flag Football",
    "slug": "unlock-flag-football",
    "scheme": "unlock",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "icon": "./assets/icon.png",
    "splash": {
      "backgroundColor": "#0D1117",
      "resizeMode": "contain"
    },
    "ios": {
      "bundleIdentifier": "com.unlockflagfootball.app",
      "supportsTablet": false
    },
    "android": {
      "package": "com.unlockflagfootball.app",
      "adaptiveIcon": {
        "backgroundColor": "#0D1117"
      }
    }
  }
}
```

### App icon and splash screen
- Create a simple app icon: orange football icon on dark (#0D1117) background
- If creating icons programmatically isn't feasible, use a placeholder solid orange square with "UFF" text
- Icon sizes needed: 1024x1024 for the store, Expo handles resizing
- Splash screen: dark background (#0D1117), can be plain for now

## Task 7: Navigation edge cases

### Deep link handling
- Verify all routes work when accessed directly (not just via tab navigation)
- Benchmark screens (`/benchmarks/*`) should be accessible from both dashboard quick actions and drill detail pages
- Practice log (`/practice/[id]/log`) should only work for finalized plans

### Back button behavior
- Every non-tab screen should have a working back button
- Forms with unsaved changes: consider showing a confirmation alert on back press (optional for MVP, note it as a future improvement if not implementing)

### Tab bar visibility
- Tab bar should be visible on all tab screens (dashboard, drills, roster, practice)
- Tab bar should be hidden on focused flows (benchmark logging, practice log) — these are stack screens pushed on top

## Task 8: Performance quick check

- Make sure no screen re-fetches data unnecessarily on every render
- Use `useCallback` for fetch functions passed as dependencies
- Use `useFocusEffect` from `@react-navigation/native` to refresh data when a screen comes back into focus (e.g., returning to the roster list after adding a player should show the new player)

## Testing checklist

Run through every screen in the app on the iOS simulator:

### Loading & error states
- [ ] Dashboard shows skeleton while loading
- [ ] Drill list shows skeleton while loading
- [ ] Roster list shows skeleton while loading
- [ ] Practice list shows skeleton while loading
- [ ] Kill network and verify error states appear with retry buttons
- [ ] Retry button works and re-fetches data

### Keyboard behavior
- [ ] Add player form: keyboard doesn't cover inputs, can scroll while keyboard is open
- [ ] Create drill form: same
- [ ] Benchmark log (timed): numeric keyboard appears, doesn't cover input
- [ ] Practice plan form: same
- [ ] Post-practice log: textareas accessible with keyboard open

### Pull-to-refresh
- [ ] Dashboard pull-to-refresh works
- [ ] Drill list pull-to-refresh works
- [ ] Roster list pull-to-refresh works
- [ ] Practice list pull-to-refresh works

### Haptics
- [ ] Tag selections trigger haptic
- [ ] Rating buttons trigger haptic
- [ ] Drill toggle (completed/skipped) triggers haptic
- [ ] Card navigation presses trigger haptic

### Navigation
- [ ] All back buttons work
- [ ] Tab bar visible on main screens
- [ ] Tab bar hidden during benchmark flow
- [ ] Deep links to drill detail, player detail, practice detail all work
- [ ] "Run Benchmark" from drill detail navigates correctly
- [ ] "Run Assessment" from dashboard navigates correctly
- [ ] Completing a benchmark returns to correct screen
- [ ] Completing a practice log returns to practice detail with log visible

### Data freshness
- [ ] Adding a player and going back to roster list shows the new player
- [ ] Creating a drill and going back to drill list shows the new drill
- [ ] Logging a benchmark and returning to player detail shows the new result
- [ ] Logging practice and returning to practice detail shows "Completed" status
