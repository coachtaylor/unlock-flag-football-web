"use client";

// Post-save prompt (Build 16.5b): when a captain is saved with full or
// view-only access, offer to generate an invite link that grants exactly
// that access and links to their freshly-created player row (so accepting
// doesn't make a duplicate). Closing — either path — navigates on.

import { useState, useTransition } from "react";
import { createInvite } from "@/lib/team/invite-actions";

export default function CaptainInvitePrompt({
  teamId,
  playerId,
  playerName,
  access,
  onClose,
}: {
  teamId: string;
  playerId: string;
  playerName: string;
  access: "full" | "view";
  onClose: () => void;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const accessLabel = access === "full" ? "full access" : "view-only access";
  const role = access === "full" ? "captain" : "team_manager";

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await createInvite({
        teamId,
        role,
        label: playerName,
        playerId,
        expiresInDays: null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLink(`${window.location.origin}/join/${res.token}`);
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy — select the link and copy manually.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cap-invite-headline"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.62)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 60,
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--uff-bg-1)",
          border: "1px solid var(--uff-line)",
          borderRadius: 14,
          padding: 22,
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--uff-orange)",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Captain access
        </div>
        <h2
          id="cap-invite-headline"
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--uff-text)",
          }}
        >
          {link ? "Invite link ready" : `Give ${playerName} ${accessLabel}?`}
        </h2>

        {link ? (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)", lineHeight: 1.5 }}>
              Send this to {playerName}. When they accept, they&rsquo;ll be
              linked to their roster spot with {accessLabel}. Works once.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--uff-surface-2)",
                border: "1px solid var(--uff-line-soft)",
                borderRadius: 10,
                padding: "8px 10px",
              }}
            >
              <code
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--uff-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {link}
              </code>
              <button type="button" className="wbtn" style={{ height: 30, flexShrink: 0 }} onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              type="button"
              className="wbtn primary"
              style={{ justifyContent: "center", height: 40 }}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)", lineHeight: 1.5 }}>
              {playerName} needs an account to log in with {accessLabel}.
              Generate an invite link to send them — or set it up later from
              the roster.
            </p>
            {error && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "rgba(255,77,77,0.08)",
                  border: "1px solid rgba(255,77,77,0.28)",
                  borderRadius: 10,
                  color: "#FF8A8A",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="wbtn ghost"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={onClose}
                disabled={pending}
              >
                Skip for now
              </button>
              <button
                type="button"
                className="wbtn primary"
                style={{ flex: 1, justifyContent: "center", opacity: pending ? 0.6 : 1 }}
                onClick={generate}
                disabled={pending}
              >
                {pending ? "Generating…" : "Generate invite link"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
