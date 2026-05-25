# Build 6a: Diagram Types + Read-Only Renderer

Read `CLAUDE.md` for design system and patterns. Read `../qb_supabase_full_package/docs/coach_mvp_schema_spec.md` for the `team_drills` table schema, specifically the `setup_diagram` JSONB structure.

## Context

The drill setup diagram shows cones placed on a grid with paths between them showing movement types and distances. This build creates the TypeScript types and a read-only SVG renderer. The interactive editor comes in a later build.

## Task

### 1. Create types file (`src/types/diagram.ts`)

```typescript
export interface Cone {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface Path {
  from: string;
  to: string;
  movement: 'sprint' | 'backpedal' | 'shuffle' | 'jog';
  yards: number;
}

export interface DiagramData {
  cones: Cone[];
  paths: Path[];
  gridScale: number;
}
```

### 2. Create the setup instructions generator (`src/lib/generate-setup-instructions.ts`)

A pure function that takes DiagramData and returns a text string.

Logic:
1. Count cones
2. Walk paths in array order, accumulating distance
3. Output format: "5 cones. Cone 1 (Start) at 0 yards. Cone 2 at 7 yards. Cone 3 at 10 yards. Cone 4 at 17 yards. Cone 5 (Finish) at 20 yards."

If a cone has a label, include it in parentheses. If no label, just "Cone N".

Handle edge case: if no paths exist, just list cones without distances.

### 3. Create read-only DiagramRenderer component (`src/components/DiagramRenderer.tsx`)

A client component that renders a DiagramData object as an SVG visualization.

Props:
```typescript
interface DiagramRendererProps {
  data: DiagramData;
}
```

**SVG rendering:**
- ViewBox: "0 0 200 100" (landscape, scales to container width)
- Background: surface-raised (#161C24)
- Grid lines: subtle (rgba(255,255,255,0.04)), every 10 units
- Full width of parent container, aspect ratio maintained

**Cones:**
- Circle: 6px radius, surface-raised fill, orange-500 stroke (2px)
- Label below cone: text-micro size (10px), text-secondary fill, centered

**Paths (lines between cones):**
- Sprint: solid line, 2px, orange-400 color
- Backpedal: dashed line (strokeDasharray="6 4"), blue-400 color
- Shuffle: dotted line (strokeDasharray="2 4"), green-400 color
- Jog: solid line, 1.5px, text-muted color (rgba(255,255,255,0.35))

**Path labels:**
- Show yards + movement type on each path segment
- Small text (9px) positioned at midpoint of the line, slightly offset above
- Format: "7yd sprint" or "3yd backpedal"
- Color matches the path line color

**A legend below the SVG:**
- Small horizontal row showing line style + label for each movement type
- Only show movement types that are actually used in this diagram

### 4. Integrate renderer into drill detail page

Update `/drills/[id]/page.tsx`:
- If the drill has `setup_diagram` data (not null), render the DiagramRenderer component with that data
- Below the diagram, show `setup_instructions` text in a surface-raised card with a label "Setup Instructions"
- If no diagram, hide the section entirely (remove the old "coming soon" placeholder)

## Design rules
- Dark mode. SVG uses CSS variable colors.
- Keep the SVG clean and readable on mobile (375px viewport = ~335px diagram width).
- Path labels should not overlap cones. Offset them slightly.
- The renderer is read-only. No interactivity needed here.
