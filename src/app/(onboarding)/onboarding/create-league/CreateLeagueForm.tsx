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
  LeagueIdentityPreview,
} from "@/components/onboarding/shell";
import Segmented from "@/components/uff/Segmented";
import ColorSwatchRow from "@/components/uff/ColorSwatchRow";
import FieldIcon from "@/components/uff/FieldIcon";
import { teamColorHex, type TeamColorId } from "@/components/uff/team-colors";
import { Icon } from "@/components/uff/icons";
import { createOnboardingLeague } from "./actions";

type Format = "5v5" | "7v7" | "both";

export default function CreateLeagueForm() {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("7v7");
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
      const result = await createOnboardingLeague({
        leagueName: name,
        format,
        leagueColorId: color,
      });
      if (result && "error" in result) setError(result.error);
    });
  }

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
      <SummaryRow label="Scope" value="League" />
      <SummaryRow label="League" value={ready ? name : "—"} muted={!ready} />
      <SummaryRow label="Format" value={format.toUpperCase()} />
      <div style={{ height: 1, background: "var(--uff-line-soft)", margin: "4px 0" }} />
      <LeagueIdentityPreview
        name={name}
        colorHex={colorHex}
        format={format}
        ready={ready}
      />
      <OnbHint>
        After this, you'll land on the league dashboard where you can add your
        first team.
      </OnbHint>
    </>
  );

  return (
    <OnbStage step={4}>
      <form onSubmit={onSubmit} style={{ width: "100%" }}>
        <OnbCard width={560} withSummary={summary}>
          <WebProgressDots step={4} />
          <OnbHeader
            eyebrow="LEAGUE SETUP"
            title="Name your league."
            subtitle="You'll add teams next from the league dashboard."
          />

          <OnbField label="League name">
            <input
              className="fr-input"
              placeholder="e.g., Miami Youth Flag"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </OnbField>

          <OnbField label="Default format" optional="teams can override">
            <Segmented<Format>
              value={format}
              onChange={setFormat}
              cols={3}
              options={[
                { value: "5v5", label: "5v5", icon: <FieldIcon dots={5} /> },
                { value: "7v7", label: "7v7", icon: <FieldIcon dots={7} /> },
                { value: "both", label: "Both" },
              ]}
            />
          </OnbField>

          <OnbField
            label="League color"
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
            The league color appears on the league dashboard header. Each team
            picks its own.
          </OnbHint>

          {error && <OnbError>{error}</OnbError>}

          <OnbFooter
            primaryLabel="Create league"
            primaryType="submit"
            primaryDisabled={!ready}
            primaryPending={pending}
            backHref="/onboarding/scope"
          />
        </OnbCard>
      </form>
    </OnbStage>
  );
}
