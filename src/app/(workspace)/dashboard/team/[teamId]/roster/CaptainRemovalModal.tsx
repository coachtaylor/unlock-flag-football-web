"use client";

// Shown when a captain who has app access has their Captain tag removed
// (migration 90). Removing the tag revokes their coach-side membership; the
// captain then chooses whether to keep the person as a name-only player or
// drop them from the roster entirely. Mirrors the RemoveStaffButton modal
// shell so confirm dialogs read consistently across the roster.

import { useEffect } from "react";

export default function CaptainRemovalModal({
  playerName,
  pending,
  error,
  onKeep,
  onRemove,
  onCancel,
}: {
  playerName: string;
  pending: boolean;
  error: string | null;
  onKeep: () => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cap-remove-headline"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
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
          Remove captain
        </div>
        <h2
          id="cap-remove-headline"
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--uff-text)",
          }}
        >
          Remove {playerName} as captain?
        </h2>
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
          {playerName} has app access as a captain. Removing the captain tag
          revokes that access. Keep them on the roster as a regular player, or
          remove them from the roster entirely (this also deletes their
          benchmark history).
        </p>

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
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="wbtn"
            style={{ height: 42 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="wbtn"
            style={{
              height: 42,
              background: "transparent",
              color: "var(--uff-red)",
              border: "1px solid rgba(255,77,77,0.42)",
              opacity: pending ? 0.6 : 1,
            }}
          >
            Remove from roster
          </button>
          <button
            type="button"
            onClick={onKeep}
            disabled={pending}
            className="wbtn primary"
            style={{ height: 42, flex: 1, justifyContent: "center", opacity: pending ? 0.6 : 1 }}
          >
            {pending ? "Saving…" : "Keep as player"}
          </button>
        </div>
      </div>
    </div>
  );
}
