# Build 7: Diagram Builder v2 - Player Routes & Visual Polish

## Problem Statement

The diagram builder currently works as a cone-placement and path-drawing tool for drill setups. It does its job for showing where to place cones and the movement between them, but it's missing a key piece: showing where players line up and the routes they run. Captains need to diagram not just equipment layout, but the actual player movements through a drill. Think of it like Playmaker X, where you can draw routes on the field (straight lines, sharp cuts, and curved routes) starting from wherever a player lines up.

On top of that, the current visuals are a bit heavy. Cone dots are larger than they need to be, the labels below each cone add clutter, and the selected-cone color doesn't stand out enough from the default state. These small things add up to a diagram that feels more like a technical schematic than a clean play diagram.

## Goals

1. Captains can diagram player routes on the field, not just cone-to-cone paths. A route can start from any point on the field (where the player lines up) and include straight segments, sharp angle cuts (zigzag), and curved/rounded segments.
2. The diagram visually reads like a play diagram (similar to Playmaker X), not a connect-the-dots between cones.
3. Cone dots are smaller and cleaner. No labels cluttering the field. Selected state is visually distinct (blue) from default (orange).
4. The existing cone-placement and equipment-setup functionality still works exactly as before. This is additive, not a replacement.

## Non-Goals

1. **Full playbook builder.** This is still a drill setup diagram, not a play designer with formations, defensive alignments, or multiple player assignments. That's a future feature.
2. **Animated route previews.** Routes are static drawings on the field. No animation or playback.
3. **Player identity on routes.** Routes don't need to be assigned to specific roster players. They're generic "a player does this" drawings.
4. **Undo/redo system.** Would be nice, but adds complexity that isn't worth it right now.

## User Stories

**As a captain building a drill diagram,** I want to draw a player's route on the field starting from their lineup position, so the team can see exactly where the player goes during the drill, not just where cones are placed.

**As a captain diagramming a route-running drill,** I want to draw a route with sharp cuts (like an out route or a slant) using zigzag segments, so the diagram shows direction changes accurately.

**As a captain diagramming a curved route (like a wheel or post-corner),** I want to draw a rounded/curved path segment, so routes with arcs look realistic instead of being forced into straight-line approximations.

**As a captain viewing a drill diagram,** I want to clearly see which cone is selected (blue highlight) versus which are just placed on the field (orange), so I can tell what I'm editing at a glance.

**As a captain viewing a completed drill diagram,** I want a clean field without text labels cluttering every cone, so the visual focus stays on the routes and overall drill layout.

## Requirements

### Must-Have (P0)

**7.1 - Route drawing (free-placement start point)**
Routes should be drawable starting from any point on the field, not just from an existing cone. This represents where a player lines up. The route is a series of connected segments (waypoints) that the captain draws one tap at a time.

How it works:
- Captain enters "Draw Route" mode (new button, replaces the current "+ Add Path" button)
- First tap on the field places the route's starting point (the player's lineup spot). This appears as a small circle or player icon.
- Each subsequent tap adds a waypoint. A line segment is drawn from the previous point to the new one.
- The captain can choose the segment type before tapping the next point: straight, zigzag (angled cut), or curve.
- Double-tap or a "Done" button finishes the route.
- The completed route is a single object with an ordered list of waypoints and segment types between them.

Acceptance criteria:
- A route can be started from any point on the field (not just on a cone)
- Routes support at least 2 waypoints (start + one destination) and up to 10+
- Each segment between waypoints can be independently set to straight, zigzag, or curve
- Routes snap to the yard grid (same snapping as cones)
- Routes are stored in the DiagramData and persist when the drill is saved
- Routes render in both DiagramEditor and DiagramRenderer

**7.2 - Three segment types**

Straight: a direct line from point A to point B. This is the default. Used for go routes, post routes, flat routes, or any linear movement.

Zigzag: a sharp-angled segment that represents a cut or break. Visually, this draws as two connected straight lines forming a V-shape or angle (like a slant-and-go or an out route). The cut point is automatically placed at the midpoint between the two waypoints, offset perpendicular to the direct line. The captain doesn't need to manually place the cut point.

Curve: a smooth arc from point A to point B. Used for wheel routes, corner routes, or any rounded path. Rendered as a quadratic or cubic bezier curve. The control point is auto-calculated to create a natural-looking arc. The curve direction (which side the arc bows toward) should be inferred from the previous segment's direction, or the captain can tap to flip it.

Acceptance criteria:
- All three segment types render correctly on the white field background
- Zigzag segments show a clear angle/break, not a smooth curve
- Curved segments show a smooth arc, not a sharp angle
- Segment type is selectable per-segment while drawing a route
- Path lines use the same color-coding as current movement types (orange for sprint, blue for backpedal, green for shuffle, gray for jog), OR use a single route color (orange-500) for simplicity. Decision: use a single orange-500 color for player routes. The movement-type color coding stays for cone-to-cone paths (equipment paths), which are a different concept.

**7.3 - Cone visual changes**

Smaller cone dots: reduce CONE_R from 6 to 4 SVG units. Keep HIT_R at 18 (the invisible tap target stays large for usability).

Remove cone labels: stop rendering the text element below each cone. The number/label text that currently shows "1", "2", "Start", etc. goes away entirely on the field. Cone labels still exist in the data model (for setup instructions generation), but they don't render on the SVG.

