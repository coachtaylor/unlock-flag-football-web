// Single Claude call with a taxonomy-constrained tool. Reads transcript + frames
// (on-screen text) and returns a structured drill draft. Validates tags against
// the taxonomy; drops anything invalid.
import type { Signals } from "./extract.ts";

interface Taxonomy {
  phases: string[];
  skills: { id: string; label: string }[];
  categories: { id: string; label: string }[];
}

export async function draftDrill(signals: Signals, taxonomy: Taxonomy) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  const model = "claude-sonnet-4-5";

  const tool = {
    name: "draft_drill",
    description: "Return a structured flag-football drill drafted from the clip.",
    input_schema: {
      type: "object",
      required: ["name", "description", "coaching_cues", "phase", "skill_ids"],
      properties: {
        name: { type: "string" },
        description: { type: "string", maxLength: 600 },
        coaching_cues: { type: "array", items: { type: "string" }, maxItems: 5 },
        category_id: { type: ["string", "null"], enum: [...taxonomy.categories.map((c) => c.id), null] },
        phase: { type: ["string", "null"], enum: [...taxonomy.phases, null] },
        skill_ids: { type: "array", items: { type: "string", enum: taxonomy.skills.map((s) => s.id) } },
        equipment: { type: "object", properties: { cones: { type: ["integer", "null"] }, other: { type: "array", items: { type: "string" } } } },
        source_author: { type: ["string", "null"] },
        confidence: { type: "object" },
      },
    },
  };

  const system =
    "You draft FLAG FOOTBALL drills only. Output must be specific to flag football " +
    "(5v5/7v7), never generic or other-sport. Use ONLY the provided phase and skill " +
    "ids. Read both the transcript and any on-screen text in the frames. If the clip " +
    "doesn't describe a runnable drill, set phase=null and keep description short. " +
    "Skills must belong to the chosen phase.";

  const content: unknown[] = [];
  if (signals.transcript) content.push({ type: "text", text: `Transcript:\n${signals.transcript}` });
  for (const f of signals.frames) {
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.replace(/^data:[^,]+,/, "") } });
  }
  content.push({ type: "text", text: `Available phases: ${JSON.stringify(taxonomy.phases)}\nAvailable skills: ${JSON.stringify(taxonomy.skills)}\nAvailable categories: ${JSON.stringify(taxonomy.categories)}` });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: [tool],
      tool_choice: { type: "tool", name: "draft_drill" },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const block = data.content?.find((b: { type: string }) => b.type === "tool_use");
  if (!block) throw new Error("no tool_use in response");
  const raw = block.input as Record<string, unknown>;

  const validSkillIds = new Set(taxonomy.skills.map((s) => s.id));
  const skill_ids = ((raw.skill_ids as string[]) ?? []).filter((id) => validSkillIds.has(id));
  const phase = taxonomy.phases.includes(raw.phase as string) ? (raw.phase as string) : null;

  const draft = {
    name: String(raw.name ?? "").slice(0, 200) || "Untitled drill",
    description: String(raw.description ?? ""),
    coaching_cues: ((raw.coaching_cues as string[]) ?? []).slice(0, 5),
    category: (raw.category_id as string) ?? null,
    phase,
    skill_ids,
    equipment: {
      cones: (raw.equipment as { cones?: number })?.cones ?? null,
      other: (raw.equipment as { other?: string[] })?.other ?? [],
    },
    source_author: (raw.source_author as string) ?? null,
    confidence: (raw.confidence as Record<string, number>) ?? {},
  };

  const inT = data.usage?.input_tokens ?? 0;
  const outT = data.usage?.output_tokens ?? 0;
  const costUsd = (inT / 1e6) * 3 + (outT / 1e6) * 15;
  return { draft, model, inputTokens: inT, outputTokens: outT, costUsd, confidence: draft.confidence };
}
