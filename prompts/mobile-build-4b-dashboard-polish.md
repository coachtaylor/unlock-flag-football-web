# Mobile Build 4b: Dashboard Visual Polish

Read `unlock-mobile/CLAUDE.md` for the full design system, especially the NEW "Visual Design Principles (Modern, Not Flat)" section. These principles should guide every visual decision in this build.

Read `unlock-mobile/app/(tabs)/index.tsx` for the current dashboard implementation.

## Context

The dashboard works but looks flat. Every element has the same visual weight, spacing is uniform, and there's dead space at the bottom. This build applies the visual design principles from CLAUDE.md to make the dashboard feel modern, polished, and premium.

## Changes

### 1. Hero card upgrade

The team header card at the top should be the clear focal point of the screen. Make it feel elevated:

- Background: use a slightly lighter shade than surface-raised, like `#1A2230`, OR add a very subtle orange radial gradient in the top-right corner (keep it subtle, 10-15% opacity max)
- 1px border in border-default (not border-subtle, slightly more visible)
- rounded-xl (14px) instead of rounded-lg
- Internal padding: 20px
- "YOUR TEAM" label in label-micro style at top
- Team name in text-title (20px), font-medium
- Subtitle: "Let's get your dashboard set up." in text-caption, text-secondary (for empty state) or "Team Dashboard" (for populated state)
- If there's an orange glow element, keep it but make sure it's decorative and subtle

### 2. Getting-started cards (empty state)

The three step cards need more visual presence:

- Each card gets a 3-4px left border in orange-500 (accent bar)
- 1px border on all other sides in border-subtle
- rounded-xl (14px)
- Internal padding: 16px
- Layout per card:
  - Left side: orange numbered circle (keep the existing ones, they're good)
  - Middle: Title in text-body, font-medium. Subtitle in text-caption, text-secondary. Subtitle should describe the action: "Build the roster you'll be coaching.", "Seed the library with what you already run.", "Benchmark a drill to start collecting data."
  - Right side: Ionicons icon matching the action (person-add-outline, football-outline, stopwatch-outline), 22px, text-muted. Plus a chevron-forward icon (16px, text-muted) at the far right.
- Press state: opacity 0.85 on press
- Haptic feedback: light impact on press (`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`)
- 16px gap between cards

### 3. Section header treatment

"GET STARTED" section header:
- label-micro style (11px, uppercase, letter-spacing)
- Add a subtitle line below: "Three steps to get your dashboard running." in text-caption, text-secondary
- 32px top margin (space between hero card and this section)
- 12px bottom margin before the first card

Apply this same pattern to all section headers throughout the dashboard (Recent Assessments, Recent Practices, Quick Actions, Team Overview).

### 4. Remove Sign Out from dashboard

Sign Out does not belong on the main dashboard. It creates dead space and isn't something captains do often.

- Remove the Sign Out button from the dashboard
- Add a settings gear icon (Ionicons: `settings-outline`, 22px, text-secondary) in the top-right corner of the dashboard header area
- Tapping the gear navigates to a simple settings screen (create `app/settings.tsx` if it doesn't exist)
- The settings screen just needs: user email display, team name display, and a "Sign Out" button (destructive style) for now. Simple screen, surface-base background, cards for each section.

### 5. Fill the bottom space

After the last card and before the tab bar, add breathing room:
- 32px padding at the bottom of the ScrollView content (so the last card doesn't butt up against the tab bar)
- If in the empty/getting-started state, add a motivational line below the step cards: "Your dashboard will come alive as you add data." in text-caption, text-muted, centered, with 24px top margin
- Consider adding a large subtle icon above this text (Ionicons: `analytics-outline`, 40px, text-muted at 0.3 opacity)

### 6. Stat cards polish (populated state)

When the dashboard has real data and shows stat cards:
- Each card: 1px border in border-subtle, rounded-xl
- Stat number: text-stat (28px), font-medium, text-primary
- Label: text-caption, text-secondary
- Add a small icon in the top-right of each card (text-muted, 18px):
  - Active Players → `people-outline`
  - Published Drills → `football-outline`
  - Assessments → `stopwatch-outline`
  - Practices → `clipboard-outline`

### 7. Recent assessments / practices cards (populated state)

- Wrap each section in a card with border-subtle, rounded-xl
- List rows inside: separated by 1px border-subtle dividers
- Each row: tap navigates, so add chevron-forward (16px, text-muted) on the right
- Press state on each row

### 8. Quick action cards polish (populated state)

- Each card: 1px border in border-subtle, rounded-xl
- Icon above label: 24px Ionicon in orange-500 (not text-secondary — these are CTAs)
- Label in text-caption, font-medium
- Press state: opacity 0.85
- Haptic: light impact on press

### 9. Overall scroll and safe areas

- Use `useSafeAreaInsets()` for top padding on the header
- Bottom padding on ScrollView: `insets.bottom + 80` (tab bar height + breathing room)
- `showsVerticalScrollIndicator={false}` for cleaner look

## Design checklist

After this build, verify:
- [ ] Hero card visually stands out from everything below it
- [ ] Getting-started cards have left orange accent bars and icons
- [ ] No two adjacent sections have the same gap size
- [ ] Sign Out is gone from dashboard, settings gear is in header
- [ ] No dead space at the bottom
- [ ] Every tappable card has a press state
- [ ] Section headers have subtitle context lines
- [ ] The screen feels like a polished sports app, not a flat prototype

## Testing

1. Open the dashboard with no data (empty state). Should see hero card, section header with subtitle, three polished step cards with icons and accent bars, motivational text at bottom.
2. Tap a step card. Should navigate with a subtle press animation.
3. Tap the settings gear. Should open settings screen with sign out.
4. Sign out from settings. Should redirect to login.
5. Open the dashboard with data (populated state). Stat cards should have icons and borders. Recent sections should have chevrons on rows. Quick actions should have orange icons.
6. Scroll to the bottom. Content should have breathing room above the tab bar.