Selected cone color: when a cone is selected (tapped in normal mode), change its fill and stroke to blue (#2563EB) instead of orange. Unselected cones stay orange (#D48A30). During path-drawing mode, the "from" cone still highlights blue (this already works).

Acceptance criteria:
- Cone radius is 4 SVG units in both DiagramEditor and DiagramRenderer
- No text labels render below cones on the field SVG
- Selected cone is blue (#2563EB), unselected is orange (#D48A30)
- The "Selected Cone" panel below the field still works (shows label input, delete button)
- The setup instructions generator still has access to cone labels (data model unchanged)
- Tap target size (HIT_R) remains 18 so cones are easy to select on mobile

**7.4 - Update DiagramData type**

The `diagram.ts` types need a new `Route` interface and `routes` array on `DiagramData`:

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
  segments: RouteSegment[]; // segments[i] connects waypoints[i] to waypoints[i+1]
  color?: string; // defaults to orange-500
}

export interface DiagramData {
  cones: Cone[];
  paths: Path[];       // kept for backward compat (cone-to-cone equipment paths)
  routes: Route[];     // new: player routes
  gridScale: number;
}
```

Acceptance criteria:
- Existing drills with only `cones` and `paths` still render correctly (routes defaults to empty array)
- New routes are saved and loaded from the JSONB column without migration
- The Route type supports future extensibility (color per route, labels, etc.)

**7.5 - Update both components**

DiagramEditor: full interactive editing for routes (draw, select, edit waypoints, delete).
DiagramRenderer: read-only rendering of routes with the same visual treatment.

Both must handle the case where `routes` is undefined (backward compatibility with existing saved diagrams).

### Nice-to-Have (P1)

**7.6 - Route editing after creation**
Tap a route to select it. When selected, waypoints become draggable (same as cone dragging). Can delete individual waypoints or the entire route. Can change segment types on existing routes.

**7.7 - Arrow heads on route endpoints**
Small arrowhead at the final waypoint of each route, showing the direction of movement. Makes routes read like actual play diagrams.

**7.8 - Player icon at route start**
Instead of a plain dot at the route's starting point, render a small player icon (could be as simple as an "X" or a small circle with a different style than cones) to distinguish "player lines up here" from "cone is placed here."

**7.9 - Route color picker**
Let the captain choose a color per route (from a small preset palette: orange, blue, red, white, black). Useful when diagramming multiple players' routes on the same field so they're visually distinct.

### Future Considerations (P2)

**7.10 - Multiple routes on one diagram with player labels**
Assign routes to positions (QB, WR1, WR2, etc.) and show the position label at the start point.

**7.11 - Formation templates**
Pre-built starting formations (shotgun, trips left, etc.) that auto-place route start points. Captain just draws the routes from there.

**7.12 - Snap routes to cones**
If a route waypoint is placed near a cone, snap it to the cone's position. This connects the cone-setup world and the route world (e.g., "run to the cone at 10 yards, then cut left").

## Success Metrics

This is an internal tool for Taylor's team, so the metrics are qualitative during the validation period:

- Captains actually use route drawing when building drill diagrams (adoption). Target: routes are added to at least half of new drills within 2 weeks.
- Drill diagrams look closer to Playmaker X quality (visual benchmark). Taylor should be able to screenshot a diagram and share it in a group chat without needing to explain it.
- Time to create a drill diagram stays under 2 minutes (no regression from the visual changes or added complexity).

## Open Questions

1. **Curve direction control (design):** When a captain draws a curved segment, how do they control which way the arc bows? Auto-infer from context? Tap to flip? This needs to feel intuitive on mobile. Simplest approach: always arc to the left of the direction of travel, tap the curve to flip it.

2. **Zigzag angle (design):** How sharp should the automatic zigzag cut be? A 90-degree cut vs. a 45-degree cut create very different-looking routes. Suggest: default to a 90-degree offset, let the captain drag the midpoint to adjust if P1 route editing ships.

3. **Route vs. path confusion (engineering):** The data model now has both `paths` (cone-to-cone, equipment movement) and `routes` (player routes). The UI needs to make this distinction clear. Suggest: rename the current "+ Add Path" to "Connect Cones" and keep the new "Draw Route" for player routes. Or, simplify further by deprecating cone-to-cone paths entirely and only using routes going forward. Decision needed.

4. **Backward compatibility (engineering):** Existing drills have `paths` but no `routes` in their JSONB. Need to confirm that reading a DiagramData without a `routes` key doesn't break anything. Should be fine with a default of `[]`, but needs a test.

## Timeline Considerations

This should be broken into 2-3 CLI-sized build prompts:

- **Build 7a:** Visual changes only (smaller cones, remove labels, blue selected state). These are quick, low-risk changes to DiagramEditor, DiagramRenderer, and the types file. Can ship independently.
- **Build 7b:** Route data model + basic straight-line route drawing. Add the Route type, the "Draw Route" mode, and rendering of straight-segment routes in both components.
- **Build 7c:** Zigzag and curve segment types. Add the two additional segment rendering modes to the route drawing system.

Build 7a can ship immediately and makes the diagram look better today. Builds 7b and 7c add the route-drawing functionality.
