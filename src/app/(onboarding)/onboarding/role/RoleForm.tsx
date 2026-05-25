"use client";

import { useState, useTransition } from "react";
import {
  OnbStage,
  OnbCard,
  OnbHeader,
  OnbFooter,
  WebProgressDots,
  WebChoiceCard,
  OnbError,
} from "@/components/onboarding/shell";
import { OnbIcon } from "@/components/uff/icons";
import { submitRole } from "./actions";

type Role = "coach" | "captain";

export default function RoleForm() {
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onContinue() {
    if (!role || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await submitRole(role);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <OnbStage step={3}>
      <OnbCard width={680}>
        <WebProgressDots step={3} />
        <OnbHeader
          eyebrow="YOUR ROLE"
          title="What's your role on the team?"
          subtitle="This decides whether you show up on the roster as a player too."
        />

        <div
          className="onb-role-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <WebChoiceCard
            selected={role === "coach"}
            onClick={() => setRole("coach")}
            icon={<OnbIcon.coach size={24} />}
            title="Coach"
            body="I run practices and manage the team. I'm not on the roster."
            footer="No player row"
          />
          <WebChoiceCard
            selected={role === "captain"}
            onClick={() => setRole("captain")}
            icon={<OnbIcon.captain size={24} />}
            title="Captain"
            body="I'm a player who also runs the team. Put me on the roster."
            footer="Captain tag"
          />
        </div>

        {role && (
          <div
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid var(--uff-line-soft)",
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 10.5,
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
              WHAT WE'LL DO
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--uff-text-dim)",
                lineHeight: 1.55,
              }}
            >
              {role === "coach" ? (
                <>
                  You'll be added as{" "}
                  <span style={{ color: "var(--uff-text)", fontWeight: 600 }}>
                    coach
                  </span>{" "}
                  on the team you create next — no player row.
                </>
              ) : (
                <>
                  You'll be added as{" "}
                  <span style={{ color: "var(--uff-text)", fontWeight: 600 }}>
                    captain
                  </span>{" "}
                  and put on the roster with the{" "}
                  <span style={{ color: "var(--uff-text)", fontWeight: 600 }}>
                    captain
                  </span>{" "}
                  tag.
                </>
              )}
            </div>
          </div>
        )}

        {error && <OnbError>{error}</OnbError>}

        <OnbFooter
          primaryLabel="Continue"
          primaryDisabled={!role}
          primaryPending={pending}
          onPrimary={onContinue}
          backHref="/onboarding/scope"
        />
      </OnbCard>

      <style>{`
        @media (max-width: 600px) {
          .onb-role-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </OnbStage>
  );
}
