"use client";

// Collapsible card shell for the player page sections (Build 9). Owns the card +
// header (orange tick + title + optional meta/right node + chevron) and a
// collapsible body. Section widgets render `bare` inside it so there's no double
// header. Open/closed is per-section UI state, remembered in localStorage (same
// class of ephemeral view state as the history range chips — not feature data).

import { useState, useEffect, type ReactNode, type CSSProperties } from "react";

export default function CollapsibleSection({
  id,
  title,
  meta,
  right,
  defaultOpen = true,
  bodyPadding = 16,
  pairItem = false,
  children,
}: {
  id: string;
  title: string;
  meta?: string;
  right?: ReactNode;
  defaultOpen?: boolean;
  bodyPadding?: number;
  // Direct child of a flex pair: fill the row height when open (equal-height,
  // no void) but shrink to just the header when collapsed.
  pairItem?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Hydrate after mount to avoid SSR mismatch.
  useEffect(() => {
    try {
      const v = localStorage.getItem(`pd-collapse:${id}`);
      // Post-mount sync from an external store (localStorage). Done in an effect —
      // not lazy init — so SSR and first client render agree (no hydration flash).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v != null) setOpen(v === "1");
    } catch {
      /* localStorage unavailable — fall back to defaultOpen */
    }
  }, [id]);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(`pd-collapse:${id}`, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const rootStyle: CSSProperties = {
    padding: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
  };
  if (pairItem) {
    rootStyle.flex = "1 1 320px";
    rootStyle.minWidth = 0;
    // Stretch to the pair's row height when open (kills the void); shrink to the
    // header when collapsed.
    rootStyle.alignSelf = open ? "stretch" : "flex-start";
    rootStyle.height = open ? "100%" : "auto";
  }

  return (
    <div className="w-card" style={rootStyle}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "14px 16px",
          textAlign: "left",
          color: "inherit",
        }}
      >
        <span
          style={{
            width: 3,
            height: 14,
            borderRadius: 2,
            background: "var(--uff-orange)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--uff-text)",
          }}
        >
          {title}
        </span>
        {meta && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--uff-text-mute)",
            }}
          >
            {meta}
          </span>
        )}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {right}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              color: "var(--uff-text-dim)",
            }}
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open && (
        <div style={{ padding: bodyPadding, paddingTop: 0, flex: 1, minHeight: 0 }}>
          {children}
        </div>
      )}
    </div>
  );
}
