# Build 7c: Route Drawing - Zigzag & Curve Segments

Read `CLAUDE.md` for design system and patterns. Read `src/types/diagram.ts` for the Route/RouteSegment types added in Build 7b. Read `src/components/DiagramEditor.tsx` and `src/components/DiagramRenderer.tsx` to see the current route rendering.

## Context

Build 7b added straight-line route drawing. Routes are series of connected waypoints with straight lines between them. This build adds two more segment types: zigzag (sharp cuts) and curve (smooth arcs). These let captains diagram realistic routes like out routes, slants, wheel routes, and post-corners.

## Task 1: Segment type selector during route drawing

When in `"route"` mode and actively drawing a route (after the first waypoint is placed), show a segment type picker below the canvas. The captain selects the type BEFORE tapping the next waypoint.

Three options, styled as tappable pills (same style as the movement type buttons in the existing path form):

- **Straight** (default, selected on entry) — direct line
- **Cut** — sharp angle break (the zigzag). Use "Cut" as the label because that's what flag football players call it.
- **Curve** — smooth arc

The selected segment type applies to the NEXT segment drawn. So the flow is:
1. Tap first waypoint (start point placed)
2. Segment picker appears, defaulting to "Straight"
3. Captain can change to "Cut" or "Curve"
4. Captain taps next waypoint
5. That segment is drawn with the selected type
6. Picker resets to "Straight" for the next segment (or stays on the same type — let's keep it on whatever was last selected so the captain doesn't have to re-tap for consecutive cuts)

Update the state:
```typescript
const [pendingSegmentType, setPendingSegmentType] = useState<RouteSegment["type"]>("straight");
```

When adding a waypoint to the active route, use `pendingSegmentType` instead of hardcoding `"straight"`.

## Task 2: Zigzag (cut) segment rendering

A zigzag segment represents a sharp cut/break. Instead of a straight line from A to B, it renders as two line segments forming a V or angle.

How to calculate the cut point:
1. Find the midpoint between waypoint A and waypoint B
2. Calculate the perpendicular direction to the A-to-B line
3. Offset the midpoint along the perpendicular by a fixed amount (8 SVG units, roughly 0.8 yards)
4. The cut point goes to the LEFT of the direction of travel (from A to B)

This creates a sharp angle: line from A to cut point, then line from cut point to B.

```typescript
function zigzagPoints(from: RouteWaypoint, to: RouteWaypoint): { cx: number; cy: number } {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular (rotated 90 degrees counter-clockwise = left of direction)
  const px = -dy / len;
  const py = dx / len;
  const offset = 8; // SVG units
  return { cx: mx + px * offset, cy: my + py * offset };
}
```

Render as a polyline (two connected straight segments):
```jsx
const { cx, cy } = zigzagPoints(from, to);
<polyline
  points={`${from.x},${from.y} ${cx},${cy} ${to.x},${to.y}`}
  fill="none"
  stroke="#D48A30"
  strokeWidth={3}
  strokeLinecap="round"
  strokeLinejoin="round"
/>
```

The sharp join (strokeLinejoin="round" with a small radius or "miter") makes the cut look clean. Use "round" to keep it smooth at the angle.

## Task 3: Curve segment rendering

A curve segment is a smooth arc from A to B, rendered as an SVG quadratic bezier curve.

How to calculate the control point:
1. Same as zigzag: find the perpendicular direction at the midpoint
2. Offset by a larger amount (16 SVG units, roughly 1.6 yards) to create a visible arc
3. Control point goes to the LEFT of the direction of travel

```typescript
function curveControlPoint(from: RouteWaypoint, to: RouteWaypoint): { cx: number; cy: number } {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const offset = 16; // SVG units — larger arc than zigzag
  return { cx: mx + px * offset, cy: my + py * offset };
}
```

Render as an SVG path with a quadratic bezier (Q command):
```jsx
const { cx, cy } = curveControlPoint(from, to);
<path
  d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
  fill="none"
  stroke="#D48A30"
  strokeWidth={3}
  strokeLinecap="round"
/>
```

## Task 4: Update the segment rendering switch

Replace the straight-line-only rendering from Build 7b with a function that handles all three types:

