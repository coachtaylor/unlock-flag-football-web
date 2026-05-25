// Team / league color palette — id ↔ hex.
// Stored as the `team_color` / `league_color` string column on the DB
// (we save the hex; the id is UI-only).

export type TeamColorId =
  | "orange"
  | "lime"
  | "blue"
  | "red"
  | "violet"
  | "cyan"
  | "pink"
  | "gold";

export type TeamColor = {
  id: TeamColorId;
  hex: string;
  label: string;
};

export const TEAM_COLORS: TeamColor[] = [
  { id: "orange", hex: "#FF6A1A", label: "Orange" },
  { id: "lime", hex: "#C2FF3D", label: "Lime" },
  { id: "blue", hex: "#6EA8FF", label: "Blue" },
  { id: "red", hex: "#FF4D4D", label: "Red" },
  { id: "violet", hex: "#B89BFF", label: "Violet" },
  { id: "cyan", hex: "#7DDFD2", label: "Cyan" },
  { id: "pink", hex: "#FF6A8B", label: "Pink" },
  { id: "gold", hex: "#FFB347", label: "Gold" },
];

export function teamColorHex(id: TeamColorId | string | null | undefined): string {
  if (!id) return TEAM_COLORS[0].hex;
  const found = TEAM_COLORS.find((c) => c.id === id);
  return found?.hex ?? id; // allow raw hex passthrough
}

export function teamColorIdFromHex(hex: string | null | undefined): TeamColorId {
  if (!hex) return "orange";
  const found = TEAM_COLORS.find(
    (c) => c.hex.toUpperCase() === hex.toUpperCase()
  );
  return found?.id ?? "orange";
}
