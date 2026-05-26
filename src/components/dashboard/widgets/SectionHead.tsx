// Orange tick + title + optional right-side meta. Matches the design's
// .sect-head pattern (tk = small lime tick). Used by every widget card.

import React from "react";

export default function SectionHead({
  label,
  meta,
  right,
}: {
  label: string;
  meta?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--uff-text)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 3,
            height: 14,
            background: "var(--uff-orange)",
            borderRadius: 2,
            display: "inline-block",
          }}
        />
        {label}
      </span>
      {right ?? (meta ? (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.08em",
            color: "var(--uff-text-mute)",
            textTransform: "uppercase",
          }}
        >
          {meta}
        </span>
      ) : null)}
    </div>
  );
}
