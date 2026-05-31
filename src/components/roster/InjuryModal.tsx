"use client";

// Branded modal for marking a player injured / healthy (Build 6.5c,
// refactored 2026-05-27 for clearer action affordance + roster reuse).
//
// Two states:
//   - Marking injured: required-ish note textarea (empty OK but
//     encouraged); primary CTA "Mark injured"
//   - Marking healthy: a single-line confirmation; primary CTA
//     "Mark healthy"
//
// Trigger modes:
//   - Inline (default): the modal renders its own trigger button. The
//     button now reads as an action — neutral surface with red accent
//     + plus icon — instead of the previous solid-red pill that looked
//     like a status badge ("Mark injured" sitting next to the red
//     INJURED status pill on the roster list).
//   - Controlled: the parent owns `open` + `onOpenChange` and renders
//     no inline trigger. Used by RosterListClient so one modal
//     instance serves the whole list, opened with a per-row kebab.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleInjury } from "@/lib/roster/injury-actions";
import { Icon } from "@/components/uff/icons";

type Props = {
  playerId: string;
  teamId: string;
  playerName: string;
  currentlyInjured: boolean;
  currentNote: string | null;
  // Controlled mode: parent supplies open + setter. When provided, the
  // inline trigger button is suppressed.
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
};

export default function InjuryModal({
  playerId,
  teamId,
  playerName,
  currentlyInjured,
  currentNote,
  open: openProp,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const controlled = typeof openProp === "boolean";
  const [openState, setOpenState] = useState(false);
  const open = controlled ? !!openProp : openState;
  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setOpenState(next);
  };

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
    // setOpen is stable enough for this purpose — controlled callers
    // provide a stable setter; uncontrolled uses the local setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <>
      {!controlled && (
        <InjuryTriggerButton
          currentlyInjured={currentlyInjured}
          onClick={() => setOpen(true)}
        />
      )}

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

// Inline trigger styled as an ACTION, not a status badge.
//
// Previous version was solid red text on red-tinted background, which
// sat right next to the red INJURED status pill on the player detail
// hero and read as "this player is marked injured." Now: neutral
// surface, red text + plus icon, outlined hover. Reads as a button.
function InjuryTriggerButton({
  currentlyInjured,
  onClick,
}: {
  currentlyInjured: boolean;
  onClick: () => void;
}) {
  const accent = currentlyInjured
    ? "var(--uff-lime, #c2ff3d)"
    : "var(--uff-red, #ff4d4d)";
  const accentBorder = currentlyInjured
    ? "rgba(194,255,61,0.42)"
    : "rgba(255,77,77,0.42)";
  const accentHoverBg = currentlyInjured
    ? "rgba(194,255,61,0.08)"
    : "rgba(255,77,77,0.08)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="wbtn injury-trigger"
      style={{
        background: "transparent",
        color: accent,
        border: `1px solid ${accentBorder}`,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = accentHoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon.plus size={12} />
      {currentlyInjured ? "Mark healthy" : "Mark injured"}
    </button>
  );
}
