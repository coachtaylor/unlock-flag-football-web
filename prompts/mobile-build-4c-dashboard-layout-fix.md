# Mobile Build 4c: Dashboard Layout Fix

Read `unlock-mobile/CLAUDE.md` for design system and visual design principles. Read `unlock-mobile/app/(tabs)/index.tsx` for the current dashboard.

## Problem

The dashboard card layouts are broken. Elements inside cards are stacking vertically instead of sitting in proper horizontal flex rows. Icons are in the wrong position, chevrons are misplaced, and the overall alignment looks amateur. This build fixes the internal layout of every card and section on the dashboard with explicit flex structures.

## Fix 1: Getting-Started Step Cards

Each step card must be a single horizontal flex row. Here is the EXACT structure:

```
┌─────────────────────────────────────────────────────┐
│ ●  Title text                          icon    ›    │
│ 1  Subtitle text here                               │
└─────────────────────────────────────────────────────┘
  ↑        ↑                              ↑      ↑
  orange   text column                    icon   chevron
  circle   (flex: 1, takes              (fixed)  (fixed)
  (fixed   remaining space)
  width)
```

The React Native structure for each card:

```tsx
<Pressable
  onPress={() => router.push(route)}
  style={({ pressed }) => ({
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161C24",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderLeftWidth: 3,
    borderLeftColor: "#D48A30",
    padding: 16,
    gap: 12,
    opacity: pressed ? 0.85 : 1,
  })}
>
  {/* 1. Numbered circle — fixed 32px */}
  <View style={{
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(212,138,48,0.15)",
    alignItems: "center",
    justifyContent: "center",
  }}>
    <Text style={{
      color: "#D48A30",
      fontSize: 15,
      fontWeight: "500",
    }}>
      {stepNumber}
    </Text>
  </View>

  {/* 2. Text column — flex: 1, takes all remaining horizontal space */}
  <View style={{ flex: 1 }}>
    <Text style={{
      color: "rgba(255,255,255,0.92)",
      fontSize: 15,
      fontWeight: "500",
    }}>
      {title}
    </Text>
    <Text style={{
      color: "rgba(255,255,255,0.60)",
      fontSize: 13,
      marginTop: 2,
    }}>
      {subtitle}
    </Text>
  </View>

  {/* 3. Icon — fixed 24px */}
  <Ionicons name={iconName} size={20} color="rgba(255,255,255,0.35)" />

  {/* 4. Chevron — fixed 16px */}
  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
</Pressable>
```

Key points:
- The ENTIRE card is `flexDirection: "row"` and `alignItems: "center"`
- The text View has `flex: 1` so it fills the middle
- The icon and chevron are fixed-width and sit on the right
- `gap: 12` handles spacing between all children
- Nothing stacks vertically EXCEPT the title and subtitle within the text column

The three cards:

| # | Title | Subtitle | Icon |
|---|-------|----------|------|
| 1 | Add your players | Build the roster you'll be coaching. | `people-outline` |
| 2 | Create your drills | Seed the library with what you already run. | `football-outline` |
| 3 | Run your first assessment | Benchmark a drill to start collecting data. | `timer-outline` |

Gap between step cards: 12px.

## Fix 2: Hero Card

The hero card should also use explicit flex:

```tsx
<View style={{
  backgroundColor: "#1A2230",
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  padding: 20,
}}>
  <Text style={{
    color: "rgba(255,255,255,0.60)",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  }}>
    YOUR TEAM
  </Text>
  <Text style={{
    color: "rgba(255,255,255,0.92)",
    fontSize: 20,
    fontWeight: "500",
    marginTop: 4,
  }}>
    {teamName}
  </Text>
  <Text style={{
    color: "rgba(255,255,255,0.60)",
    fontSize: 13,
    marginTop: 4,
  }}>
    Let's get your dashboard set up.
  </Text>
</View>
```

The settings gear should be positioned in the top-right of the screen header area ABOVE the hero card, not inside it. Use a header row:

```tsx
{/* Screen header row */}
<View style={{
  flexDirection: "row",
  justifyContent: "flex-end",
  paddingBottom: 12,
}}>
  <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
    <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.60)" />
  </Pressable>
</View>

{/* Hero card */}
<View style={heroCardStyles}>
  ...
</View>
```

