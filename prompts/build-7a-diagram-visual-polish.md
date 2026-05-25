# Build 7a: Diagram Visual Polish (Cones)

Read `CLAUDE.md` for design system and patterns. Read `src/components/DiagramEditor.tsx` and `src/components/DiagramRenderer.tsx` to see the current implementation.

## Context

The diagram builder works, but the cones are visually heavy. Three changes to make the field cleaner and more like Playmaker X: smaller cone dots, no labels on the field, and blue highlight for selected cones.

## Changes

### 1. Smaller cone dots

In both `DiagramEditor.tsx` and `DiagramRenderer.tsx`:

- Change `CONE_R` from `6` to `4`
- Keep `HIT_R` at `18` (invisible tap target stays large for mobile usability)
- The cone label offset (`cone.y + CONE_R + 4`) won't matter after we remove labels, but if any offset references CONE_R, update accordingly

### 2. Remove cone labels from the SVG

In `DiagramEditor.tsx`:
- Remove the `<text>` element inside the cone `<g>` that renders `{cone.label && cone.label.trim() ? cone.label : `${i + 1}`}`. Delete the entire `<text>` block (the one with `y={cone.y + CONE_R + 4}`, `fill={CONE_LABEL_COLOR}`).
- Keep the "Selected Cone" panel below the canvas (the one with the label input and delete button). Captains can still name cones for the auto-generated setup instructions. The label just doesn't show on the field anymore.

In `DiagramRenderer.tsx`:
- Same thing: remove the `<text>` element below each cone circle. Only the orange dot renders.

Do NOT change `diagram.ts` types. The `label` field stays on the `Cone` interface. It's still used by `generate-setup-instructions.ts`.

### 3. Selected cone turns blue

In `DiagramEditor.tsx`, update the cone rendering logic:

Currently, the `fillColor` logic is:
```typescript
const fillColor = isPathFrom
  ? "#2563EB"
  : isPathTo || isSelected
    ? "#D48A30"
    : "#D48A30";
```

Change it so selected cones (in normal mode) are blue:
```typescript
const fillColor = isPathFrom || isSelected
  ? "#2563EB"
  : isPathTo
    ? "#D48A30"
    : "#D48A30";
```

And the `ringColor` (stroke) logic:
```typescript
const ringColor = isPathFrom ? "#2563EB" : "#D48A30";
```

Change to:
```typescript
const ringColor = isPathFrom || isSelected ? "#2563EB" : "#D48A30";
```

So the rule is:
- Default (unselected) cone: orange fill (#D48A30), orange stroke (#D48A30)
- Selected cone (tapped in normal mode): blue fill (#2563EB), blue stroke (#2563EB)
- Path-drawing "from" cone: blue fill, blue stroke (already works)
- Path-drawing "to" cone: orange fill, orange stroke (no special treatment needed)

`DiagramRenderer.tsx` doesn't need selection colors (it's read-only), so no changes there beyond the smaller dots and removing labels.

### 4. Clean up unused constants

After removing labels:
- `CONE_LABEL_COLOR` is no longer used in either component. Remove it.
- If `NUMBER_COLOR` in the renderer was only for cone labels, check if it's still used for yard numbers. (It should be, for the yard line numbers in the left margin.)

## What NOT to change

- The `Cone` interface in `diagram.ts` (keep the `label` field)
- The `generate-setup-instructions.ts` file (it reads labels from data, not from the SVG)
- Path rendering (colors, dash patterns, labels on paths)
- The "Selected Cone" editing panel below the canvas (label input, delete button)
- The "+ Add Cone" and "+ Add Path" toolbar buttons
- Field rendering (yard lines, hash marks, sidelines, yard numbers)

## Testing

After changes:
1. Create a new drill, add 3+ cones. Verify they render as smaller orange dots with no text below them.
2. Tap a cone. It should turn blue. The editing panel should appear below with the label input.
3. Tap the field background. The cone should go back to orange.
4. Enter drawing mode, tap a cone as "from". It should turn blue.
5. View an existing drill with a saved diagram. Cones should render smaller with no labels in the read-only view.
6. Check that the auto-generated setup instructions still include cone labels/numbers.
