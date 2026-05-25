# Mobile Build 6b: Interactive Diagram Editor

Read `unlock-mobile/CLAUDE.md` for project context and design system. Read `unlock-app/src/components/DiagramEditor.tsx` (the web implementation, ~2000 lines) and `unlock-mobile/components/DiagramRenderer.tsx` (the already-ported read-only renderer) before starting.

## Context

The web app has a full interactive diagram editor where captains place cones on a football field, draw movement paths between them, draw player routes (straight/zigzag/curve segments), place QB and football markers, and draw ball pass lines. The read-only `DiagramRenderer.tsx` is already ported to React Native using `react-native-svg`. This build ports the interactive editor.

The editor is embedded in the drill create and edit forms. When the user is creating or editing a drill, the diagram editor appears as a section in the form. The `DiagramData` JSON is stored in the `setup_diagram` column of the `team_drills` table.

## Architecture

Create `unlock-mobile/components/DiagramEditor.tsx`.

The editor reuses the same SVG field rendering as `DiagramRenderer.tsx` but adds touch interaction layers on top. Both files share the same constants (YARD, FIELD_W, FIELD_H, VIEWBOX, etc.) and types (`DiagramData`, `Cone`, `Path`, `Route`, `RouteSegment`, `RouteWaypoint`, `BallPath` from `types/diagram.ts`).

### Touch handling approach

React Native SVG does not support pointer events the same way web SVG does. Use `PanResponder` from React Native attached to a wrapping `View` around the SVG, then convert touch coordinates to SVG coordinates manually.

```typescript
import { PanResponder, View, LayoutRectangle } from "react-native";

// Store the layout of the SVG container
const [layout, setLayout] = useState<LayoutRectangle | null>(null);

// Convert screen touch coords to SVG coords
const touchToSvg = (pageX: number, pageY: number) => {
  if (!layout) return { x: 0, y: 0 };
  const relX = pageX - layout.x;
  const relY = pageY - layout.y;
  const svgX = (relX / layout.width) * VIEW_W - PAD_LEFT;
  const svgY = (relY / layout.height) * VIEW_H - PAD_Y;
  return { x: svgX, y: svgY };
};
```

Wrap the Svg in a View that captures layout and pan gestures:

```typescript
<View
  onLayout={(e) => setLayout(e.nativeEvent.layout)}
  {...panResponder.panHandlers}
>
  <Svg viewBox={VIEWBOX} ...>
    {/* field + interactive elements */}
  </Svg>
</View>
```

### PanResponder setup

Create a single PanResponder on the container View. It handles:

1. **Tap detection:** `onPanResponderRelease` where the touch didn't move beyond `DRAG_THRESHOLD` (2 SVG units)
2. **Drag detection:** `onPanResponderMove` where the touch moved beyond the threshold
3. **Hit testing:** On touch start, check if the touch landed on a cone (within `CONE_HIT_R = 10` SVG units) or a route waypoint (within `HIT_R = 18` SVG units)

```typescript
const panResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { pageX, pageY } = evt.nativeEvent;
      const svgPoint = touchToSvg(pageX, pageY);
      handleTouchStart(svgPoint);
    },
    onPanResponderMove: (evt) => {
      const { pageX, pageY } = evt.nativeEvent;
      const svgPoint = touchToSvg(pageX, pageY);
      handleTouchMove(svgPoint);
    },
    onPanResponderRelease: (evt) => {
      const { pageX, pageY } = evt.nativeEvent;
      const svgPoint = touchToSvg(pageX, pageY);
      handleTouchEnd(svgPoint);
    },
  })
).current;
```

**Important:** Use `useRef` for the PanResponder and access current state through refs (not stale closures). The PanResponder callbacks are created once, so they won't see updated state values. Use a pattern like:

```typescript
const dataRef = useRef(data);
dataRef.current = data;
const modeRef = useRef(mode);
modeRef.current = mode;
// ... etc for all state the handlers need
```

## Props

```typescript
interface DiagramEditorProps {
  value: DiagramData | null;
  onChange: (data: DiagramData) => void;
}
```

Same as the web version. The parent form owns the data; the editor calls `onChange` on every mutation.

## State

Port all state from the web `DiagramEditor`. The key pieces:

