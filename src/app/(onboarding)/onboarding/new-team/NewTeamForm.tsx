"use client";

import { useState, useTransition } from "react";
import {
  OnbStage,
  OnbCard,
  OnbHeader,
  OnbField,
  OnbFooter,
  WebProgressDots,
  OnbHint,
  OnbError,
  SummaryRow,
  TeamIdentityPreview,
} from "@/components/onboarding/shell";
import Segmented from "@/components/uff/Segmented";
import ColorSwatchRow from "@/components/uff/ColorSwatchRow";
import FieldIcon from "@/components/uff/FieldIcon";
import { teamColorHex, type TeamColorId } from "@/components/uff/team-colors";
import { Icon } from "@/components/uff/icons";
import { createOnboardingTeam } from "./actions";

type Format = "5v5" | "7v7" | "11v11";

export default function NewTeamForm({ role }: { role: "coach" | "captain" }) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("5v5");
  const [color, setColor] = useState<TeamColorId>("orange");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = name.trim().length > 0;
  const colorHex = teamColorHex(color);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await createOnboardingTeam({
        teamName: name,
        format,
        teamColorId: color,
        role,
      });
      if (result && "error" in result) setError(result.error);
    });
  }

  const roleCap = role.charAt(0).toUpperCase() + role.slice(1);

  const summary = (
    <>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".18em",
          color: "var(--uff-text-mute)",
        }}
      >
        YOUR PICKS
      </div>
      <SummaryRow label="Scope" value="Single team" />
      <SummaryRow label="Role" value={roleCap} />
      <SummaryRow label="Team" value={ready ? name : "—"} muted={!ready} />
      <div style={{ height: 1, background: "var(--uff-line-soft)", margin: "4px 0" }} />
      <TeamIdentityPreview
        name={name}
        colorHex={colorHex}
        format={format}
        role={role}
        ready={ready}
      />
      <OnbHint>
        {role === "captain"
          ? "After this, you'll see your team dashboard with you on the roster as captain."
          : "After this, you'll see your team dashboard. Invite players from the Roster tab."}
      </OnbHint>
    </>
  );

  return (
    <OnbStage step={4}>
      <form onSubmit={onSubmit} style={{ width: "100%" }}>
        <OnbCard width={560} withSummary={summary}>
          <WebProgressDots step={4} />
          <OnbHeader
            eyebrow="TEAM SETUP"
            title="Name your team."
            subtitle="A short, recognizable name your players will use. You can rename anytime."
          />

          <OnbField label="Team name">
            <input
              className="fr-input"
              placeholder="e.g., Coral Sharks"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </OnbField>

          <OnbField label="Default format" optional="game-day default">
            <Segmented<Format>
              value={format}
              onChange={setFormat}
              cols={3}
              options={[
                { value: "5v5", label: "5v5", icon: <FieldIcon dots={5} /> },
                { value: "7v7", label: "7v7", icon: <FieldIcon dots={7} /> },
                { value: "11v11", label: "11v11" },
              ]}
            />
          </OnbField>

          <OnbField
            label="Team color"
            right={
              <span
                style={{
                  fontSize: 10.5,
                  color: colorHex,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: ".08em",
                }}
              >
                {colorHex}
              </span>
            }
          >
            <ColorSwatchRow value={color} onChange={setColor} />
          </OnbField>

          <OnbHint icon={<Icon.pin size={12} />}>
            The color shows up across the team dashboard, practice plans, and
            benchmark cards.
          </OnbHint>

          {error && <OnbError>{error}</OnbError>}

          <OnbFooter
            primaryLabel={role === "captain" ? "Create team & join roster" : "Create team"}
            primaryType="submit"
            primaryDisabled={!ready}
            primaryPending={pending}
            backHref={`/onboarding/role?scope=single`}
          />
        </OnbCard>
      </form>
    </OnbStage>
  );
}
