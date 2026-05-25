# Mobile Build 4d: Debug and Fix Step Card Flex Layout

Read `unlock-mobile/CLAUDE.md` for design system. Read `unlock-mobile/app/(tabs)/index.tsx` for the current dashboard.

## The Problem

The Getting Started step cards on the dashboard have `flexDirection: "row"` set on the Pressable, but **the children are rendering as a vertical column** in the iOS simulator. The numbered circle, text, icon, and chevron should all sit in a single horizontal row. Instead, they stack vertically.

This has survived multiple fix attempts with inline styles. The inline `flexDirection: "row"` is being ignored or overridden by something.

## Diagnosis Steps — Do These FIRST Before Changing Code

1. **Check if NativeWind's preset is interfering.** The project uses `nativewind/preset` in `tailwind.config.js` and imports `global.css` with `@tailwind base/components/utilities`. NativeWind v4 processes ALL components through its styling runtime, even ones without `className`. Check if the NativeWind preset applies a default `flexDirection: "column"` to Pressable or View that overrides inline `style` props.

2. **Check the NativeWind + inline style priority.** In NativeWind v4, `className` styles can override `style` props depending on the configuration. Even though these components don't use `className`, the base Tailwind reset (`@tailwind base`) might apply default styles that take priority.

3. **Try this test:** Temporarily add `className="flex-row items-center"` to the Pressable instead of using inline `flexDirection: "row"`. If the NativeWind className version works but inline style doesn't, that confirms NativeWind is overriding inline styles.

4. **Check `app/_layout.tsx`** and any root-level wrappers for global style overrides.

5. **Check if `babel.config.js`** has the `nativewind/babel` plugin that transforms styles at compile time.

## The Fix

Once you identify WHY inline `flexDirection: "row"` isn't working, apply the correct fix. The goal layout for each step card is:

```
┌──────────────────────────────────────────────────────┐
│  [1]  Add your players                    [icon] [›] │
│       Build the roster you'll be coaching.           │
└──────────────────────────────────────────────────────┘
```

All on one horizontal row: numbered circle (fixed 36px) | text column (flex: 1) | icon + chevron (fixed, right-aligned).

### If NativeWind className works but inline style doesn't:

Convert the step card Pressable to use NativeWind classes:

```tsx
<Pressable
  key={step.n}
  onPress={() => onNavigate(step.href)}
  className="flex-row flex-nowrap items-center"
  style={({ pressed }) => ({
    backgroundColor: pressed ? "#1A2028" : "#161C24",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderLeftWidth: 4,
    borderLeftColor: "#D48A30",
    padding: 16,
    opacity: pressed ? 0.9 : 1,
  })}
>
```

Apply the same pattern to ALL flex-row containers in the file:
- Step cards (EmptyState)
- Stat cards header row (FullDashboard)
- Assessment list rows (RecentAssessments)
- Practice list rows (RecentPractices)
- Quick action grid wrapper
- Section header label row

### If something else is the issue:

Fix whatever is actually causing it. The inline styles have been correct for three iterations — something external is overriding them.

## After Fixing the Flex Issue

Also fix these while you're in the file:

1. **Card border opacity:** Make sure all card borders use `rgba(255,255,255,0.14)` minimum (not 0.06 or 0.10). Cards need visible edges on the dark background.

2. **Step card gap:** 16px between step cards (already set, just verify).

3. **Verify ALL flex-row containers in the file work correctly**, not just the step cards. The same override might affect stat cards, list rows, quick actions, etc.

## Testing

1. Open the dashboard in the iOS simulator with no data (empty state).
2. Each step card must show: numbered circle on the LEFT, title + subtitle in the MIDDLE, icon + chevron on the RIGHT — all on the same horizontal line.
3. The text should wrap within its column without pushing icons off screen.
4. Stat cards (populated state) should show the number on the left and icon on the right in each card.
5. Assessment and practice list rows should show text on the left and chevron on the right.
6. Quick action cards should show icon centered above label.

## Important

Do NOT just re-apply the same inline style fix that has already been tried three times. The inline styles are correct — something is overriding them. Find out WHAT and fix THAT.
