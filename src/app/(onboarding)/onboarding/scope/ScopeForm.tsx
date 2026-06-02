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
import { submitScope, joinByInvite } from "./actions";

type Scope = "single" | "league";

export default function ScopeForm() {
  const [scope, setScope] = useState<Scope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [inviteLink, setInviteLink] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitePending, startInvite] = useTransition();

  function onJoinInvite() {
    if (!inviteLink.trim() || invitePending) return;
    setInviteError(null);
    startInvite(async () => {
      const result = await joinByInvite(inviteLink);
      // Success redirects server-side; only an error returns.
      if (result && "error" in result) setInviteError(result.error);
    });
  }

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

        {/* Invited users join an existing team instead of creating one. */}
        <div
          style={{
            marginTop: 6,
            paddingTop: 18,
            borderTop: "1px solid var(--uff-line-soft)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--uff-text, #fff)",
              }}
            >
              Have an invite link?
            </span>
            <span style={{ fontSize: 12.5, color: "var(--uff-text-mute, #9aa0aa)" }}>
              Paste it to join a team a coach or captain invited you to.
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="fr-input"
              value={inviteLink}
              onChange={(e) => {
                setInviteLink(e.target.value);
                if (inviteError) setInviteError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onJoinInvite();
                }
              }}
              placeholder="https://…/join/your-invite-code"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              style={{ flex: "1 1 260px", minWidth: 0, fontSize: 13 }}
            />
            <button
              type="button"
              onClick={onJoinInvite}
              disabled={!inviteLink.trim() || invitePending}
              style={{
                height: 42,
                padding: "0 18px",
                borderRadius: 10,
                border: "1px solid var(--uff-line, rgba(255,255,255,0.16))",
                background: "var(--uff-surface-2, rgba(255,255,255,0.05))",
                color: "var(--uff-text, #fff)",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: !inviteLink.trim() || invitePending ? "default" : "pointer",
                opacity: !inviteLink.trim() || invitePending ? 0.5 : 1,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {invitePending ? "Joining…" : "Join team"}
            </button>
          </div>
          {inviteError && <OnbError>{inviteError}</OnbError>}
        </div>

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
