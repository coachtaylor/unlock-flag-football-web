"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Props = {
  playerId: string;
  status: "active" | "inactive";
};

export default function PlayerStatusButton({ playerId, status }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = status === "active";
  const nextStatus = isActive ? "inactive" : "active";
  const label = isActive ? "Deactivate" : "Reactivate";

  async function handleClick() {
    setError(null);
    setSubmitting(true);
    const { error: updateErr } = await supabase
      .from("team_players")
      .update({ status: nextStatus })
      .eq("id", playerId);
    if (updateErr) {
      setError(updateErr.message);
      setSubmitting(false);
      return;
    }
    router.push("/roster");
    router.refresh();
  }

  return (
    <div className="mt-md">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="w-full py-lg rounded-xl text-body font-medium tracking-wide transition-opacity"
        style={{
          backgroundColor: "transparent",
          color: "var(--color-text-muted)",
          letterSpacing: "0.3px",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Saving…" : label}
      </button>
      {error && (
        <p
          className="text-caption mt-xs"
          style={{ color: "var(--color-error-light)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
