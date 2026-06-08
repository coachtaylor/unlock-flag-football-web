"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { resolvePlatform } from "@/lib/ai-drill/platform";
import { requestDrillDraft, retryDrillJob } from "@/lib/ai-drill/actions";
import type { DrillJob, DrillJobStatus } from "@/lib/ai-drill/types";

const STATUS_COPY: Record<DrillJobStatus, string> = {
  queued: "Queued…",
  extracting: "Reading the clip…",
  drafting: "Drafting the drill…",
  ready: "Ready",
  no_signal: "This link doesn't look like a drill.",
  failed: "Couldn't read this clip.",
};

export default function PasteLinkClient({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<DrillJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const platform = url.trim() ? resolvePlatform(url) : null;

  useEffect(() => {
    if (!jobId) return;
    const channel = supabase
      .channel(`ai_drill_jobs:${jobId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "ai_drill_jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          const job = payload.new as DrillJob;
          setStatus(job.status);
          if (job.status === "ready" || job.status === "no_signal") {
            router.push(`/dashboard/team/${teamId}/drills/from-link/${jobId}`);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobId, teamId, router]);

  async function onSubmit() {
    setError(null);
    const res = await requestDrillDraft(teamId, url);
    if (!res.ok) { setError(res.error); return; }
    setJobId(res.jobId);
    setStatus("queued");
  }

  const running = !!jobId && status !== "failed" && status !== "no_signal";

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 20 }}>
      <h1>Paste a drill link</h1>
      <p>Watch a link turn into a structured, source-credited drill.</p>

      <label>PASTE A DRILL LINK {platform ? `· ${platform.toUpperCase()}` : ""}</label>
      <input
        placeholder="youtube.com/watch?v=…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={running}
        style={{ width: "100%" }}
      />
      <button onClick={onSubmit} disabled={running || !url.trim()}>
        {running ? STATUS_COPY[status ?? "queued"] : "Read it in →"}
      </button>

      {error ? <p role="alert">{error}</p> : null}

      {status === "failed" ? (
        <div>
          <p>{STATUS_COPY.failed}</p>
          <button onClick={() => { if (jobId) retryDrillJob(jobId); }}>Try again</button>
        </div>
      ) : null}
    </div>
  );
}