```typescript
function renderRouteSegment(
  from: RouteWaypoint,
  to: RouteWaypoint,
  segment: RouteSegment,
  index: number
): React.ReactNode {
  switch (segment.type) {
    case "zigzag": {
      const { cx, cy } = zigzagPoints(from, to);
      return (
        <polyline
          key={`rs-${index}`}
          points={`${from.x},${from.y} ${cx},${cy} ${to.x},${to.y}`}
          fill="none"
          stroke="#D48A30"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      );
    }
    case "curve": {
      const { cx, cy } = curveControlPoint(from, to);
      return (
        <path
          key={`rs-${index}`}
          d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
          fill="none"
          stroke="#D48A30"
          strokeWidth={3}
          strokeLinecap="round"
          pointerEvents="none"
        />
      );
    }
    default: // "straight"
      return (
        <line
          key={`rs-${index}`}
          x1={from.x} y1={from.y}
          x2={to.x} y2={to.y}
          stroke="#D48A30"
          strokeWidth={3}
          strokeLinecap="round"
          pointerEvents="none"
        />
      );
  }
}
```

Use this in BOTH DiagramEditor and DiagramRenderer wherever route segments are rendered. Extract it to a shared util or duplicate in both files (duplication is fine for two components).

## Task 5: Update arrowhead calculation for curves

The arrowhead at the end of a route needs to point in the correct direction. For straight segments, this is just the direction from the second-to-last waypoint to the last. But for curve segments, the arrow should follow the tangent of the curve at the endpoint.

For a quadratic bezier Q with control point (cx, cy) ending at point B:
- The tangent at the endpoint is the direction from the control point to B
- So the arrowhead direction = (B.x - cx, B.y - cy), normalized

For a zigzag, the final direction is from the cut point to B.

Update the arrowhead calculation:
```typescript
// Get the effective "approach direction" for the last segment
const lastSeg = route.segments[route.segments.length - 1];
const prevWp = route.waypoints[route.waypoints.length - 2];
const lastWp = route.waypoints[route.waypoints.length - 1];

let arrowDx: number, arrowDy: number;

if (lastSeg?.type === "curve") {
  const { cx, cy } = curveControlPoint(prevWp, lastWp);
  arrowDx = lastWp.x - cx;
  arrowDy = lastWp.y - cy;
} else if (lastSeg?.type === "zigzag") {
  const { cx, cy } = zigzagPoints(prevWp, lastWp);
  arrowDx = lastWp.x - cx;
  arrowDy = lastWp.y - cy;
} else {
  arrowDx = lastWp.x - prevWp.x;
  arrowDy = lastWp.y - prevWp.y;
}
```

## Task 6: Update hit targets for route selection

The invisible fat hit-target lines need to follow the same geometry as the visible segments:

- Straight: fat transparent `<line>` (already from 7b)
- Zigzag: fat transparent `<polyline>` with the same points
- Curve: fat transparent `<path>` with the same bezier, using a fat strokeWidth

All hit targets should have `strokeWidth={16}`, `stroke="transparent"`, and `cursor="pointer"` in normal mode.

## Task 7: Apply to both components

All rendering changes (the three segment types, arrowhead calculation) must be applied to both:
- `DiagramEditor.tsx` (interactive)
- `DiagramRenderer.tsx` (read-only)

The segment type picker UI only exists in the editor.

## Design rules

- Segment picker pills: same visual style as the movement type buttons in the existing path form. Dark background, orange border + text when selected.
- All route lines stay orange-500 (#D48A30), 3px stroke.
- Zigzag cuts should look sharp and deliberate, not rounded.
- Curves should look smooth and natural.
- The segment picker only shows during active route drawing (not when a route is selected for viewing/deletion).

## Testing

1. Start drawing a route. Default segment type is "Straight". Tap two points. Verify a straight line draws between them.
2. Switch to "Cut". Tap a third point. Verify a sharp angled line (zigzag) draws from the second point to the third.
3. Switch to "Curve". Tap a fourth point. Verify a smooth arc draws from the third point to the fourth.
4. Finish the route. Verify the arrowhead points in the correct direction (following the tangent of the last segment, whether straight, cut, or curve).
5. Save the drill. Reload. All three segment types should render correctly in both the edit view and the read-only detail page.
6. Tap the route in normal mode. Selection should work for routes with mixed segment types.
7. Create a route with all straight segments, one with all cuts, one with all curves. Verify each looks correct.
8. Test a "comeback route": straight up, then a cut back down. The zigzag should angle correctly.
9. Test a "wheel route": curve arcing from the backfield out wide. The bezier should arc smoothly.
