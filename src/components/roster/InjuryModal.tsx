"use client";

// Branded modal for marking a player injured / healthy (Build 6.5c).
// Mounts inside the player detail page; the trigger button lives in
// the hero card so it's discoverable from the player's overview.
//
// Two states:
//   - Marking injured: required-ish note textarea (empty OK but
//     encouraged); primary CTA "Mark injured"
//   - Marking healthy: a single-line confirmation; primary CTA
//     "Mark healthy"
//
// Replaces the prior pattern of toggling is_injured + injury_note from
// inside the player edit form. Per MOBILE_APP_REFERENCE §6.5: injury
// controls live on the detail page, not in the edit form.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleInjury } from "@/lib/roster/injury-actions";

type Props = {
  playerId: string;
  teamId: string;
  playerName: string;
  currentlyInjured: boolean;
  currentNote: string | null;
};

export default function InjuryModal({
  playerId,
  teamId,
  playerName,
  currentlyInjured,
  currentNote,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(currentNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Reset local form state when the modal opens so the textarea always
  // matches the current persisted value (not a stale draft from a
  // previous open-and-cancel cycle).
  useEffect(() => {
    if (open) {
      setNote(currentNote ?? "");
      setError(null);
    }
  }, [open, currentNote]);

  // Close on Escape; focus the textarea (or the primary button when
  // marking healthy) when the modal opens.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  // The modal is asking the user to FLIP the current state — when
  // currentlyInjured, the action becomes "mark healthy" and vice versa.
  const nextInjured = !currentlyInjured;
  const cta = nextInjured ? "Mark injured" : "Mark healthy";
  const headline = nextInjured
    ? `Mark ${playerName} injured`
    : `Mark ${playerName} healthy`;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await toggleInjury({
        playerId,
        teamId,
        isInjured: nextInjured,
        note: nextInjured ? note : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  // Trigger button — sits inline wherever the parent renders the modal.
  const triggerLabel = currentlyInjured ? "Mark healthy" : "Mark injured";
  const triggerColor = currentlyInjured
    ? "var(--uff-lime, #c2ff3d)"
    : "var(--uff-red, #ff4d4d)";
  const triggerBg = currentlyInjured
    ? "rgba(194,255,61,0.10)"
    : "rgba(255,77,77,0.10)";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="wbtn"
        style={{
          background: triggerBg,
          color: triggerColor,
          borderColor: "transparent",
        }}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="injury-modal-headline"
          onClick={(e) => {
            // Click on the scrim closes; click inside the card doesn't.
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.62)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            zIndex: 50,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            ref={dialogRef}
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
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: 10.5,
                color: nextInjured
                  ? "var(--uff-red, #ff4d4d)"
                  : "var(--uff-lime, #c2ff3d)",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {nextInjured ? "Mark injured" : "Mark healthy"}
            </div>
            <h2
              id="injury-modal-headline"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--uff-text)",
              }}
            >
              {headline}
            </h2>

            {nextInjured ? (
              <>
                <p
                  style={{
                    marginTop: 8,
                    marginBottom: 14,
                    fontSize: 13,
                    color: "var(--uff-text)",
                    opacity: 0.78,
                    lineHeight: 1.5,
                  }}
                >
                  Roster cards, RSVP rows, and the attendance widget will
                  surface the injury. Add a quick note so co-captains know
                  what&apos;s going on.
                </p>
                <label
                  htmlFor="injury-modal-note"
                  style={{
                    display: "block",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 10.5,
                    color: "var(--uff-text-mute)",
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Injury note (optional)
                </label>
                <textarea
                  id="injury-modal-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Hamstring strain, day-to-day"
                  rows={3}
                  autoFocus
                  style={{
                    width: "100%",
                    background: "var(--uff-bg-2)",
                    border: "1px solid var(--uff-line)",
                    borderRadius: 8,
                    color: "var(--uff-text)",
                    fontSize: 13,
                    padding: 10,
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </>
            ) : (
              <p
                style={{
                  marginTop: 8,
                  marginBottom: 0,
                  fontSize: 13,
                  color: "var(--uff-text)",
                  opacity: 0.78,
                  lineHeight: 1.5,
                }}
              >
                Clears the injury flag and the saved note. The player
                will go back to a normal active state across the roster.
              </p>
            )}

            {error && (
              <p
                role="alert"
                style={{
                  marginTop: 12,
                  marginBottom: 0,
                  fontSize: 12.5,
                  color: "var(--uff-red, #ff4d4d)",
                }}
              >
                {error}
              </p>
            )}

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="wbtn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="wbtn primary"
                style={{
                  background: nextInjured
                    ? "var(--uff-red, #ff4d4d)"
                    : "var(--uff-lime, #c2ff3d)",
                  color: "#0b0b0d",
                  borderColor: "transparent",
                  opacity: pending ? 0.6 : 1,
                }}
              >
                {pending ? "Saving…" : cta}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
