"use client";

// Backfill modal — shown over (app) routes when the user's
// onboarding is complete but profiles.first_name is null. Two-field,
// non-dismissible by design. Mounted from (app)/layout.tsx whenever the
// server-side check finds a backfill is needed.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OnbField, OnbError } from "@/components/onboarding/shell";
import { Icon } from "@/components/uff/icons";
import { submitBackfill } from "./BackfillModal.actions";

export default function BackfillModal() {
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = first.trim().length > 0 && last.trim().length > 0;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await submitBackfill(first, last);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      // Server marked the profile clean — re-render the layout so the
      // condition re-evaluates and the modal disappears.
      router.refresh();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="backfill-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      {/* Scrim */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(8, 9, 11, 0.72)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      <form
        onSubmit={onSubmit}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          background: "var(--uff-surface)",
          border: "1px solid var(--uff-line)",
          borderRadius: 20,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          fontFamily: "var(--font-sans)",
          color: "var(--uff-text)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".18em",
            color: "var(--uff-text-dim)",
          }}
        >
          <span
            style={{
              width: 3,
              height: 11,
              background: "var(--uff-orange)",
              borderRadius: 2,
            }}
          />
          QUICK UPDATE
        </div>

        <div>
          <h2
            id="backfill-title"
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            One quick thing.
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--uff-text-dim)",
            }}
          >
            We added a few new things to your account. Can you confirm your name
            so we get this right?
          </p>
        </div>

        <div
          className="backfill-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <OnbField label="First name">
            <input
              className="fr-input"
              placeholder="e.g., Taylor"
              autoFocus
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              maxLength={50}
            />
          </OnbField>
          <OnbField label="Last name">
            <input
              className="fr-input"
              placeholder="e.g., Rivera"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              maxLength={50}
            />
          </OnbField>
        </div>

        {error && <OnbError>{error}</OnbError>}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingTop: 6,
          }}
        >
          <span
            style={{
              fontSize: 11.5,
              color: "var(--uff-text-mute)",
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            We won't ask again. Your existing teams and history stay intact.
          </span>
          <button
            type="submit"
            disabled={!ready || pending}
            style={{
              height: 44,
              padding: "0 22px",
              background:
                !ready || pending ? "rgba(255,255,255,0.06)" : "var(--uff-orange)",
              color: !ready || pending ? "var(--uff-text-mute)" : "#1a0f08",
              border: 0,
              borderRadius: 12,
              fontFamily: "inherit",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: !ready || pending ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {pending ? "Saving…" : "Save and continue"}
            {!pending && <Icon.arrowRight size={14} />}
          </button>
        </div>
      </form>

      <style>{`
        @media (max-width: 480px) {
          .backfill-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
