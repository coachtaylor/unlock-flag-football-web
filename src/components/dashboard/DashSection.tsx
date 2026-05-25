// Section header used inside workspace dashboard pages.
// Tick stripe (color), label, optional meta tag, optional CTA on the right.

import { type ReactNode } from "react";

type Props = {
  tick?: string;
  label: string;
  meta?: string;
  cta?: ReactNode;
  children: ReactNode;
};

export default function DashSection({
  tick = "var(--uff-orange)",
  label,
  meta,
  cta,
  children,
}: Props) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 3, height: 14, background: tick, borderRadius: 2 }} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              color: "var(--uff-text)",
            }}
          >
            {label}
          </span>
          {meta && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--uff-text-mute)",
                letterSpacing: ".06em",
              }}
            >
              · {meta}
            </span>
          )}
        </div>
        {cta}
      </div>
      {children}
    </section>
  );
}