## Fix 3: Section Headers

Every section header follows this pattern:

```tsx
<View style={{ marginTop: 32, marginBottom: 12 }}>
  <Text style={{
    color: "rgba(255,255,255,0.60)",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  }}>
    GET STARTED
  </Text>
  <Text style={{
    color: "rgba(255,255,255,0.60)",
    fontSize: 13,
    marginTop: 4,
  }}>
    Three steps to get your dashboard running.
  </Text>
</View>
```

32px top margin to create breathing room from the previous section. 12px bottom margin before the content.

## Fix 4: Bottom Area

After the three step cards:

```tsx
<View style={{
  alignItems: "center",
  marginTop: 32,
  marginBottom: 40,
  gap: 8,
}}>
  <Ionicons name="analytics-outline" size={40} color="rgba(255,255,255,0.12)" />
  <Text style={{
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    textAlign: "center",
  }}>
    Your dashboard will come alive as you add data.
  </Text>
</View>
```

## Fix 5: Stat Cards (populated state, 2x2 grid)

When the dashboard has data and shows stat cards, use a proper 2-column grid:

```tsx
<View style={{
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 12,
}}>
  {stats.map((stat) => (
    <View
      key={stat.label}
      style={{
        flex: 1,
        minWidth: "45%",
        backgroundColor: "#161C24",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        padding: 16,
      }}
    >
      <View style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <Text style={{
          color: "rgba(255,255,255,0.92)",
          fontSize: 28,
          fontWeight: "500",
        }}>
          {stat.value}
        </Text>
        <Ionicons name={stat.icon} size={18} color="rgba(255,255,255,0.35)" />
      </View>
      <Text style={{
        color: "rgba(255,255,255,0.60)",
        fontSize: 13,
        marginTop: 4,
      }}>
        {stat.label}
      </Text>
    </View>
  ))}
</View>
```

## Fix 6: Recent Assessments / Practices List Rows (populated state)

Each tappable list row inside a section card:

```tsx
<Pressable
  onPress={() => router.push(route)}
  style={({ pressed }) => ({
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    opacity: pressed ? 0.85 : 1,
  })}
>
  {/* Text column */}
  <View style={{ flex: 1 }}>
    <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 15, fontWeight: "500" }}>
      {playerName}
    </Text>
    <Text style={{ color: "rgba(255,255,255,0.60)", fontSize: 13, marginTop: 2 }}>
      {drillName} · {result} · {date}
    </Text>
  </View>

  {/* Chevron */}
  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
</Pressable>
```

Rows separated by a 1px divider:
```tsx
<View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginHorizontal: 16 }} />
```

## Fix 7: Quick Action Cards (populated state, 2x2 grid)

```tsx
<Pressable
  onPress={() => router.push(route)}
  style={({ pressed }) => ({
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#161C24",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
    alignItems: "center",
    gap: 8,
    opacity: pressed ? 0.85 : 1,
  })}
>
  <Ionicons name={iconName} size={24} color="#D48A30" />
  <Text style={{
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  }}>
    {label}
  </Text>
</Pressable>
```

Quick actions grid uses the same `flexDirection: "row", flexWrap: "wrap", gap: 12` wrapper as stat cards.

## Overall ScrollView structure

```tsx
<ScrollView
  style={{ flex: 1, backgroundColor: "#0D1117" }}
  contentContainerStyle={{
    paddingHorizontal: 20,
    paddingTop: insets.top + 12,
    paddingBottom: insets.bottom + 80,
  }}
  showsVerticalScrollIndicator={false}
>
  {/* Settings gear row */}
  {/* Hero card */}
  {/* Section header: GET STARTED */}
  {/* Step cards (or stat cards + sections if populated) */}
  {/* Bottom motivational area */}
</ScrollView>
```

## Testing

1. Every card should have a clean horizontal row layout: circle | text | icon | chevron all vertically centered on the same line.
2. No elements should be floating below or above where they belong.
3. Text should wrap naturally within the flex: 1 column without pushing icons off screen.
4. On smaller screens (iPhone SE / 375px width), cards should still look correct with wrapped subtitle text.
5. Press state visible on all tappable cards.
6. Consistent 12px gaps between cards within a section, 32px between sections.
