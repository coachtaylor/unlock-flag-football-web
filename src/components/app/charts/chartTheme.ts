// Shared Recharts theme tokens. Centralizes axis / grid / tooltip styling
// so player charts and the dashboard trend chart stay visually consistent.
// Build 8.
//
// CSS variables aren't readable by Recharts' inline SVG, so we mirror the
// UFF token values here as literals. Keep in sync with globals.css if the
// palette shifts.

export const chartTheme = {
  // Axis tick labels
  tickFill: "#7A7A82",
  tickFontSize: 11,
  tickFontFamily: "var(--font-mono)",

  // Grid + axis lines
  gridStroke: "#26262C",
  gridDash: "2 4",

  // Tooltip card
  tooltip: {
    background: "#141417",
    border: "1px solid #26262C",
    borderRadius: 8,
    fontSize: 12,
    color: "#F4F4F2",
    padding: "8px 10px",
  } as const,

  // Cursor (vertical line on hover)
  cursorStroke: "#3A3A40",

  // PR markers
  prRingStroke: "#FFFFFF",
  prRingFillOpacity: 0.96,
} as const;

// Format a sample value for axis ticks / tooltip given the benchmark type.
export function formatValue(v: number, type: string | null): string {
  switch (type) {
    case "timed":
      return v.toFixed(2);
    case "rated":
      return v.toFixed(1);
    case "pct":
      return `${v.toFixed(0)}%`;
    default:
      return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
}

// Short date label for X-axis ticks (e.g. "May 20").
export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
