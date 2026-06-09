"use server";

import { createClient } from "@/lib/supabase/server";
import { resolvePlatform } from "./platform";
import { canonicalSourceKey, FAIR_USE_MONTHLY_CAP, isOverCap } from "./dedupe";

type Result =
  | { ok: true; jobId: string }
  | { ok: false; error: string; existingDrillId?: string };

export async function requestDrillDraft(teamId: string, sourceUrl: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const key = canonicalSourceKey(sourceUrl);
  if (!key) return { ok: false, error: "That doesn't look like a valid link." };
  const platform = resolvePlatform(key) ?? "other";

  const { data: team } = await supabase.from("teams").select("plan").eq("id", teamId).single();
  if (team?.plan !== "pro") return { ok: false, error: "AI drafting is a Pro feature." };

  const { data: dupeDrill } = await supabase
    .from("team_drills").select("id").eq("team_id", teamId).eq("source_url", key).maybeSingle();
  if (dupeDrill) return { ok: false, error: "This link is already in your library.", existingDrillId: dupeDrill.id };

  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("ai_drill_jobs").select("id", { count: "exact", head: true })
    .eq("team_id", teamId).gte("created_at", monthStart.toISOString());
  if (isOverCap(count ?? 0)) return { ok: false, error: `Monthly limit of ${FAIR_USE_MONTHLY_CAP} AI drafts reached.` };

  // Store the RAW pasted URL for extraction — NOT the canonical dedupe key.
  // canonicalSourceKey strips www./trailing slash, which the TikTok scraper
  // rejects (→ no_signal). `key` stays the dedupe/cap key above; the edge
  // function extracts from this source_url.
  const { data: job, error } = await supabase
    .from("ai_drill_jobs")
    .insert({ team_id: teamId, created_by: user.id, source_kind: platform, source_url: sourceUrl.trim() })
    .select("id").single();
  if (error || !job) return { ok: false, error: error?.message ?? "Could not start the job." };

  await supabase.functions.invoke("draft-drill", { body: { jobId: job.id } });
  return { ok: true, jobId: job.id };
}

export async function retryDrillJob(jobId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("ai_drill_jobs")
    .update({ status: "queued", error_detail: null, finished_at: null }).eq("id", jobId);
  if (error) return { ok: false, error: error.message };
  await supabase.functions.invoke("draft-drill", { body: { jobId } });
  return { ok: true, jobId };
}

export async function setDrillJobFeedback(jobId: string, feedback: -1 | 1): Promise<void> {
  const supabase = await createClient();
  await supabase.from("ai_drill_jobs").update({ user_feedback: feedback }).eq("id", jobId);
}
