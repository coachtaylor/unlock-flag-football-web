# Build 7b: Route Drawing - Data Model + Straight Lines

Read `CLAUDE.md` for design system and patterns. Read `src/types/diagram.ts`, `src/components/DiagramEditor.tsx`, and `src/components/DiagramRenderer.tsx`.

## Context

The diagram builder currently supports cones (equipment markers) and paths (cone-to-cone connections showing movement type). This build adds a new concept: player routes. A route represents where a player lines up on the field and the path they run. Routes are drawn freely on the field (not tied to cones) and consist of connected waypoints.

This build adds the data model and straight-line route drawing only. Zigzag and curve segments come in Build 7c.

## Task 1: Update the data model (`src/types/diagram.ts`)

Add these new types:

```typescript
export interface RouteWaypoint {
  id: string;
  x: number;
  y: number;
}

export interface RouteSegment {
  type: "straight" | "zigzag" | "curve";
}

export interface Route {
  id: string;
  waypoints: RouteWaypoint[];
  segments: RouteSegment[]; // segments[i] describes the line from waypoints[i] to waypoints[i+1]
}
```

Update `DiagramData`:

```typescript
export interface DiagramData {
  cones: Cone[];
  paths: Path[];
  routes: Route[];
  gridScale: number;
}
```

## Task 2: Update DiagramEditor to handle routes

### Backward compatibility

Anywhere the editor reads `value` (the DiagramData prop), handle missing `routes`:

```typescript
const data: DiagramData = value
  ? { ...value, routes: value.routes ?? [] }
  : emptyDiagram();
```

Update `emptyDiagram()`:

```typescript
function emptyDiagram(): DiagramData {
  return { cones: [], paths: [], routes: [], gridScale: 1 };
}
```

### New mode: "route"

Add `"route"` to the Mode type:

```typescript
type Mode = "normal" | "drawing" | "route";
```

Add state for route drawing:

```typescript
const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
```

### "Draw Route" button

Add a new button to the toolbar (next to "+ Add Cone" and "+ Add Path"):

```
+ Draw Route
```

When tapped:
1. Set mode to `"route"`
2. Create a new Route object with a unique id, empty waypoints, empty segments
3. Set `activeRouteId` to the new route's id
4. Deselect any selected cone or path

### Drawing a route (tapping the field)

When in `"route"` mode and tapping the SVG background:
1. Convert the tap position to SVG coordinates (use existing `screenToSvg`)
2. Snap to the yard grid (use existing `snap` and `clamp` functions)
3. Add a new waypoint to the active route
4. If this is the 2nd+ waypoint, also add a segment: `{ type: "straight" }` (straight is the only option for now)
5. Update the diagram data

The route draws in real-time as waypoints are added: each new tap extends the route with a straight line from the previous point.

### Finishing a route

Two ways to finish:
1. A "Done" button appears in the toolbar when in route mode with 2+ waypoints
2. Tapping the last waypoint again finishes the route (double-tap shortcut)

When finished:
- If the route has fewer than 2 waypoints, discard it (remove from data)
- Set mode back to `"normal"`
- Clear `activeRouteId`

### Route rendering on the SVG

Render routes AFTER paths but BEFORE cones (so cones sit on top). For each route:

```jsx
<g key={route.id}>
  {/* Line segments */}
  {route.segments.map((seg, i) => {
    const from = route.waypoints[i];
    const to = route.waypoints[i + 1];
    if (!from || !to) return null;
    // For now, all segments are straight lines
    return (
      <line
        key={`rs-${i}`}
        x1={from.x} y1={from.y}
        x2={to.x} y2={to.y}
        stroke="#D48A30"
        strokeWidth={3}
        strokeLinecap="round"
      />
    );
  })}

  {/* Arrowhead at the last waypoint */}
  {route.waypoints.length >= 2 && (() => {
    const last = route.waypoints[route.waypoints.length - 1];
    const prev = route.waypoints[route.waypoints.length - 2];
    const dx = last.x - prev.x;
    const dy = last.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const arrowSize = 6;
    // Two points behind the arrowhead tip, angled out
    const p1x = last.x - ux * arrowSize + uy * (arrowSize / 2);
    const p1y = last.y - uy * arrowSize - ux * (arrowSize / 2);
    const p2x = last.x - ux * arrowSize - uy * (arrowSize / 2);
    const p2y = last.y - uy * arrowSize + ux * (arrowSize / 2);
    return (
      <polygon
        points={`${last.x},${last.y} ${p1x},${p1y} ${p2x},${p2y}`}
        fill="#D48A30"
      />
    );
  })()}

  {/* Start point marker (small filled circle, slightly different from cones) */}
  {route.waypoints.length > 0 && (
    <circle
      cx={route.waypoints[0].x}
      cy={route.waypoints[0].y}
      r={5}
      fill="none"
      stroke="#D48A30"
      strokeWidth={2}
    />
  )}

  {/* Waypoints during active drawing (small dots to show where taps landed) */}
  {activeRouteId === route.id && route.waypoints.map((wp, i) => (
    i > 0 && i < route.waypoints.length - 1 ? (
      <circle
        key={wp.id}
        cx={wp.x}
        cy={wp.y}
        r={2}
        fill="#D48A30"
        opacity={0.6}
      />
    ) : null
  ))}
</g>
```

