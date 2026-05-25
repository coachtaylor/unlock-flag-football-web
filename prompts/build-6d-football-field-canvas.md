# Build 6d: Football Field Canvas

Read `src/components/DiagramEditor.tsx` and `src/components/DiagramRenderer.tsx` to understand the current SVG rendering.

## Context

The diagram editor currently uses a plain grid. It needs to look like a football field instead — similar to Playmaker X. The canvas should show a 50-yard field (half field, since drills don't use a full 100) with proper yard line markings. This makes it immediately intuitive for captains to place cones at real yard distances.

## Task: Replace the grid background with a football field

Update both `DiagramEditor.tsx` and `DiagramRenderer.tsx` to use a football field background instead of the plain grid.

### Field design:

**Dimensions:**
- The SVG viewBox should represent 50 yards long × 25 yards wide (half the width of a real field, since flag football fields are narrower and drills typically use one side)
- Suggested viewBox: "0 0 500 250" (10 SVG units per yard, gives good precision for cone placement)
- Update gridScale accordingly: 1 grid unit = 1 yard (so snapping to nearest yard makes sense)

**Field background:**
- Fill: a dark green that works in dark mode. Use something like #1a3d1a or #1B4D2E (muted, not bright — it's a dark mode app). Should feel like a field without being eye-straining.
- Subtle field texture is optional. Flat color is fine.

**Yard lines:**
- Every 1 yard: very faint line (rgba(255,255,255,0.06)), running the full width of the field (horizontal lines since yards go left-to-right)
- Every 5 yards: slightly more visible line (rgba(255,255,255,0.15)), full width
- Every 10 yards: solid white line at low opacity (rgba(255,255,255,0.3)), full width

**Yard numbers:**
- At every 10-yard mark, show the number (10, 20, 30, 40, 50) on both sides of the field
- Small text (10-11px SVG units), white at 30% opacity
- Positioned just inside the left and right edges

**Sidelines:**
- White border lines on top and bottom edges of the field (the sidelines)
- Thin, rgba(255,255,255,0.3)

**Hash marks (optional but nice):**
- Small tick marks at each yard line on the left and right thirds of the field
- Very subtle, 2-3px long

**End zones (NOT needed):** Since this is a 50-yard practice field view, no end zones.

### Orientation:

- Yards run LEFT to RIGHT (0 at left edge, 50 at right edge)
- Width of field (25 yards) runs TOP to BOTTOM
- This matches how you'd look at a field from the sideline

### Cone snapping update:

- Snap cones to nearest yard (1 unit) instead of the current grid snap (which was every 10 units)
- This gives captains precision to place cones at exact yard marks
- Clamp: x between 0-500, y between 0-250 (within the field boundaries)

### Path yards validation:

- When a path is drawn between two cones, auto-calculate the distance in yards from the cone positions (Euclidean distance, rounded to nearest 0.5 yard)
- Pre-fill the yards input with this calculated distance so captains don't have to measure manually
- Captain can still override the pre-filled value if the drill path isn't a straight line

### Update DiagramRenderer too:

Apply the same field background to the read-only renderer so the drill detail page also shows the field-style diagram.

### Update setup instructions generator:

Since gridScale is now 1 yard per unit (instead of 10), verify that `src/lib/generate-setup-instructions.ts` still generates correct yard distances. The path `yards` field should still hold the correct value regardless of grid scale — it's entered by the captain or auto-calculated.

## Design rules
- The field green should be muted/dark to fit the dark mode design. NOT a bright grass green.
- White markings at low opacity so they don't compete with cones and paths.
- Cones (orange circles) and paths (colored lines) should pop against the green field.
- The field should be immediately recognizable as a football field at a glance.
- Keep SVG rendering performant — don't add hundreds of elements for texture.
