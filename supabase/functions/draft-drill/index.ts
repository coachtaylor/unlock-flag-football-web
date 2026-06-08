// Deno Edge Function: runs the extract → draft → validate pipeline for one job.
// Invoked (no await) by the requestDrillDraft server action. Updates the job row
// via the service-role client; the client watches the row over Realtime.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractSignals } from "./extract.ts";
import { draftDrill } from "./draft.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function setStatus(id: string, patch: Record<string, unknown>) {
  await supabase.from("ai_drill_jobs").update(patch).eq("id", id);
}

Deno.serve(async (req) => {
  const { jobId } = await req.json().catch(() => ({ jobId: null }));
  if (!jobId) return new Response("missing jobId", { status: 400 });

  const run = (async () => {
    const { data: job } = await supabase
      .from("ai_drill_jobs").select("*").eq("id", jobId).single();
    if (!job) return;
    try {
      await setStatus(jobId, { status: "extracting" });
      const signals = await extractSignals(job);
      if (!signals.transcript && signals.frames.length === 0) {
        await setStatus(jobId, {
          status: "no_signal",
          signal_sources: signals.sources,
          finished_at: new Date().toISOString(),
        });
        return;
      }
      await setStatus(jobId, {
        status: "drafting",
        raw_transcript: signals.transcript ?? null,
        signal_sources: signals.sources,
      });

      const { data: taxonomy } = await supabase.rpc("ai_drill_taxonomy", { p_team_id: job.team_id });
      const result = await draftDrill(signals, taxonomy);

      await setStatus(jobId, {
        status: "ready",
        draft_json: result.draft,
        field_confidence: result.confidence,
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: result.costUsd,
        finished_at: new Date().toISOString(),
      });
    } catch (e) {
      await setStatus(jobId, {
        status: "failed",
        error_detail: String(e instanceof Error ? e.message : e),
        finished_at: new Date().toISOString(),
      });
    }
  })();

  // @ts-ignore — EdgeRuntime keeps the function alive until the work finishes.
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(run);
  else await run;

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
});
