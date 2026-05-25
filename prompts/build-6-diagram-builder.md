# Build 6: Drill Setup Diagram Builder

Read `CLAUDE.md` for design system and patterns. Read `../CLAUDE.md` for product context (Coach/Team Management MVP section, specifically the "Setup diagram builder" bullet under "1. Drill Library", and the "Auto-generated setup instructions" bullet). Read `../qb_supabase_full_package/docs/coach_mvp_schema_spec.md` for the `team_drills` table schema, specifically the `setup_diagram` JSONB structure and `setup_instructions` field.

## Context

The diagram builder solves the problem of captains not knowing where to physically set up equipment on the field. During the last practice, one captain had a drill idea (sprint 7 yards, backpedal 3, sprint 7, backpedal 3) but didn't know where to place the cones. The diagram builder lets captains visually place cones on a scaled grid, draw paths between them with movement types, and specify yard distances. From this, the app auto-generates text setup instructions.

This is a self-contained interactive component that plugs into the existing drill create/edit form.

## JSONB Structure (already defined in schema)

```json
{
  "cones": [
    {"id": "c1", "x": 0, "y": 50, "label": "Start"},
    {"id": "c2", "x": 70, "y": 50, "label": ""},
    {"id": "c3", "x": 40, "y": 50, "label": ""},
    {"id": "c4", "x": 110, "y": 50, "label": ""},
    {"id": "c5", "x": 80, "y": 50, "label": "Finish"}
  ],
  "paths": [
    {"from": "c1", "to": "c2", "movement": "sprint", "yards": 7},
    {"from": "c2", "to": "c3", "movement": "backpedal", "yards": 3},
    {"from": "c3", "to": "c4", "movement": "sprint", "yards": 7},
    {"from": "c4", "to": "c5", "movement": "backpedal", "yards": 3}
  ],
  "gridScale": 10
}
```

- `x` and `y` are grid positions (not pixels). `gridScale` defines yards per grid unit.
- Movement types: "sprint", "backpedal", "shuffle", "jog"
- Paths are drawn as lines between cones with different styles per movement type.

## Task: Build the diagram builder component + integrate into drill form

### 1. DiagramBuilder Component (`/src/components/DiagramBuilder.tsx`)

A self-contained client component with this interface:

```typescript
interface DiagramBuilderProps {
  value: DiagramData | null;        // existing diagram data (for edit mode)
  onChange: (data: DiagramData) => void;  // called when diagram changes
}
```

**The component has two modes:**

**View mode (when rendered on drill detail page):**
- Renders the diagram as a read-only SVG visualization
- Shows cones as circles with labels
- Shows paths as lines with movement type styling
- Shows yard distances on each path segment

**Edit mode (when rendered in the drill form):**
- Interactive SVG canvas where captains build the diagram
- Grid background with subtle lines (use border-subtle color)
- Canvas size: full width of the form, 300px tall on mobile

**Edit mode interactions:**

**Adding cones:**
- "Add Cone" button below the canvas
- Tapping it adds a new cone at a default position (center of canvas)
- Cones are draggable (touch drag on mobile, mouse drag on desktop)
- Cones snap to grid intersections for clean alignment
- Tapping a placed cone selects it (orange highlight). Shows options:
  - Label input (optional, e.g., "Start", "Finish")
  - Delete cone button (X)

**Adding paths:**
- "Add Path" button below the canvas
- Activates path-drawing mode. Tap first cone (from), then tap second cone (to).
- After both cones selected, a path form appears:
  - Movement type pills: Sprint, Backpedal, Shuffle, Jog
  - Yards input (number)
- Path appears as a line between the two cones

**Path line styles (SVG):**
- Sprint: solid line, orange-400 color
- Backpedal: dashed line, blue-400 color
- Shuffle: dotted line, green-400 color
- Jog: solid line, text-muted color (thin)

**Cone rendering:**
- Circle (16px diameter) with surface-raised fill and orange-500 border
- Selected cone: orange-500 fill
- Label text below cone (text-micro size)

**Toolbar below canvas:**
- "Add Cone" button
- "Add Path" button
- "Clear All" button (text-muted, confirms before clearing)
- Cone count display: "5 cones" (updates automatically)

**Auto-generated setup instructions:**
A pure function that takes the diagram data and outputs a text string. Run it every time the diagram changes and display below the canvas.

Logic:
1. Walk the paths in order (path[0], path[1], etc.)
2. Calculate cumulative distance from start
3. Output: "{cone count} cones. Cone 1 ({label}) at 0 yards. Cone 2 at {yards} yards. Cone 3 at {cumulative yards} yards..."

Example output: "5 cones. Cone 1 (Start) at 0 yards. Cone 2 at 7 yards. Cone 3 at 10 yards. Cone 4 at 17 yards. Cone 5 (Finish) at 20 yards."

Display this in a surface-raised card below the builder with a label "Setup Instructions (auto-generated)".

### 2. Integrate into Drill Create/Edit Form

In the existing drill form component (used by `/drills/new` and `/drills/[id]/edit`):

- Replace the "Diagram builder coming soon" placeholder with the actual DiagramBuilder component
- Pass current diagram value and onChange handler
- On form save, include the diagram data as `setup_diagram` (JSONB) and the generated instructions as `setup_instructions` (text) in the database insert/update
- Also update the `equipment` field: auto-count cones from diagram (`{"cones": diagramData.cones.length, "other": [...]}`)

### 3. Render diagram on Drill Detail Page

On `/drills/[id]/page.tsx`:

- If the drill has `setup_diagram` data, render the DiagramBuilder in view mode (read-only visualization)
- Show the `setup_instructions` text below it
- If no diagram exists, keep showing the "Diagram builder coming soon" placeholder (or just hide the section)

### 4. TypeScript Types

Create a types file at `src/types/diagram.ts`:

```typescript
export interface Cone {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface Path {
  from: string;  // cone id
  to: string;    // cone id
  movement: 'sprint' | 'backpedal' | 'shuffle' | 'jog';
  yards: number;
}

export interface DiagramData {
  cones: Cone[];
  paths: Path[];
  gridScale: number;
}
```

## Design rules reminder
- Dark mode always. The SVG canvas background should be surface-base or slightly lighter (surface-raised).
- Grid lines on the canvas: use border-subtle color (very faint).
- Orange = interactive elements (selected cones, sprint paths, buttons).
- Touch targets 44px minimum. Cones need to be easy to tap and drag on a phone screen.
- The canvas needs to work well on a 375px-wide viewport. Full width minus the 20px padding on each side = 335px usable width.
- Snap-to-grid should be generous so cones align cleanly without precision tapping.
- Keep the UI simple. This is a tool for captains on their phones, not a design app. Prioritize clarity over features.

## Important implementation notes
- Use SVG (not HTML Canvas) because individual elements are easier to make interactive with React event handlers.
- For dragging on mobile: use touch events (onTouchStart, onTouchMove, onTouchEnd). Also support mouse events for desktop.
- Generate unique cone IDs with a simple counter pattern: "c1", "c2", "c3", etc.
- The gridScale default is 10 (10 yards per grid unit). This can be hardcoded for MVP.
- Paths should be ordered. The order they appear in the array is the order the player runs them.