```typescript
const [mode, setMode] = useState<"normal" | "drawing" | "route" | "ballpath">("normal");
const [selectedId, setSelectedId] = useState<string | null>(null); // selected cone
const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
const [activeRouteId, setActiveRouteId] = useState<string | null>(null); // route being drawn
const [selectedBallPathId, setSelectedBallPathId] = useState<string | null>(null);
const [editingPathIdx, setEditingPathIdx] = useState<number | null>(null);
const [confirmingClear, setConfirmingClear] = useState(false);

// Path drawing state
const [pathFromId, setPathFromId] = useState<string | null>(null);
const [pathToId, setPathToId] = useState<string | null>(null);
const [pendingMovement, setPendingMovement] = useState<Path["movement"]>("sprint");
const [pendingYards, setPendingYards] = useState<string>("");
const [pathFormError, setPathFormError] = useState<string | null>(null);

// Route drawing state
const [pendingSegmentType, setPendingSegmentType] = useState<RouteSegment["type"]>("straight");
const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
const [insertMode, setInsertMode] = useState<"after" | "before">("after");

// Alignment guides
const [alignGuides, setAlignGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

// Drag tracking (use refs, not state, for performance)
const dragRef = useRef<{ coneId: string; startX: number; startY: number; moved: boolean } | null>(null);
const waypointDragRef = useRef<{ routeId: string; waypointId: string; startX: number; startY: number; moved: boolean } | null>(null);
```

## Helper functions

