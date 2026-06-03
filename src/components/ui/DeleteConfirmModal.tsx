"use client";

// Generic destructive confirmation. To stop an accidental click from wiping
// a record + its data, the user must type the record's name back exactly
// (case-sensitive). The confirm button stays disabled until it matches.
//
// Records with no real name (e.g. an untitled practice) pass name=null to
// skip the typing gate and fall back to a plain confirm — still a deliberate
// two-step action.
//
// Canonical home for the type-to-confirm pattern: DeletePlanModal (practice)
// and the drill library both render this.

import { useState } from "react";

export default function DeleteConfirmModal({
  open,
  name,
  noun = "item",
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /**
   * The name the user must re-type to confirm (case-sensitive). Empty /
   * null / whitespace => no real name, so the typing gate is skipped.
   */
  name: string | null | undefined;
  /** Lowercase singular noun for the copy, e.g. "practice" | "drill". */
  noun?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [value, setValue] = useState("");
  // Reset the typed value each time the modal opens, using React's
  // adjust-state-on-prop-change pattern (no effect → no cascading-render lint).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue("");
  }

  if (!open) return null;
  const hasName = !!name && name.trim().length > 0;
  const matches = !hasName || value === name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--uff-surface, #161C24)",
          border: "1px solid var(--uff-line-soft, rgba(255,255,255,0.08))",
          borderRadius: 14,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--uff-red, #ff4d4d)",
          }}
        >
          Delete permanently
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--uff-text, #fff)" }}>
          This can&apos;t be undone.
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.45,
            color: "var(--uff-text-dim, rgba(255,255,255,0.6))",
          }}
        >
          {hasName
            ? `Deleting removes the ${noun} and all of its data for good. To confirm, type the ${noun} name below.`
            : `Deleting removes this ${noun} and all of its data for good.`}
        </p>

        {hasName && (
          <>
            <div
              style={{
                background: "var(--uff-bg, #0D1117)",
                borderRadius: 8,
                padding: "8px 12px",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 13,
                color: "var(--uff-text, #fff)",
                wordBreak: "break-word",
              }}
            >
              {name}
            </div>

            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Type the ${noun} name`}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              style={{
                width: "100%",
                fontSize: 15,
                color: "var(--uff-text, #fff)",
                background: "var(--uff-bg, #0D1117)",
                border: `1px solid ${
                  matches ? "var(--uff-red, #ff4d4d)" : "var(--uff-line, rgba(255,255,255,0.14))"
                }`,
                borderRadius: 8,
                padding: "11px 12px",
                outline: "none",
              }}
            />
          </>
        )}

        {error && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.4,
              color: "var(--uff-red, #ff4d4d)",
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            disabled={!matches || busy}
            onClick={onConfirm}
            style={{
              height: 46,
              borderRadius: 12,
              border: "none",
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              background: "var(--uff-red, #ff4d4d)",
              cursor: !matches || busy ? "not-allowed" : "pointer",
              opacity: !matches || busy ? 0.4 : 1,
            }}
          >
            {busy ? "Deleting…" : `Delete ${noun}`}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="wbtn"
            style={{ height: 46, borderRadius: 12 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
