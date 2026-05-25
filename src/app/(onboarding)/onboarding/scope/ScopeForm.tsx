"use client";

import { useState, useTransition } from "react";
import {
  OnbStage,
  OnbCard,
  OnbHeader,
  OnbFooter,
  WebProgressDots,
  WebChoiceCard,
  OnbHint,
  OnbError,
} from "@/components/onboarding/shell";
import { OnbIcon } from "@/components/uff/icons";
import { submitScope } from "./actions";

type Scope = "single" | "league";

export default function ScopeForm() {
  const [scope, setScope] = useState<Scope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onContinue() {
    if (!scope || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await submitScope(scope);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <OnbStage step={2}>
      <OnbCard width={680}>
        <WebProgressDots step={2} />
        <OnbHeader
          eyebrow="SCOPE"
          title="Are you running a league or a single team?"
          subtitle="You can always add more later. League admins can manage many teams under one roof."
        />

        <div
          className="onb-scope-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <WebChoiceCard
            selected={scope === "single"}
            onClick={() => setScope("single")}
            icon={<OnbIcon.team size={24} />}
            title="Single team"
            body="I run one team. I'm a coach or a captain."
            footer="Most common"
          />
          <WebChoiceCard
            selected={scope === "league"}
            onClick={() => setScope("league")}
            icon={<OnbIcon.league size={24} />}
            title="League"
            body="I run multiple teams in a league, club, or program."
            footer="Admin features"
          />
        </div>

        {scope && (
          <OnbHint>
            {scope === "single"
              ? "Next, you'll pick your role on the team and set up the team itself."
              : "Next, you'll name your league. You'll add teams to it from the league dashboard."}
          </OnbHint>
        )}

        {error && <OnbError>{error}</OnbError>}

        <OnbFooter
          primaryLabel="Continue"
          primaryDisabled={!scope}
          primaryPending={pending}
          onPrimary={onContinue}
          backHref="/onboarding/name"
        />
      </OnbCard>

      <style>{`
        @media (max-width: 600px) {
          .onb-scope-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </OnbStage>
  );
}
