# Build 6e: Flip Field Orientation + White Background (Playmaker X Style)

Read `src/components/DiagramEditor.tsx` and `src/components/DiagramRenderer.tsx` to see the current field rendering.

## What to change

The field needs to look like Playmaker X (see reference). Three key changes:

### 1. Flip the field orientation

Currently yards run left-to-right (horizontal). Flip it so yards run BOTTOM to TOP (vertical), like how you'd see the field from behind the offense looking downfield.

- 0 yards at the BOTTOM of the canvas (the line of scrimmage)
- 25 yards at the TOP (downfield)
- Sideline-to-sideline runs LEFT to RIGHT
- Width of field (sideline to sideline): use a standard flag football width, roughly 40 yards

So the viewBox represents 40 yards wide × 25 yards tall. Suggested viewBox: "0 0 400 250" (10 units per yard).

### 2. White/light background instead of dark green

Playmaker X uses a clean white background with light gray or light green yard lines. Match that style:

- Background: white (#FFFFFF)
- Yard lines: light gray (#E0E0E0 or similar) for every 5 yards
- 1-yard marks: very faint gray (#F0F0F0) or skip them entirely for cleanliness — Playmaker X doesn't show every single yard
- 10-yard lines: slightly darker (#D0D0D0)
- Yard numbers: gray text (#999 or #AAA), positioned on left and right edges at every 5 yards (0, 5, 10, 15, 20, 25)
- Sidelines (left and right edges): subtle gray border

This is intentionally a light element inside the dark mode app. The field canvas is a "document" — like how drawing apps have a white canvas inside a dark UI. The surrounding app chrome stays dark.

### 3. Scale: 25 yards deep × 40 yards wide

- Vertical (depth): 25 yards. Lines at 0, 5, 10, 15, 20, 25. Horizontal lines running left-to-right.
- Horizontal (width): 40 yards. No vertical yard lines needed (or just sidelines). Optional: hash marks at center field (like real hash marks at 1/3 intervals).
- Line of scrimmage at y=0 (bottom). This is where the play starts.

### 4. Update cone and path rendering for white background

Since the background is now white, cones and paths need to be visible against white:

- Cones: keep the orange-500 (#D48A30) fill/stroke. Orange pops against white.
- Selected cone: orange-500 fill (same, still works on white)
- Cone labels: dark text (#333 or #555) instead of light text
- Path line colors need to work on white:
  - Sprint: orange-500 (#D48A30) solid line
  - Backpedal: blue-600 (#2563EB) dashed line  
  - Shuffle: green-600 (#16A34A) dotted line
  - Jog: gray-400 (#9CA3AF) solid thin line
- Path yard labels: dark text (#555) at midpoint
- Yard numbers on the field: gray (#AAA)

### 5. Update cone snapping

Snap to nearest yard (10 SVG units). Clamp x to [0, 400] and y to [0, 250].

### 6. Update generate-setup-instructions.ts if needed

Since the field is now vertical (y-axis = yards downfield), the instructions generator may need updating. The "yards" value on each path is still explicitly set by the user (or auto-calculated), so it should still work. Verify cone distance calculation uses the new coordinate system correctly.

### 7. Apply to BOTH components

- `DiagramEditor.tsx` (interactive editor in drill form)
- `DiagramRenderer.tsx` (read-only view on drill detail page)

Both should render the same white-background vertical field.

## Design notes
- The white canvas inside the dark app should have a border (border-default) and rounded-lg corners so it feels like an embedded document/canvas.
- Add a small amount of padding inside the SVG (5-10 units) so cones at the edges aren't clipped.
- The toolbar and selected-cone form below the canvas remain dark-themed (they're part of the app, not the field).
- This light-canvas-in-dark-app pattern is common in design tools and playbook apps.
