"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Format = "5v5" | "7v7" | "Both";

const FORMATS: Format[] = ["5v5", "7v7", "Both"];

export default function TeamSetupPage() {
  const [teamName, setTeamName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [format, setFormat] = useState<Format>("7v7");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await supabase.rpc("create_team_with_member", {
      p_team_name: teamName.trim(),
      p_organization_name: orgName.trim() || null,
      p_format: format,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    window.location.assign("/");
  }

  return (
    <div className="min-h-full flex items-center justify-center py-3xl">
      <div
        className="rounded-lg p-2xl"
        style={{
          backgroundColor: "var(--color-surface-raised)",
          width: "100%",
          maxWidth: "384px",
        }}
      >
        <h1 className="text-title mb-xs">Create your team</h1>
        <p
          className="text-caption mb-2xl"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Set up your team so you can build drills, log benchmarks, and plan practices.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <div className="flex flex-col gap-xs">
            <label
              htmlFor="teamName"
              className="label-micro"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Team name
            </label>
            <input
              id="teamName"
              type="text"
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g., Team 1"
              className="w-full rounded-md px-md text-body outline-none transition-colors"
              style={{
                height: "44px",
                backgroundColor: "var(--color-surface-base)",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>

          <div className="flex flex-col gap-xs">
            <label
              htmlFor="orgName"
              className="label-micro"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Organization (optional)
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g., your league or club"
              className="w-full rounded-md px-md text-body outline-none transition-colors"
              style={{
                height: "44px",
                backgroundColor: "var(--color-surface-base)",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>

          <div className="flex flex-col gap-xs">
            <span
              className="label-micro"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Format
            </span>
            <div className="flex gap-sm flex-wrap">
              {FORMATS.map((f) => {
                const selected = format === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    aria-pressed={selected}
                    className="rounded-pill text-caption font-medium transition-all"
                    style={{
                      padding: "8px 14px",
                      minHeight: "44px",
                      backgroundColor: selected
                        ? "#5C3308"
                        : "rgba(255,255,255,0.04)",
                      color: selected ? "#F0B870" : "rgba(255,255,255,0.45)",
                      border: selected
                        ? "1px solid #D48A30"
                        : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p
              className="text-caption"
              style={{ color: "var(--color-error-light)" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !teamName.trim()}
            className="w-full py-lg rounded-xl text-body font-medium tracking-wide transition-opacity"
            style={{
              backgroundColor: "var(--color-orange-500)",
              color: "#FFFFFF",
              letterSpacing: "0.3px",
              opacity: submitting || !teamName.trim() ? 0.6 : 1,
            }}
          >
            {submitting ? "Creating team…" : "Create Team"}
          </button>
        </form>
      </div>
    </div>
  );
}
