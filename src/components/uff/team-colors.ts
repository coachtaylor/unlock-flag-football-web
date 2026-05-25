// Team / league color palette — id ↔ hex.
//
// IMPORTANT: the DB stores the id (`"orange"`, `"blue"`, …) not the hex.
// The `teams_team_color_chk` and `leagues_league_color_check` CHECK
// constraints enforce this — any RPC call that writes color must pass
// one of TEAM_COLOR_IDS. The hex is for rendering only.

export const TEAM_COLOR_IDS = [
  "orange",
  "lime",
  "blue",
  "red",
  "violet",
  "cyan",
  "pink",
  "gold",
] as const;

export type TeamColorId = (typeof TEAM_COLOR_IDS)[number];

export type TeamColor = {
  id: TeamColorId;
  hex: string;
  label: string;
};

// Hex values mirror unlock-mobile/constants/design.ts → colors.team.*
// so a team rendered on web matches the same team rendered on mobile.
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

// Resolve a stored color id to a hex string suitable for CSS.
// Falls back to orange for null/unknown values. NEVER pass the result
// to an RPC — RPCs expect the id.
export function teamColorHex(id: string | null | undefined): string {
  if (!id) return TEAM_COLORS[0].hex;
  const found = TEAM_COLORS.find((c) => c.id === id);
  return found ? found.hex : TEAM_COLORS[0].hex;
}

export function isTeamColorId(value: unknown): value is TeamColorId {
  return (
    typeof value === "string" &&
    (TEAM_COLOR_IDS as readonly string[]).includes(value)
  );
}
