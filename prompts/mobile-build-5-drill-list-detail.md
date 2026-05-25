# Mobile Build 5: Drill Library (List + Detail + Read-Only Diagram)

Read `unlock-mobile/CLAUDE.md` for project context and design system. Read `unlock-app/src/app/drills/page.tsx` and `unlock-app/src/app/drills/[id]/page.tsx` for the web implementations to port. Read `unlock-app/src/components/DiagramRenderer.tsx` for the read-only diagram component.

## Context

The drill library is where captains browse, search, and view their team's drills. This build covers the list screen, the detail screen, and the read-only diagram renderer (ported from web SVG to react-native-svg). The create/edit forms and interactive diagram editor come in Build 6.

## Task 1: Drill list screen

Replace the placeholder `app/(tabs)/drills/index.tsx`:

### Header
- "Drills" (text-title, font-medium)
- Safe area top padding

### Category filter pills
- Horizontal scrollable row of category pills at the top
- "All" pill (selected by default) + one pill per category found in the team's drills
- Query categories: `supabase.from("team_drills").select("category").eq("team_id", teamId).eq("status", "published")`
- Deduplicate and sort alphabetically
- Pill styling: use the Tag component. Selected = orange, unselected = muted.
- Tapping a category filters the list. Tapping "All" resets.

### Search
- Search input below the filter pills
- Filters drills by name (client-side filter on the already-loaded list is fine)
- Placeholder: "Search drills..."
- Clear button (X) when text is entered

### Drill list
- FlatList of drills filtered by selected category and search text
- Query: `supabase.from("team_drills").select("*").eq("team_id", teamId).eq("status", "published").order("drill_name")`
- Each row is a card (surface-raised, rounded-lg, padding-lg):
  - Drill name (text-body, font-medium)
  - Category as a tag pill (small, non-interactive, just for display)
  - Benchmark type badge if set: "Timed" or "Rated" in text-micro, orange-600 background, orange-400 text, rounded-pill
  - Chevron right icon on the far right
- Tap navigates to drill detail: `router.push(\`/drills/\${drill.id}\`)`
- Pull-to-refresh with RefreshControl

### FAB or header button
- "+" button to create a new drill
- Either a floating action button (bottom-right, orange-500, circular, 56px) or a header-right button
- Navigates to `/drills/new`

### Empty state
- If no published drills: "No drills yet. Create your first drill to get started." (text-body, text-secondary, centered)
- "Create Drill" button below (orange-500)

### Loading state
- Skeleton cards while loading (3-4 pulsing rectangles)

## Task 2: Drill detail screen

Create `app/(tabs)/drills/[id].tsx`:

### Data fetching
```typescript
const { id } = useLocalSearchParams();
const { data: drill } = await supabase
  .from("team_drills")
  .select("*")
  .eq("id", id)
  .single();
```

### Layout (ScrollView, top to bottom)

**Header area:**
- Back button (chevron-left icon) navigating back to drill list
- Drill name (text-title, font-medium)
- Category tag pill
- Benchmark type badge if set

**Description:**
- Section label: "Description" (label-micro)
- Description text (text-body, text-secondary)
- If no description: skip this section

**Source URL:**
- If the drill has a source_url, show a tappable link: "View source video" in orange-400
- Opens the URL using `Linking.openURL(drill.source_url)`
- Icon: `open-outline` from Ionicons next to the text

**Setup Diagram:**
- Section label: "Setup Diagram" (label-micro)
- If `drill.setup_diagram` exists (JSONB field), render the DiagramRenderer component (Task 3)
- If no diagram: skip this section

**Setup Instructions:**
- Section label: "Setup Instructions" (label-micro)
- Auto-generated from diagram data using `generateSetupInstructions()`
- Text-body, text-secondary
- If no diagram: skip this section

**Equipment:**
- Section label: "Equipment" (label-micro)
- Cone count (auto-calculated from diagram) + any manual equipment entries
- Display as a simple text list or inline tags

