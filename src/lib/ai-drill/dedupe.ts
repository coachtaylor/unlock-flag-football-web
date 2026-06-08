export const FAIR_USE_MONTHLY_CAP = 50;

/** Normalize a source URL so two pastes of the same video collide. */
export function canonicalSourceKey(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.protocol = "https:";
  u.hash = "";
  for (const p of [...u.searchParams.keys()]) {
    if (p.startsWith("utm_") || p === "si" || p === "feature") u.searchParams.delete(p);
  }
  let s = u.toString();
  if (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

export function isOverCap(usedThisMonth: number): boolean {
  return usedThisMonth >= FAIR_USE_MONTHLY_CAP;
}