Port these exactly from the web version (they're pure logic, no DOM dependency):

- `emptyDiagram()` — returns `{ cones: [], paths: [], routes: [], ballPaths: [], gridScale: 1 }`
- `clamp(v, lo, hi)` — clamp a number
- `snap(v)` — snap to half-yard grid (`SNAP_STEP = YARD / 2`)
- `calcYards(from, to)` — distance between two cones in yards
- `nextConeId(cones)`, `nextQBId(cones)`, `nextFootballId(cones)`, `nextRouteId(routes)`, `nextWaypointId(waypoints)`, `nextBallPathId(ballPaths)` — ID generators
- `nextConePosition(cones)`, `nextQBPosition(cones)`, `nextFootballPosition(cones)` — auto-placement for new items
- `zigzagPoints(from, to)`, `curveControlPoint(from, to)`, `lastSegmentArrowDirection(prev, last, seg)` — already in DiagramRenderer, import or share

## Touch interaction logic

### handleTouchStart(svgPoint)

1. **Hit test cones:** Loop through `data.cones`, find nearest cone within `CONE_HIT_R` (10 SVG units). If found and mode is "normal", start a drag (`dragRef.current = { coneId, startX, startY, moved: false }`).
2. **Hit test waypoints:** If mode is "normal" and a route is selected, check waypoints within `HIT_R` (18 SVG units). If found, start a waypoint drag.
3. **Hit test paths:** If mode is "normal", check if touch is near any path line or route segment (within `PATH_HIT_STROKE / 2 = 8` SVG units of the line).

### handleTouchMove(svgPoint)

1. If `dragRef.current` exists: check if moved beyond `DRAG_THRESHOLD` (2 SVG units). If yes, set `moved = true` and call `moveConeTo()` with alignment guide logic.
2. If `waypointDragRef.current` exists: same threshold check, then `moveWaypointTo()`.
3. While dragging, update `alignGuides` state to show snap guidelines on the field.

### handleTouchEnd(svgPoint)

1. **If dragging a cone and `moved` is false:** This was a tap. Select the cone (`setSelectedId`).
2. **If dragging a cone and `moved` is true:** Drag completed. Clear `alignGuides`.
3. **If dragging a waypoint and `moved` is false:** Select the waypoint.
4. **If no drag was active (background tap):**
   - Mode "normal": deselect everything
   - Mode "route": call `addRouteWaypoint()` at the touch point
   - Mode "ballpath": call `placeBallPathTarget()` at the touch point
   - Mode "drawing": ignore (path drawing uses cone taps, not background taps)
5. **If mode is "drawing" and a cone was tapped:** call `onConeTapInDrawing(coneId)` to set path from/to.

Clear `dragRef` and `waypointDragRef` on every touch end.

## SVG rendering

Use the same SVG elements as `DiagramRenderer.tsx` but add visual feedback for interactive states:

### Field
Reuse the `FootballField` component from DiagramRenderer (same yard lines, hash marks, sidelines, numbers).

### Alignment guides
When dragging a cone near another cone's X or Y position (within `ALIGN_THRESHOLD = 0.5 * YARD`), show dashed orange guide lines:

```tsx
{alignGuides.x !== null && (
  <Line x1={alignGuides.x} y1={0} x2={alignGuides.x} y2={FIELD_H}
    stroke="#D48A30" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.7} />
)}
{alignGuides.y !== null && (
  <Line x1={0} y1={alignGuides.y} x2={FIELD_W} y2={alignGuides.y}
    stroke="#D48A30" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.7} />
)}
```

### Cones
Render each cone as:
- Regular cone: `<Circle>` with `r={CONE_R}` (4), fill orange (`#D48A30`), blue when selected (`#2563EB`)
- QB marker: Slightly larger circle (`r={CONE_R+1}`), yellow fill (`#EAB308`), "QB" text inside
- Football: `<Ellipse>` with `rx={6} ry={3.5}`, brown fill (`#5C3A1E`), white laces

Selected items get blue fill and ring.

### Paths (cone-to-cone movement paths)
Line from cone A to cone B with movement-specific styling (same as DiagramRenderer MOVEMENT_STYLES). Label showing yard distance at the midpoint offset perpendicular to the line. Selected path has thicker stroke.

### Routes
Render segments using `renderRouteSegment()` (straight=Line, zigzag=Polyline, curve=quadratic Path). Arrow at the end point. Open circle at the start point. When a route is selected, show draggable waypoint dots. When actively drawing, show small dots at interior waypoints.

### Ball paths
Dashed brown line from football to target. Selected ball path gets thicker stroke.

## Toolbar (below the SVG)

The toolbar is a horizontal scrollable row of buttons below the field. Unlike web where all buttons can fit in a row, mobile needs a compact layout.

### Layout

```tsx
<ScrollView horizontal showsScrollIndicator={false} style={{ marginTop: 12 }}>
  <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 4 }}>
    {/* buttons */}
  </View>
</ScrollView>
```

### Buttons (all 44px min height, surface-raised bg, border-subtle border, rounded-xl)

1. **"+ Cone"** — calls `handleAddCone()`. Disabled when mode !== "normal".
2. **"+ QB"** — calls `handleAddQB()`. Disabled when mode !== "normal".
3. **"+ Football"** — calls `handleAddFootball()`. Disabled when mode !== "normal".
4. **"+ Route"** — toggles route drawing mode. Orange bg when active.
5. **"Clear All"** — two-tap confirm pattern (first tap shows "Are you sure?", second tap clears).

When mode is "route" and actively drawing:
- Show segment type pills below the toolbar: "Straight", "Cut", "Curve"
- Show "Done" (primary orange), "Undo" (secondary), "Cancel" (text) buttons

## Context panels (below toolbar, shown conditionally)

These panels appear when something is selected. Use a `surface-raised` card with `border-subtle` border, `rounded-xl`, 16px padding.

### Selected Cone panel
- Shows when `selectedId` is set and mode is "normal"
- Label input: TextInput to edit the cone's label (pre-filled with current label)
- If cone is a football: "+ Add Pass Line" button (starts ballpath mode)
- "Delete" button (red text) and "Done" button (secondary text)

### Selected Route panel
- Shows when `selectedRouteId` is set and mode is "normal"
- "Continue" button (primary orange) — resumes drawing from the route's end
- "Delete Point" button — shown only when a waypoint is selected
- "Delete Route" button (red text)
- "Done" button

### Selected Ball Path panel
- Shows when `selectedBallPathId` is set
- "Delete" button (red text) and "Done" button

### Edit Path panel
- Shows when `editingPathIdx` is set (user tapped a cone-to-cone path)
- Movement type pills: Sprint, Backpedal, Shuffle, Jog
- Yards input: number input with "yards" suffix
- "Update" / "Delete Path" / "Cancel" buttons

### Ball Path mode banner
- Shows when mode is "ballpath"
- Text: "Tap a player or any point to draw the pass line"
- "Cancel" button

### Route drawing mode banner
- Shows when mode is "route"
- Text: "Tap the field to place route points"
- Segment type pills (Straight / Cut / Curve)

## Port the action handlers

Port all handler functions from the web `DiagramEditor.tsx`. They are pure state manipulation — no DOM APIs. The key ones:

- `handleAddCone()`, `handleAddQB()`, `handleAddFootball()` — create new items at auto-calculated positions
- `handleStartRouteDrawing()`, `finishActiveRoute()`, `handleCancelRoute()`, `handleContinueRoute()` — route drawing lifecycle
- `addRouteWaypoint(x, y)` — add waypoint at SVG coordinates (converted from touch, not clientX/clientY like web)
- `handleUndoLastWaypoint()` — remove last placed waypoint
- `handleDeleteWaypoint()`, `handleDeleteRoute()` — delete route elements
- `moveConeTo(coneId, svgX, svgY)` — move a cone with alignment snapping (takes SVG coords directly, not clientX/clientY)
- `moveWaypointTo(routeId, waypointId, svgX, svgY)` — move a waypoint
- `handleConfirmPath()`, `handleDeletePath()` — path CRUD
- `handleStartBallPath()`, `placeBallPathTarget(svgX, svgY)`, `handleCancelBallPath()`, `handleDeleteBallPath()` — ball path lifecycle
- `handleLabelChange(label)` — update cone label
- `handleDeleteSelected()` — delete selected cone and associated paths/ballpaths
- `handleClearAll()` — two-tap confirm clear

**Key difference from web:** The web version uses `screenToSvg(clientX, clientY)` to convert DOM coordinates. The mobile version uses `touchToSvg(pageX, pageY)` which converts from RN's page coordinates using the View's layout. Pass SVG coordinates directly to the handler functions instead of screen coordinates.

## Integration into drill forms

After creating the editor component, update the drill create (`app/(tabs)/drills/new.tsx`) and edit (`app/(tabs)/drills/[id]/edit.tsx`) forms:

1. Remove the placeholder text that says "Setup diagrams can be added on the web version."
2. Add a "Setup Diagram" section with the `DiagramEditor`:

```tsx
import DiagramEditor from "../../../components/DiagramEditor";

// In form state:
const [diagramData, setDiagramData] = useState<DiagramData | null>(null);

// In the form JSX, between Equipment and Save buttons:
<View style={{ marginTop: 24 }}>
  <Text style={{ fontSize: 11, fontWeight: "500", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
    Setup Diagram
  </Text>
  <DiagramEditor value={diagramData} onChange={setDiagramData} />
</View>
```

3. Include `setup_diagram: diagramData` in the Supabase insert/update payloads.
4. On the edit form, pre-populate `diagramData` from `drill.setup_diagram` when the drill loads.

## Also update the drill detail view

The drill detail screen (`app/(tabs)/drills/[id]/index.tsx`) should show the read-only `DiagramRenderer` when the drill has diagram data:

```tsx
{drill.setup_diagram && (
  <View style={{ marginTop: 24 }}>
    <Text style={{ fontSize: 11, fontWeight: "500", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
      Setup Diagram
    </Text>
    <DiagramRenderer data={drill.setup_diagram} />
  </View>
)}
```

If this is already present from a previous build, verify it still works correctly.

## Design rules

- Dark mode. surface-base background, surface-raised panels.
- Two font weights: normal (400) and medium (500). Never bold.
- The SVG field itself has a WHITE background (same as web) — it's a diagram, not a dark UI element.
- Toolbar buttons: surface-raised bg, border-subtle border, 44px min height, rounded-xl.
- Active/selected state: orange bg at 15% opacity with orange text and border.
- Selected items on the field: blue (#2563EB) fill/stroke.
- Touch targets: generous. Cones have a 10-unit hit radius, waypoints have 18-unit hit radius. These are critical on mobile where fingers are imprecise.
- Haptic feedback (light impact) on: cone placement, waypoint placement, cone selection, route finish.
- The field should maintain its aspect ratio and fill the available width.

## Testing

1. Open the drill create form. The diagram editor should appear with an empty field.
2. Tap "+ Cone". A cone should appear on the field near the line of scrimmage.
3. Tap "+ Cone" again. A second cone should appear 5 yards upfield from the first.
4. Touch and drag the first cone. It should move smoothly following your finger. Alignment guides should appear when near another cone's row or column.
5. Tap a cone (without dragging). The "Selected Cone" panel should appear below with label input and delete button.
6. Type a label ("Start"). The cone's label should update.
7. Tap "+ QB". A QB marker should appear centered at the line of scrimmage.
8. Tap "+ Football". A football should appear on the field.
9. Select the football. Tap "+ Add Pass Line". Tap anywhere on the field. A dashed brown line should appear from the football to the tap point.
10. Tap "+ Route". The button should turn orange. Tap 3 points on the field. Route segments should appear connecting them. Tap "Done". The route should finalize with an arrowhead.
11. While drawing a route, switch segment type to "Cut" or "Curve" using the pills. The next segment should use that style.
12. Tap "Undo" while drawing a route. The last waypoint should be removed.
13. Tap a completed route. The "Selected Route" panel should appear. Waypoint dots should appear on the route.
14. Drag a waypoint on a selected route. The route should reshape.
15. Tap "Continue" on a selected route. Resume adding waypoints.
16. Tap "Delete Route". The route should be removed.
17. Tap "Clear All". Confirm. All items should be removed.
18. Build a complete drill diagram (cones, QB, paths, routes, football, pass line). Save the drill. Open the detail view. The read-only diagram should display correctly.
19. Edit the drill. The diagram editor should pre-populate with all previously saved diagram data.
20. Verify the diagram data round-trips correctly through Supabase (save, reload, all elements intact).
