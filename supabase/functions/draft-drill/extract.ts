// Media → signals. YouTube uses the free public timedtext track; everything else
// (and uploads' frames) goes through a configurable vendor. Swapping the vendor
// only touches this file. Long-video guard: cap transcript length + frame count.
import { resolvePlatform } from "../_shared/platform.ts";

export interface Signals {
  transcript: string | null;
  frames: string[];
  sources: string[];
}

const MAX_TRANSCRIPT_CHARS = 6000;
const MAX_FRAMES = 6;

export async function extractSignals(job: {
  source_url: string | null; storage_path: string | null;
}): Promise<Signals> {
  const sources: string[] = [];
  let transcript: string | null = null;
  let frames: string[] = [];

  if (job.source_url) {
    const platform = resolvePlatform(job.source_url);
    if (platform === "youtube") {
      transcript = await fetchYouTubeCaptions(job.source_url);
      if (transcript) sources.push("youtube-captions");
    }
  }

  if (!transcript || frames.length === 0) {
    const vendor = await fetchFromVendor(job);
    if (vendor.transcript && !transcript) { transcript = vendor.transcript; sources.push("vendor-transcript"); }
    if (vendor.frames?.length) { frames = vendor.frames; sources.push("vendor-frames"); }
  }

  if (transcript && transcript.length > MAX_TRANSCRIPT_CHARS) {
    transcript = transcript.slice(0, MAX_TRANSCRIPT_CHARS);
  }
  frames = frames.slice(0, MAX_FRAMES);
  return { transcript, frames, sources };
}

async function fetchYouTubeCaptions(url: string): Promise<string | null> {
  const id = new URL(url).searchParams.get("v")
    ?? url.split("youtu.be/")[1]?.split(/[?&/]/)[0]
    ?? url.split("/shorts/")[1]?.split(/[?&/]/)[0];
  if (!id) return null;
  const res = await fetch(`https://video.google.com/timedtext?lang=en&v=${id}`);
  if (!res.ok) return null;
  const xml = await res.text();
  if (!xml.trim()) return null;
  const text = xml.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return text || null;
}

async function fetchFromVendor(job: { source_url: string | null; storage_path: string | null })
  : Promise<{ transcript?: string; frames?: string[] }> {
  const base = Deno.env.get("EXTRACT_VENDOR_URL");
  const key = Deno.env.get("EXTRACT_VENDOR_KEY");
  if (!base || !key) return {};
  const res = await fetch(base, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ url: job.source_url, storage_path: job.storage_path, want: ["transcript", "frames"], max_frames: MAX_FRAMES }),
  });
  if (!res.ok) return {};
  const data = await res.json().catch(() => ({}));
  return { transcript: data.transcript ?? undefined, frames: data.frames ?? undefined };
}
