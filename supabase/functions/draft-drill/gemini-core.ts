// gemini-core.ts — PURE. No Deno globals, no network, no jsr imports.
// Unit-tested by gemini-core.test.ts; the Deno wrapper (draft.ts) supplies the key + fetch.

export interface ClipMedia {
  platform: "tiktok" | "instagram" | "youtube";
  mp4Bytes: Uint8Array | null; // TikTok/IG: downloaded clip
  youtubeUrl: string | null;   // YouTube: handed straight to Gemini
  caption: string | null;
  author: string | null;
}

export interface Taxonomy {
  phases: string[];
  skills: { id: string; label: string }[];
  categories: { id: string; label: string }[];
}

export interface DrillDraft {
  name: string;
  description: string;
  coaching_cues: string[];
  category: string | null;
  phase: string | null;
  skill_ids: string[];
  equipment: { cones: number | null; other: string[] };
  source_author: string | null;
  confidence: Record<string, number>;
}

export const GEMINI_MODEL = "gemini-2.5-flash"; // original config; Pro + prompt/fps tuning tested worse for descriptions

// Per-million-token pricing by model, so cost_usd stays correct across a model swap.
const GEMINI_PRICING: Record<string, { in: number; out: number }> = {
  "gemini-2.5-flash": { in: 0.30, out: 2.50 },
  "gemini-2.5-pro": { in: 1.25, out: 10.0 },
};

const SYSTEM_PROMPT =
  "You draft FLAG FOOTBALL drills only (5v5/7v7), never generic or other-sport.\n\n" +
  "Write the DESCRIPTION strictly from what you SEE in the video: count the players and " +
  "cones actually shown, describe the real setup and the sequence of movements in order, " +
  "and what success looks like. Do NOT invent rules, player counts, distances, or mechanics " +
  "that aren't visible. The caption may give the drill's NAME but not its mechanics (and can " +
  "be wrong) — derive how the drill works ONLY from the video, never from the name or a " +
  "textbook version of a similarly-named drill. If a detail isn't clearly visible, describe " +
  "it loosely instead of guessing. 3-5 sentences: setup, execution, objective.\n\n" +
  "Coaching cues: short, specific, drawn from what's shown. Audio may be music; ignore it " +
  "unless a coach is clearly instructing. Use ONLY the provided phase and skill ids; skills " +
  "must belong to the chosen phase. If it is not a runnable drill, set phase=null.";

// Base64-encode raw bytes without Node Buffer (works in Deno + vitest/node).
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function buildGeminiRequest(media: ClipMedia, taxonomy: Taxonomy) {
  // Sample at 5 fps (vs Gemini's 1 fps default) so the model sees the actual movement
  // sequence — denser frames are what let it describe the real drill instead of a generic one.
  const videoMetadata = { fps: 5 };
  const mediaPart = media.youtubeUrl
    ? { file_data: { file_uri: media.youtubeUrl }, videoMetadata }
    : { inline_data: { mime_type: "video/mp4", data: bytesToBase64(media.mp4Bytes ?? new Uint8Array()) }, videoMetadata };

  const contextLines = [
    media.author ? `Author: @${media.author}` : null,
    media.caption ? `Caption: ${media.caption}` : null,
    `Available phases: ${JSON.stringify(taxonomy.phases)}`,
    `Available skills: ${JSON.stringify(taxonomy.skills)}`,
    `Available categories: ${JSON.stringify(taxonomy.categories)}`,
  ].filter(Boolean).join("\n");

  // No `enum` constraints on phase/category/skill_ids: Gemini's responseSchema enum
  // accepts strings only (a `null` member 400s), and combining nullable+enum is
  // brittle. The allowed values are supplied in the prompt context above, and
  // parseGeminiDraft() is the real guarantee — it drops anything off-taxonomy.
  const responseSchema = {
    type: "object",
    required: ["name", "description", "coaching_cues", "phase", "skill_ids"],
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      coaching_cues: { type: "array", items: { type: "string" }, maxItems: 5 },
      category_id: { type: "string", nullable: true },
      phase: { type: "string", nullable: true },
      skill_ids: { type: "array", items: { type: "string" } },
      equipment: {
        type: "object",
        properties: {
          cones: { type: "integer", nullable: true },
          other: { type: "array", items: { type: "string" } },
        },
      },
      source_author: { type: "string", nullable: true },
      confidence: { type: "object" },
    },
  };

  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [mediaPart, { text: contextLines }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
      mediaResolution: "MEDIA_RESOLUTION_HIGH", // sharper frames → reads cones/players/setup more reliably
    },
  };
}

export function geminiCostUsd(inputTokens: number, outputTokens: number, model: string = GEMINI_MODEL): number {
  const p = GEMINI_PRICING[model] ?? GEMINI_PRICING["gemini-2.5-flash"];
  return (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out;
}

export function parseGeminiDraft(data: any, taxonomy: Taxonomy):
  { draft: DrillDraft; inputTokens: number; outputTokens: number } {
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!text) throw new Error("gemini: no draft json in response");

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`gemini: response was not valid JSON: ${text.slice(0, 150)}`);
  }

  const validSkillIds = new Set(taxonomy.skills.map((s) => s.id));
  const skill_ids = ((raw.skill_ids as string[]) ?? []).filter((id) => validSkillIds.has(id));
  const phase = taxonomy.phases.includes(raw.phase as string) ? (raw.phase as string) : null;
  const equipment = (raw.equipment as { cones?: number; other?: string[] }) ?? {};

  const draft: DrillDraft = {
    name: String(raw.name ?? "").slice(0, 200) || "Untitled drill",
    description: String(raw.description ?? "").slice(0, 2000), // generous safety cap; 600 chopped real drill descriptions mid-sentence
    coaching_cues: ((raw.coaching_cues as string[]) ?? []).slice(0, 5),
    category: (raw.category_id as string) ?? null,
    phase,
    skill_ids,
    equipment: { cones: equipment.cones ?? null, other: equipment.other ?? [] },
    source_author: (raw.source_author as string) ?? null,
    confidence: (raw.confidence as Record<string, number>) ?? {},
  };

  return {
    draft,
    inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
