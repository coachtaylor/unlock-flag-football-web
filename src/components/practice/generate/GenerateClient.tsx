"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generatePlan } from "@/lib/practice/generate/actions";
import type { WizardInput } from "@/lib/practice/generate/types";
import GenerateWizard from "./GenerateWizard";
import PreviewClient from "./PreviewClient";
import type { GeneratePageData, PreviewState } from "./generate-view-types";

export default function GenerateClient({ data }: { data: GeneratePageData }) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(input: Omit<WizardInput, "teamId">) {
    setPending(true);
    setError(null);
    const res = await generatePlan({ teamId: data.teamId, ...input });
    setPending(false);
    if (!res.ok) {
      setError(
        res.error === "no_skills"
          ? "No scouting data yet — run a benchmark first to unlock generation."
          : "Couldn't generate a plan. Try again.",
      );
      return;
    }
    setPreview({
      generationId: res.generationId,
      title: input.title,
      practiceDate: input.practiceDate,
      skeleton: res.skeleton,
      blockCandidates: res.blockCandidates,
      generated: res.generated,
      waterBreaks: res.waterBreaks,
    });
  }

  if (preview) {
    return (
      <PreviewClient
        teamId={data.teamId}
        state={preview}
        onRegenerateAll={() => setPreview(null)}
        onDiscard={() => router.push(`/dashboard/team/${data.teamId}/practice`)}
      />
    );
  }

  return <GenerateWizard data={data} pending={pending} error={error} onGenerate={handleGenerate} />;
}
