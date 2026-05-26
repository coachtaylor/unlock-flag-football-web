// Block color palette for the practice block model (Build 5.5).
// Mirror of mobile constants/block-colors.ts: 4 named defaults + 8-color
// hash fallback. Same block name resolves to the same color across plans
// and across the mobile + web apps.

export type BlockColor = {
  key: string;
  label: string;
  accent: string;
  tint: string;
  border: string;
};

const NAMED: Record<string, BlockColor> = {
  warmup: {
    key: "warmup",
    label: "Warm-up",
    accent: "#FFB347",
    tint: "rgba(255,179,71,0.13)",
    border: "rgba(255,179,71,0.30)",
  },
  offense: {
    key: "offense",
    label: "Offense",
    accent: "#C2FF3D",
    tint: "rgba(194,255,61,0.10)",
    border: "rgba(194,255,61,0.28)",
  },
  defense: {
    key: "defense",
    label: "Defense",
    accent: "#FF4D4D",
    tint: "rgba(255,77,77,0.10)",
    border: "rgba(255,77,77,0.28)",
  },
  scrimmage: {
    key: "scrimmage",
    label: "Scrimmage",
    accent: "#B89BFF",
    tint: "rgba(184,155,255,0.12)",
    border: "rgba(184,155,255,0.30)",
  },
  cooldown: {
    key: "cooldown",
    label: "Cool-down",
    accent: "#7DDFD2",
    tint: "rgba(125,223,210,0.10)",
    border: "rgba(125,223,210,0.28)",
  },
};

const HASH_PALETTE: BlockColor[] = [
  { key: "h0", label: "", accent: "#FF6A1A", tint: "rgba(255,106,26,0.10)", border: "rgba(255,106,26,0.28)" },
  { key: "h1", label: "", accent: "#7DDFD2", tint: "rgba(125,223,210,0.10)", border: "rgba(125,223,210,0.28)" },
  { key: "h2", label: "", accent: "#6EA8FF", tint: "rgba(110,168,255,0.10)", border: "rgba(110,168,255,0.28)" },
  { key: "h3", label: "", accent: "#FF6A8B", tint: "rgba(255,106,139,0.10)", border: "rgba(255,106,139,0.28)" },
  { key: "h4", label: "", accent: "#FFCE52", tint: "rgba(255,206,82,0.10)", border: "rgba(255,206,82,0.28)" },
  { key: "h5", label: "", accent: "#A7E8B0", tint: "rgba(167,232,176,0.10)", border: "rgba(167,232,176,0.28)" },
  { key: "h6", label: "", accent: "#9DB0FF", tint: "rgba(157,176,255,0.10)", border: "rgba(157,176,255,0.28)" },
  { key: "h7", label: "", accent: "#FF9B6E", tint: "rgba(255,155,110,0.10)", border: "rgba(255,155,110,0.28)" },
];

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function blockColor(input: string | null | undefined): BlockColor {
  if (!input) return HASH_PALETTE[0];
  const k = String(input).toLowerCase().trim();
  if (NAMED[k]) return NAMED[k];
  for (const n of Object.keys(NAMED)) {
    if (k.includes(n) || k.includes(n.replace("warmup", "warm-up"))) return NAMED[n];
  }
  if (k.includes("warm")) return NAMED.warmup;
  if (k.includes("cool")) return NAMED.cooldown;
  if (k.includes("scrim")) return NAMED.scrimmage;
  return HASH_PALETTE[hash(k) % HASH_PALETTE.length];
}
