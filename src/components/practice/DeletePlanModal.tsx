"use client";

// Destructive confirmation for permanently deleting an archived practice.
// To prevent an accidental click from wiping a plan + its logged data, the
// coach must type the practice title back exactly (case-sensitive). The
// Delete button stays disabled until the typed value matches.
//
// Untitled practices have no name to match against, so they fall back to a
// plain confirm (still a deliberate two-step action, just no typing gate).

import { useEffect, useState } from "react";
import { isUntitledPlanTitle } from "@/lib/practice/plan-data";

export default function DeletePlanModal({
  open,
  title,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /**
   * The practice title the coach must re-type to confirm (case-sensitive).
   * Empty/whitespace => the practice is untitled and the typing gate is
   * skipped.
   */
  title: string | null | undefined;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  if (!open) return null;
  // A real, user-given name requires typing to confirm; placeholder/blank
  // titles fall back to a plain confirm.
  const hasTitle = !isUntitledPlanTitle(title);
  const matches = !hasTitle || value === title;

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
          {hasTitle
            ? "Deleting removes the practice and all of its data for good. To confirm, type the practice name below."
            : "Deleting removes this practice and all of its data for good."}
        </p>

        {hasTitle && (
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
              {title}
            </div>

            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Type the practice name"
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
            {busy ? "Deleting…" : "Delete practice"}
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