Visual design:
- Route lines: orange-500 (#D48A30), 3px stroke width, round caps
- Start point: open circle (no fill, orange stroke), radius 5. This distinguishes "player lines up here" from cones.
- End point: arrowhead pointing in the direction of the final segment
- Active drawing waypoints: tiny dots (r=2) so the captain can see where they tapped

### Selecting a route (normal mode)

In normal mode, tapping a route line selects it. Add invisible fat hit-target lines (like existing path hit targets) for each route segment.

When a route is selected:
- Show a panel below the canvas: "Selected Route" with a "Delete Route" button
- Highlight the route (increase stroke width to 5, or add a glow)
- Set `selectedRouteId`

Tapping the background deselects routes (same as cones).

### Toolbar state in route mode

When in `"route"` mode, disable the "+ Add Cone" and "+ Add Path" buttons (same pattern as drawing mode disables "+ Add Cone").

Show a status message: "Tap the field to place route points" (replacing the cone count text temporarily).

Show a "Done" button (styled like the primary orange CTA but smaller) when 2+ waypoints exist. Show a "Cancel" button to discard and exit.

### Helper functions

```typescript
function nextRouteId(routes: Route[]): string {
  let n = routes.length + 1;
  const ids = new Set(routes.map((r) => r.id));
  while (ids.has(`r${n}`)) n++;
  return `r${n}`;
}

function nextWaypointId(waypoints: RouteWaypoint[]): string {
  let n = waypoints.length + 1;
  const ids = new Set(waypoints.map((w) => w.id));
  while (ids.has(`w${n}`)) n++;
  return `w${n}`;
}
```

## Task 3: Update DiagramRenderer

Add route rendering to the read-only renderer. Same visual treatment as the editor (orange lines, arrowhead, open-circle start point) but no interaction, no hit targets, no active-drawing state.

Handle backward compat:
```typescript
const routes = data.routes ?? [];
```

Add routes to the movement legend at the bottom if routes exist:
```jsx
{routes.length > 0 && (
  <div className="flex items-center gap-xs">
    <svg width={20} height={6} aria-hidden="true">
      <line x1={0} y1={3} x2={20} y2={3} stroke="#D48A30" strokeWidth={3} strokeLinecap="round" />
    </svg>
    <span className="text-micro" style={{ color: "var(--color-text-secondary)" }}>
      Route
    </span>
  </div>
)}
```

## Task 4: Update generate-setup-instructions.ts

Add a note about routes if any exist:

```typescript
if (data.routes && data.routes.length > 0) {
  // Append route count
  instructions += ` ${data.routes.length} player route${data.routes.length === 1 ? "" : "s"} drawn.`;
}
```

This is minimal for now. Routes are primarily visual, not text-instructional.

## Design rules

- Dark mode app chrome. White canvas for the field (already in place).
- Route lines are orange-500 (#D48A30), 3px wide, round line caps.
- Start point is an open circle (distinguishes from filled cone dots).
- Arrowhead at the endpoint shows direction of travel.
- The toolbar and panels below the canvas use the same dark surface-raised style as existing cone/path panels.
- All new buttons follow the existing button styles (surface-raised background, border-default, text-caption font-medium).

## Testing

1. Open a drill with an existing diagram (cones + paths). It should render exactly as before (no routes = no change).
2. Create a new drill. Add cones. Then tap "Draw Route". Tap 3-4 spots on the field. Lines should draw between each tap. Tap "Done". The route should persist with an arrowhead at the end.
3. Save the drill. Reload. The route should still be there in both the edit view and the detail page (read-only renderer).
4. Draw a route, then cancel. It should be discarded.
5. Draw a route with only 1 tap, then tap "Done". It should be discarded (need 2+ waypoints).
6. In normal mode, tap a route line. The "Selected Route" panel should appear with a delete button.
7. Delete a route. It should disappear from the field and the data.
