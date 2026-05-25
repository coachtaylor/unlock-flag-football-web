# Build 6b: Diagram Editor — Cone Placement

Read `CLAUDE.md` for design system. Read `src/types/diagram.ts` for the DiagramData types. Read `src/components/DiagramRenderer.tsx` to understand the SVG rendering approach (reuse the same rendering logic).

## Context

This builds the interactive diagram editor — specifically the cone placement part. Paths come in the next build. The editor extends the read-only renderer with interactivity: adding, moving, selecting, labeling, and deleting cones.

## Task

### Create DiagramEditor component (`src/components/DiagramEditor.tsx`)

A client component with this interface:

```typescript
interface DiagramEditorProps {
  value: DiagramData | null;
  onChange: (data: DiagramData) => void;
}
```

**Canvas:**
- Same SVG setup as DiagramRenderer (viewBox "0 0 200 100", grid background, full width)
- Slightly taller in edit mode: give it 320px height on mobile so there's room to work
- Grid lines visible (same subtle style as renderer)
- Border around the SVG: border-default (so it looks like an editable area)
- Border-radius: rounded-lg

**Adding cones:**
- "Add Cone" button below the canvas (surface-raised background, border-default, text-primary)
- Each tap adds a cone at a default position. First cone at (20, 50), subsequent cones offset by (30, 0) so they don't stack on top of each other. If they'd go off-canvas, wrap to next row.
- New cone gets auto-generated ID: "c1", "c2", "c3"... (use a counter based on existing cones)
- Label defaults to empty string. First cone auto-labels "Start".

**Dragging cones (repositioning):**
- Touch: onTouchStart on a cone captures it, onTouchMove on the SVG moves it, onTouchEnd releases
- Mouse: onMouseDown on a cone captures, onMouseMove moves, onMouseUp releases
- Convert screen coordinates to SVG coordinates using the SVG's viewBox and getBoundingClientRect()
- Snap to grid: round x and y to nearest 10 (matching gridScale of 10)
- Cone cannot be dragged outside the viewBox bounds. Clamp x to [5, 195] and y to [5, 95].

**Selecting a cone:**
- Tap/click a cone without dragging = select it
- Selected cone: orange-500 fill (instead of just stroke)
- When selected, show an inline form below the canvas:
  - "Label" text input (small, placeholder: "e.g., Start, Finish")
  - "Delete" button (text-error color) — removes the cone AND any paths connected to it
  - "Done" text button to deselect
- Only one cone selected at a time. Tapping canvas background deselects.

**Toolbar below canvas:**
- Row of buttons: "Add Cone" | cone count display ("3 cones")
- If any cones exist: "Clear All" button (text-muted) — confirms with a simple "Are you sure?" inline message before clearing

**Rendering existing paths:**
- If value prop includes paths, render them using the same line styles from DiagramRenderer (but they're not editable in this build)
- This ensures the editor shows the full diagram state even though path editing comes next

**onChange behavior:**
- Call `onChange` with the updated DiagramData after every change (add cone, move cone, edit label, delete cone)
- This keeps the parent form in sync

**Do NOT build in this prompt:**
- Path creation/editing (that's build 6c)
- Setup instructions generation in the editor (the parent form handles this)
- Integration into the drill form (that's also 6c)

## Design rules
- Dark mode. SVG background: surface-raised.
- Orange = selected/interactive elements.
- Touch targets: cones need to be easy to tap. Use 12px radius for the invisible hit area even if the visual circle is 6px radius.
- Dragging must feel responsive. No debounce on move events.
- Keep it simple. No zoom, no pan. The fixed viewBox is the workspace.
