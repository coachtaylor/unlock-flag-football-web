"use client";

import { useState, useTransition } from "react";
import {
  OnbStage,
  OnbCard,
  OnbHeader,
  OnbField,
  OnbFooter,
  WebProgressDots,
  OnbError,
} from "@/components/onboarding/shell";
import { submitName } from "./actions";
import { capitalizeName } from "@/lib/format/name";

export default function NameForm({
  initialFirst,
  initialLast,
}: {
  initialFirst: string;
  initialLast: string;
}) {
  const [first, setFirst] = useState(initialFirst);
  const [last, setLast] = useState(initialLast);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = first.trim().length > 0 && last.trim().length > 0;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await submitName(first, last);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <OnbStage step={1}>
      <form onSubmit={onSubmit} style={{ width: "100%" }}>
        <OnbCard width={520}>
          <WebProgressDots step={1} />
          <OnbHeader
            eyebrow="ABOUT YOU"
            title="Let's get you set up."
            subtitle="What should we call you? You can change this anytime from Settings."
          />

          <div className="onb-name-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <OnbField label="First name">
              <input
                className="fr-input"
                placeholder="e.g., Taylor"
                value={first}
                onChange={(e) => setFirst(capitalizeName(e.target.value))}
                autoFocus
                maxLength={50}
                name="firstName"
                autoComplete="given-name"
              />
            </OnbField>
            <OnbField label="Last name">
              <input
                className="fr-input"
                placeholder="e.g., Rivera"
                value={last}
                onChange={(e) => setLast(capitalizeName(e.target.value))}
                maxLength={50}
                name="lastName"
                autoComplete="family-name"
              />
            </OnbField>
          </div>

          <NamePreview first={first} last={last} />

          {error && <OnbError>{error}</OnbError>}

          <OnbFooter
            primaryLabel="Continue"
            primaryType="submit"
            primaryDisabled={!ready}
            primaryPending={pending}
            helper="We'll only show your name to people on your team."
          />
        </OnbCard>
      </form>

      <style>{`
        @media (max-width: 600px) {
          .onb-name-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </OnbStage>
  );
}

function NamePreview({ first, last }: { first: string; last: string }) {
  const ready = first.trim().length > 0 && last.trim().length > 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "rgba(255,255,255,0.025)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 12,
        opacity: ready ? 1 : 0.6,
        transition: "opacity 200ms ease",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--uff-orange)",
          color: "#0a0a0d",
          fontWeight: 700,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {(first[0] ?? "?").toUpperCase()}
        {(last[0] ?? "").toUpperCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>
          {ready ? `${first} ${last}` : "Your display name"}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--uff-text-mute)",
            fontFamily: "var(--font-mono)",
            letterSpacing: ".08em",
          }}
        >
          DISPLAY_NAME
        </span>
      </div>
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 10.5,
          color: "var(--uff-text-mute)",
          fontFamily: "var(--font-mono)",
          letterSpacing: ".08em",
        }}
      >
        {ready ? "PREVIEW" : "WAITING"}
      </span>
    </div>
  );
}
