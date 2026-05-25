# Build 7d: Continue Editing an Existing Route

Read `CLAUDE.md` for design system and patterns. Read `src/components/DiagramEditor.tsx` to see the current route drawing and selection logic.

## Context

When a captain finishes drawing a route and later wants to extend it (add more waypoints) or edit it, they currently have to delete the whole route and start over. That's too destructive. Captains should be able to tap a completed route and continue building from where they left off, or edit individual waypoints.

## Changes to DiagramEditor.tsx

### 1. "Continue Route" option when a route is selected

When a route is selected in normal mode (the "Selected Route" panel is showing), add a "Continue" button next to the "Delete Route" button.

When "Continue" is tapped:
1. Set mode to `"route"`
2. Set `activeRouteId` to the selected route's id
3. The captain can now tap the field to add more waypoints to the END of the existing route
4. The segment type picker should appear (same as during initial drawing)
5. "Done" finishes and returns to normal mode
6. "Cancel" discards only the NEW waypoints added during this editing session (not the original route)

To support cancel-without-losing-original-data, snapshot the route's waypoints and segments when entering continue mode:

```typescript
const [routeSnapshot, setRouteSnapshot] = useState<{ waypoints: RouteWaypoint[]; segments: RouteSegment[] } | null>(null);
```

When entering continue mode, save the snapshot. On cancel, restore the route to the snapshot. On done/confirm, clear the snapshot.

### 2. Draggable waypoints when a route is selected

When a route is selected in normal mode, render its waypoints as visible draggable dots (similar to how cones are draggable):

- Show each waypoint as a small circle (r=4, orange fill, or blue for a selected/dragged waypoint)
- Waypoints are draggable using the same pointer event pattern as cones (pointerdown → pointermove → pointerup with drag threshold)
- Waypoints snap to the yard grid (same snap function as cones)
- Dragging a waypoint updates the route in real-time

This lets captains adjust the shape of a route without redrawing it.

Implementation:
- Only render draggable waypoint handles when `selectedRouteId` matches the route
- Use the same `screenToSvg`, `snap`, `clamp` functions
- Add waypoint drag state similar to cone dragging:

```typescript
const waypointDragRef = useRef<{
  routeId: string;
  waypointId: string;
  moved: boolean;
  pointerId?: number;
} | null>(null);
```

Handle pointer events on waypoint circles the same way cone pointer events work. On move, update the waypoint's x/y in the route data.

### 3. Delete individual waypoints

When a route is selected and the captain taps a waypoint (without dragging), show a small option to delete that waypoint. Simplest approach: tapping a waypoint selects it (highlight it blue), and a "Delete Point" button appears in the route panel below.

When a waypoint is deleted:
- Remove it from the waypoints array
- Remove the segment that connected TO it (segments[i-1] if deleting waypoint[i])
- If deleting the first waypoint, remove segments[0] instead
- If the route ends up with fewer than 2 waypoints, delete the entire route
- Update the diagram data

### 4. Updated "Selected Route" panel

When a route is selected, the panel below the canvas should show:

```
Selected Route
[Continue]  [Delete Point]  [Delete Route]

(segment type picker only shows when in continue/route mode)
```

- "Continue" — enters route mode to extend the route (described above)
- "Delete Point" — only enabled when a specific waypoint is tapped/selected within the route. Disabled/hidden otherwise.
- "Delete Route" — deletes the entire route (already exists)
- "Done" button to deselect — same as the existing cone "Done" button

### 5. Visual feedback for selected route

When a route is selected in normal mode:
- Increase the route's stroke width slightly (3 → 4) or add a subtle glow/outline
- Show waypoint handles as visible dots (r=4)
- The currently selected waypoint within the route (if any) should be blue, others orange

## What NOT to change

- DiagramRenderer.tsx (read-only, no editing needed)
- Route drawing for NEW routes (the initial draw flow from 7b stays the same)
- Cone editing (selection, dragging, deletion all stay the same)
- Path editing (existing cone-to-cone path editing stays the same)
- The data model in diagram.ts (no type changes needed)

## Testing

1. Draw a route with 3 waypoints. Tap "Done". Tap the route to select it. Verify the "Selected Route" panel appears with "Continue", "Delete Route", and "Done" buttons.
2. Tap "Continue". Tap 2 more spots on the field. Verify the route extends from where it left off. Tap "Done". Verify the route now has 5 waypoints total.
3. Tap "Continue", add a waypoint, then tap "Cancel". Verify the route goes back to its state before you tapped "Continue" (the new waypoint is discarded).
4. Select a route. Verify waypoint handles appear as small dots on the route. Drag a waypoint to a new position. Verify the route redraws in real-time.
5. Select a route, tap a waypoint handle. Verify it highlights. Tap "Delete Point". Verify that waypoint and its connecting segment are removed.
6. Delete waypoints until only 1 remains. Verify the entire route is auto-deleted.
7. Select a route, tap "Delete Route". Verify the entire route is removed.
8. Draw a route, finish it, then immediately tap it and continue. Verify the flow is smooth without any glitches.
