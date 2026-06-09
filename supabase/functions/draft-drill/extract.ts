// Media resolver, self-contained in the edge function (no tunnel/vendor, no Groq).
// TikTok/Instagram → MP4 bytes via the RapidAPI scraper. YouTube → the URL itself
// (Gemini ingests YouTube links natively). Drafting (draft.ts) sends the result to
// Gemini, which watches the video. Every failure throws so index.ts records the
// reason in the job's error_detail.
//
// Edge-function secrets required: RAPIDAPI_KEY, RAPIDAPI_HOST.
import { resolvePlatform } from "../_shared/platform.ts";
import type { ClipMedia } from "./gemini-core.ts";

const MAX_CLIP_BYTES = 100 * 1024 * 1024; // sanity bound; clips upload via the Files API (2 GB limit), not inline

export async function resolveMedia(job: { source_url: string | null }): Promise<ClipMedia> {
  const url = job.source_url?.trim();
  if (!url) throw new Error("job has no source_url");

  const platform = resolvePlatform(url);
  if (platform === "youtube") {
    return { platform: "youtube", mp4Bytes: null, youtubeUrl: url, caption: null, author: null };
  }
  if (platform === "tiktok" || platform === "instagram") {
    const meta = await fetchClipMedia(url);
    if (!meta.videoUrl) throw new Error("scraper returned no playable video");
    const mp4Bytes = await downloadClip(meta.videoUrl);
    return { platform, mp4Bytes, youtubeUrl: null, caption: meta.caption, author: meta.author };
  }
  throw new Error(`unsupported source: ${platform}`);
}

interface ClipMeta {
  videoUrl: string | null;
  caption: string | null;
  author: string | null;
}

// Resolve a TikTok/Instagram share link to a downloadable MP4 + caption via the
// "Social Download All in One" RapidAPI API (POST /v1/social/autolink →
// { title, author, medias:[{ url, type, extension }] }). One endpoint covers
// every supported platform. Throws on misconfig / non-200 / no video so failures
// are visible in error_detail.
async function fetchClipMedia(url: string): Promise<ClipMeta> {
  const key = Deno.env.get("RAPIDAPI_KEY");
  const host = Deno.env.get("RAPIDAPI_HOST");
  if (!key || !host) {
    throw new Error(
      `scraper not configured (RAPIDAPI_KEY=${key ? "set" : "MISSING"} RAPIDAPI_HOST=${host ? "set" : "MISSING"})`,
    );
  }
  const res = await fetch(`https://${host}/v1/social/autolink`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-rapidapi-key": key, "x-rapidapi-host": host },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`scraper ${res.status}: ${(await res.text()).slice(0, 150)}`);

  const json = (await res.json().catch(() => ({}))) as {
    title?: string;
    author?: string;
    medias?: { url?: string; type?: string; extension?: string }[];
  };
  const medias = json.medias ?? [];
  // Prefer an mp4 video track; fall back to any video track.
  const video = medias.find((m) => m.type === "video" && m.extension === "mp4")
    ?? medias.find((m) => m.type === "video");
  if (!video?.url) throw new Error(`scraper returned no video: ${JSON.stringify(json).slice(0, 150)}`);
  return { videoUrl: video.url, caption: json.title ?? null, author: json.author ?? null };
}

// Download the clip bytes for Gemini inline_data. Throws on any failure or oversize.
async function downloadClip(videoUrl: string): Promise<Uint8Array> {
  const media = await fetch(videoUrl);
  if (!media.ok) throw new Error(`clip download ${media.status}`);
  const buf = new Uint8Array(await media.arrayBuffer());
  if (buf.byteLength === 0) throw new Error("clip download empty");
  if (buf.byteLength > MAX_CLIP_BYTES) throw new Error(`clip too large (${buf.byteLength} bytes)`);
  return buf;
}
