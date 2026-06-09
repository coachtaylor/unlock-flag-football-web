// Single Gemini video call. Watches the clip + reads caption/taxonomy context and
// returns a structured, taxonomy-validated drill draft. Pure request/parse/cost
// logic lives in gemini-core.ts (unit-tested); this file only supplies the key,
// the fetch, and loud error surfacing.
import { GEMINI_MODEL, buildGeminiRequest, parseGeminiDraft, geminiCostUsd } from "./gemini-core.ts";
import type { ClipMedia, Taxonomy } from "./gemini-core.ts";
import { uploadVideoToGemini } from "./upload.ts";

export async function draftDrill(media: ClipMedia, taxonomy: Taxonomy) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  // Resolve the clip to a Gemini file_uri: TikTok/IG bytes upload via the Files API
  // (no 20 MB inline ceiling); a YouTube URL is handed to Gemini as-is. Either way
  // the request uses a file_data part — buildGeminiRequest keys that off `youtubeUrl`.
  const fileUri = media.mp4Bytes
    ? await uploadVideoToGemini(media.mp4Bytes, apiKey)
    : media.youtubeUrl;
  const body = buildGeminiRequest({ ...media, mp4Bytes: null, youtubeUrl: fileUri }, taxonomy);
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 150)}`);

  const data = await res.json();
  const { draft, inputTokens, outputTokens } = parseGeminiDraft(data, taxonomy);

  return {
    draft,
    model: GEMINI_MODEL,
    inputTokens,
    outputTokens,
    costUsd: geminiCostUsd(inputTokens, outputTokens),
    confidence: draft.confidence,
  };
}
