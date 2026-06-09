import { describe, it, expect } from "vitest";
import {
  buildGeminiRequest,
  parseGeminiDraft,
  geminiCostUsd,
  type ClipMedia,
  type Taxonomy,
} from "./gemini-core";

const TAX: Taxonomy = {
  phases: ["warmup", "individual", "team"],
  skills: [{ id: "s1", label: "Footwork" }, { id: "s2", label: "Catching" }],
  categories: [{ id: "c1", label: "Offense" }],
};

const TIKTOK: ClipMedia = {
  platform: "tiktok",
  mp4Bytes: new Uint8Array([0, 1, 2, 3]),
  youtubeUrl: null,
  caption: "5-10-5 pro agility",
  author: "coachx",
};

const YT: ClipMedia = {
  platform: "youtube",
  mp4Bytes: null,
  youtubeUrl: "https://youtu.be/abc123",
  caption: null,
  author: null,
};

describe("buildGeminiRequest", () => {
  it("uses inline_data for TikTok/IG bytes", () => {
    const req = buildGeminiRequest(TIKTOK, TAX);
    const parts = req.contents[0].parts;
    const media = parts.find((p: any) => "inline_data" in p) as any;
    expect(media.inline_data.mime_type).toBe("video/mp4");
    expect(media.inline_data.data).toBe(btoa("\x00\x01\x02\x03")); // base64 of the bytes
    expect(parts.some((p: any) => "file_data" in p)).toBe(false);
  });

  it("uses file_data with the URL for YouTube", () => {
    const req = buildGeminiRequest(YT, TAX);
    const parts = req.contents[0].parts;
    const media = parts.find((p: any) => "file_data" in p) as any;
    expect(media.file_data.file_uri).toBe("https://youtu.be/abc123");
    expect(parts.some((p: any) => "inline_data" in p)).toBe(false);
  });

  it("includes caption + taxonomy in the text context and forces JSON output", () => {
    const req = buildGeminiRequest(TIKTOK, TAX);
    const text = (req.contents[0].parts.find((p: any) => "text" in p) as any).text;
    expect(text).toContain("5-10-5 pro agility");
    expect(text).toContain("warmup");
    expect(text).toContain("s1");
    expect(req.generationConfig.responseMimeType).toBe("application/json");
    // No enum on phase (Gemini rejects null-in-enum); nullable string, validated in parse.
    expect((req.generationConfig.responseSchema as any).properties.phase)
      .toEqual({ type: "string", nullable: true });
    expect(req.systemInstruction.parts[0].text).toContain("FLAG FOOTBALL");
  });
});

function geminiResponse(input: Record<string, unknown>, inT = 8000, outT = 600) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(input) }] } }],
    usageMetadata: { promptTokenCount: inT, candidatesTokenCount: outT },
  };
}

describe("parseGeminiDraft", () => {
  it("maps a well-formed response to the draft contract", () => {
    const res = geminiResponse({
      name: "5-10-5 Shuttle", description: "Pro agility shuttle.",
      coaching_cues: ["stay low", "snap hips"], category_id: "c1",
      phase: "individual", skill_ids: ["s1"],
      equipment: { cones: 3, other: ["stopwatch"] }, source_author: "coachx",
      confidence: { description: 0.9 },
    });
    const { draft, inputTokens, outputTokens } = parseGeminiDraft(res, TAX);
    expect(draft.name).toBe("5-10-5 Shuttle");
    expect(draft.phase).toBe("individual");
    expect(draft.skill_ids).toEqual(["s1"]);
    expect(draft.equipment).toEqual({ cones: 3, other: ["stopwatch"] });
    expect(inputTokens).toBe(8000);
    expect(outputTokens).toBe(600);
  });

  it("drops out-of-taxonomy phase and skill ids, clamps cues to 5", () => {
    const res = geminiResponse({
      name: "x", description: "y",
      coaching_cues: ["a", "b", "c", "d", "e", "f"],
      phase: "NOT_A_PHASE", skill_ids: ["s1", "bogus"],
    });
    const { draft } = parseGeminiDraft(res, TAX);
    expect(draft.phase).toBeNull();
    expect(draft.skill_ids).toEqual(["s1"]);
    expect(draft.coaching_cues).toHaveLength(5);
  });

  it("defaults missing fields safely", () => {
    const { draft } = parseGeminiDraft(geminiResponse({ description: "only desc" }), TAX);
    expect(draft.name).toBe("Untitled drill");
    expect(draft.coaching_cues).toEqual([]);
    expect(draft.equipment).toEqual({ cones: null, other: [] });
    expect(draft.skill_ids).toEqual([]);
  });

  it("throws loudly when there is no JSON candidate", () => {
    expect(() => parseGeminiDraft({ candidates: [] }, TAX)).toThrow(/no draft json/i);
  });
});

describe("geminiCostUsd", () => {
  it("prices Flash and Pro per model", () => {
    // Flash: 8000 in @ $0.30/M + 600 out @ $2.50/M
    expect(geminiCostUsd(8000, 600, "gemini-2.5-flash")).toBeCloseTo(0.0024 + 0.0015, 6);
    // Pro: 8000 in @ $1.25/M + 600 out @ $10/M
    expect(geminiCostUsd(8000, 600, "gemini-2.5-pro")).toBeCloseTo(0.010 + 0.006, 6);
  });
});
