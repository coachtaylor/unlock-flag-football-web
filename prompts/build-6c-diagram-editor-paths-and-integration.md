# Build 6c: Diagram Editor — Paths + Form Integration

Read `CLAUDE.md` for design system. Read `src/types/diagram.ts` for types. Read `src/components/DiagramEditor.tsx` for the current editor state (cone placement works, this build adds path creation). Read `src/lib/generate-setup-instructions.ts` for the instructions generator.

## Context

This build adds path drawing to the diagram editor, then integrates the full editor into the drill create/edit form. After this, the diagram builder feature is complete.

## Task 1: Add path creation to DiagramEditor

**"Add Path" button:**
- Add to the toolbar row: "Add Cone" | "Add Path" | cone count
- Tapping "Add Path" enters path-drawing mode:
  - Button text changes to "Drawing path... tap two cones" (or similar visual indicator)
  - Button gets orange border to show active mode
  - Cancel by tapping the button again

**Path-drawing mode:**
- First cone tap = selects the "from" cone (highlight it in blue-400 to distinguish from normal orange selection)
- Second cone tap = selects the "to" cone
- After both selected, show a path form inline below the canvas:
  - Movement type pills: Sprint | Backpedal | Shuffle | Jog (default: Sprint)
  - Yards input (number, required)
  - "Add Path" button to confirm
  - "Cancel" text link
- On confirm: add the path to DiagramData.paths array, call onChange, exit drawing mode
- Path immediately renders on the canvas using the line styles from DiagramRenderer

**Editing existing paths:**
- Tap on a path line (or near it) to select it
- When selected, show the same path form pre-filled with current values
- "Update" button to save changes
- "Delete Path" button (text-error) to remove it

**Path rendering in the editor:**
- Same line styles as DiagramRenderer (solid/dashed/dotted, color-coded by movement type)
- Show yards label at midpoint of each path
- Selected path: thicker stroke (3px instead of 2px)

**Making path lines tappable:**
- SVG lines are hard to tap on mobile. Add an invisible wider stroke (12px, transparent) on top of each path line as a hit area.

## Task 2: Integrate editor into drill create/edit form

Find the drill form component (likely in `/drills/new/` or shared as a component). Replace the "Diagram builder coming soon" placeholder with:

```tsx
<DiagramEditor 
  value={diagramData} 
  onChange={setDiagramData} 
/>
```

**Below the editor, show auto-generated setup instructions:**
- Use `generateSetupInstructions(diagramData)` from `src/lib/generate-setup-instructions.ts`
- Display in a surface-raised card with label "Setup Instructions (auto-generated)"
- Updates live as the diagram changes
- If no cones placed, don't show this section

**On form save:**
- Include `setup_diagram: diagramData` (or null if no cones) in the database insert/update
- Include `setup_instructions: generateSetupInstructions(diagramData)` (or null) in the database insert/update
- Update equipment field: auto-count cones. If diagramData exists, set equipment to `{"cones": diagramData.cones.length, "other": [...existing other equipment...]}`. If user also typed something in the equipment text input, put that in the "other" array.

**On form load (edit mode):**
- If the drill has existing `setup_diagram` data, pass it as the `value` prop to DiagramEditor
- The editor should render the existing cones and paths, ready for editing

## Task 3: Update drill detail page

On `/drills/[id]/page.tsx`, the DiagramRenderer should already be integrated from build 6a. Verify it works:
- If `setup_diagram` exists, render DiagramRenderer
- Show setup_instructions below
- Show equipment (with cone count)

If DiagramRenderer was not integrated in 6a for some reason, do it now.

## Design rules
- Dark mode. Orange = interactive.
- Path-drawing mode should feel distinct from normal mode. Use the blue-400 highlight for "from" cone to show the user is in a different state.
- Movement type pills use standard pill styles (orange when selected).
- The yards input should be compact (64px wide, inline with the pills).
- Touch targets: path hit areas need to be generous (12px invisible stroke width).
- After adding a path, exit drawing mode automatically so the user doesn't accidentally start another.
- Screen padding px-xl. The editor takes full form width.
