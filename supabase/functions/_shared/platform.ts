export type SourcePlatform = "youtube" | "tiktok" | "instagram" | "other";

/** Pure URL → platform classifier. Returns null when the string isn't a URL. */
export function resolvePlatform(raw: string): SourcePlatform | null {
  let host: string;
  try {
    host = new URL(raw.trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host === "vm.tiktok.com" || host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("instagram.com")) return "instagram";
  return "other";
}
