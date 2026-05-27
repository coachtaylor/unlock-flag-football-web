// Canonical position list + side mapping for the coach MVP.
//
// Source of truth for two related concepts:
//   1. Which position codes are valid (used by PlayerForm + filter chips).
//   2. Which side of the ball each position is on (used by offense/defense
//      aggregations on the team dashboard).
//
// CONVENTION: `team_players.positions` is an ordered text[]. By convention,
// `positions[0]` is the player's PRIMARY position. The UI in PlayerForm
// enforces this via the "Make primary" interaction; downstream aggregations
// trust the order. There is NO is_primary column or schema constraint —
// keep this convention intact in any code that writes to `positions`.
//
// Mirrors `unlock-mobile/constants/positions.ts`. If you add or remove a
// position here, update mobile too.

export type Side = "offense" | "defense";

export type PositionDef = {
  id: string;
  label: string;
  full: string;
  side: Side;
};

export const POSITIONS: PositionDef[] = [
  // Offense
  { id: "QB", label: "QB", full: "Quarterback", side: "offense" },
  { id: "WR", label: "WR", full: "Wide Receiver", side: "offense" },
  { id: "RB", label: "RB", full: "Running Back", side: "offense" },
  { id: "C", label: "C", full: "Center", side: "offense" },
  // Defense
  { id: "CB", label: "CB", full: "Cornerback", side: "defense" },
  { id: "S", label: "S", full: "Safety", side: "defense" },
  { id: "LB", label: "LB", full: "Linebacker", side: "defense" },
  { id: "DE", label: "DE", full: "Defensive End", side: "defense" },
  { id: "Rusher", label: "Rusher", full: "Pass Rusher", side: "defense" },
];

export const POSITION_IDS = POSITIONS.map((p) => p.id);

const SIDE_BY_ID: Record<string, Side> = Object.fromEntries(
  POSITIONS.map((p) => [p.id, p.side])
);

/** Side a single position code belongs to, or null if unknown. */
export function sideForPosition(id: string | null | undefined): Side | null {
  if (!id) return null;
  return SIDE_BY_ID[id] ?? null;
}

/** Primary position code (positions[0]) or null. */
export function primaryPosition(
  positions: string[] | null | undefined
): string | null {
  if (!positions || positions.length === 0) return null;
  return positions[0];
}

/** Side derived from the player's primary position. */
export function primarySide(
  positions: string[] | null | undefined
): Side | null {
  return sideForPosition(primaryPosition(positions));
}

export function isPrimaryOffense(
  positions: string[] | null | undefined
): boolean {
  return primarySide(positions) === "offense";
}

export function isPrimaryDefense(
  positions: string[] | null | undefined
): boolean {
  return primarySide(positions) === "defense";
}

/** True if ANY listed position is on the given side. Used by position pulses
 *  on the dashboard, where a two-way player should contribute to both
 *  slices they actually play. */
export function isAnyOffense(
  positions: string[] | null | undefined
): boolean {
  return (positions ?? []).some((p) => SIDE_BY_ID[p] === "offense");
}

export function isAnyDefense(
  positions: string[] | null | undefined
): boolean {
  return (positions ?? []).some((p) => SIDE_BY_ID[p] === "defense");
}

// Per-position accent colors. Mirrors mobile's POSITION_COLOR
// (constants/positions.ts). Used by BreakdownPulseCard to color each
// position's sparkline line + legend dot distinctly. Deliberately
// avoids the offense/defense side colors (lime / red) so position
// tags never collide with side coloring.
export const POSITION_COLOR: Record<string, string> = {
  QB: "#FF6A1A",      // orange
  WR: "#2DD4BF",      // teal
  RB: "#FFB347",      // gold
  C: "#7DDFD2",       // cyan
  CB: "#6EA8FF",      // blue
  S: "#B89BFF",       // violet
  LB: "#FF6A8B",      // pink
  DE: "#6BCF7F",      // green
  Rusher: "#E879F9",  // fuchsia
};

export function positionColor(id: string | null | undefined): string {
  if (!id) return "#7A7A82"; // text-mute fallback
  return POSITION_COLOR[id] ?? "#7A7A82";
}