**Action buttons (bottom of scroll):**
- "Edit Drill" button (secondary style: surface-raised, border-default, full width)
- "Run Benchmark" button (primary orange, full width) — only shows if benchmark_type is set
  - Navigates to benchmarks flow with this drill pre-selected
- Spacing between buttons: 12px (gap-md)

## Task 3: DiagramRenderer for React Native

Create `components/DiagramRenderer.tsx`:

Port the web DiagramRenderer from HTML SVG to react-native-svg. Key changes:

**Imports:**
```typescript
import Svg, { Circle, Line, Rect, Text as SvgText, G, Path, Polyline, Polygon } from "react-native-svg";
```

**Key differences from web:**
- `<svg>` → `<Svg>`
- `<circle>` → `<Circle>` (capitalized)
- `<line>` → `<Line>`
- `<rect>` → `<Rect>`
- `<text>` → `<SvgText>` (renamed to avoid conflict with RN Text)
- `<g>` → `<G>`
- `<path>` → `<Path>`
- `<polyline>` → `<Polyline>`
- `<polygon>` → `<Polygon>`
- No `className` on SVG elements. Use props directly (fill, stroke, strokeWidth, etc.)
- `pointer-events` attribute doesn't apply (no mouse in RN). Remove all `pointerEvents` props from SVG elements.
- `style={{ paintOrder: "stroke" }}` on SvgText may not be supported. Use a white shadow/outline effect differently or just skip the text outline since we removed cone labels in Build 7a.
- `dominantBaseline` may not be supported in react-native-svg. Use `dy` offset instead for vertical text alignment.

**What to render:**
- Football field (white background, yard lines, hash marks, sidelines, yard numbers in left margin) — same visual as web
- Paths (cone-to-cone connections with movement type colors and dash patterns)
- Routes (player routes with straight, zigzag, and curve segments, arrowheads, start point circles) — handle `routes` being undefined for backward compat
- Cones (small orange dots, radius 4, no labels)
- Movement legend below the SVG (using regular React Native Views and Text, not SVG)

**Wrapper:**
```typescript
import { View, Text } from "react-native";

export default function DiagramRenderer({ data }: { data: DiagramData }) {
  const routes = data.routes ?? [];
  
  return (
    <View>
      <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
        <Svg viewBox={VIEWBOX} style={{ width: "100%", aspectRatio: VIEW_W / VIEW_H }}>
          {/* Field, paths, routes, cones */}
        </Svg>
      </View>
      {/* Movement legend below */}
    </View>
  );
}
```

**Port these files directly (no changes needed):**
- `types/diagram.ts` → copy to `unlock-mobile/types/diagram.ts`
- `lib/generate-setup-instructions.ts` → copy to `unlock-mobile/lib/generate-setup-instructions.ts`

## Design rules

- Dark mode. surface-base background, surface-raised cards.
- Two font weights: normal (400) and medium (500).
- Screen padding: 20px horizontal.
- The diagram canvas is a white rectangle inside the dark app (same as web). It should have a border (border-default) and rounded-lg corners.
- List items: 44px minimum height touch targets.
- Pull-to-refresh on the list.
- Back navigation: use a back button (chevron-left) at top-left of detail screens. Expo Router's `router.back()`.

## Testing

1. Open the Drills tab. Should show the list of published drills (or empty state if none).
2. Tap a category pill. List should filter to that category.
3. Type in the search box. List should filter by name.
4. Tap a drill. Should navigate to the detail page.
5. On the detail page, verify all sections render: name, category, description, source URL (if set), diagram (if set), setup instructions, equipment.
6. The diagram should render correctly with the white field, cones as small orange dots, paths with correct colors/dashes, and routes if any exist.
7. Tap "Edit Drill". Should navigate (even if the edit screen is a placeholder for now).
8. Tap "Run Benchmark" (if drill has benchmark type). Should navigate to benchmarks.
9. Pull to refresh on the list. Should reload.
10. Test with a drill that has no diagram. The diagram section should not appear.
