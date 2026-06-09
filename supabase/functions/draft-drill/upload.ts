// Upload clip bytes to the Gemini Files API and return a file_uri usable in a
// file_data part. Needed because TikTok/IG clips routinely exceed Gemini's ~20 MB
// inline_data request ceiling (HD MP4s run 20–40 MB); the Files API allows up to
// 2 GB. Video uploads start in PROCESSING and must reach ACTIVE before they can be
// referenced in generateContent, so we poll. Every failure throws so index.ts
// records the reason in the job's error_detail.
const FILES_BASE = "https://generativelanguage.googleapis.com";
const PROCESS_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 1_500;

export async function uploadVideoToGemini(
  bytes: Uint8Array,
  apiKey: string,
  mimeType = "video/mp4",
): Promise<string> {
  // 1) Start a resumable upload — returns the upload URL in a response header.
  const startRes = await fetch(`${FILES_BASE}/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "content-type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "drill-clip" } }),
  });
  if (!startRes.ok) {
    throw new Error(`gemini files start ${startRes.status}: ${(await startRes.text()).slice(0, 150)}`);
  }
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("gemini files: no upload url in start response");

  // 2) Upload the bytes and finalize in one shot.
  const upRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
      "content-type": mimeType,
    },
    body: bytes,
  });
  if (!upRes.ok) throw new Error(`gemini files upload ${upRes.status}: ${(await upRes.text()).slice(0, 150)}`);

  let file = ((await upRes.json()) as { file?: GeminiFile }).file;
  if (!file?.uri || !file?.name) throw new Error("gemini files: no file uri after upload");

  // 3) Poll until the video is ACTIVE (it starts in PROCESSING).
  const deadline = Date.now() + PROCESS_TIMEOUT_MS;
  while (file.state === "PROCESSING") {
    if (Date.now() > deadline) throw new Error("gemini files: processing timeout");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const poll = await fetch(`${FILES_BASE}/v1beta/${file.name}?key=${apiKey}`);
    if (!poll.ok) throw new Error(`gemini files poll ${poll.status}`);
    file = (await poll.json()) as GeminiFile;
  }
  if (file.state !== "ACTIVE") throw new Error(`gemini files unusable state: ${file.state}`);
  return file.uri;
}

interface GeminiFile {
  uri: string;
  name: string;
  state?: "PROCESSING" | "ACTIVE" | "FAILED";
}
