// Shared form primitives for UFF workspace forms (Build 16.5c).
//
// Consolidates the title/subtitle card + labeled field + input style that
// were copy-pasted into PlayerForm, SettingsClient, and now CoachForm.
// (DrillForm's numbered-step section is a different component and keeps its
// own.) padding/gap are props so existing screens migrate without any visual
// change — defaults match PlayerForm; SettingsClient passes 20/14.

import type { CSSProperties, ReactNode } from "react";

export function FormSection({
  title,
  subtitle,
  children,
  padding = 16,
  gap = 12,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  padding?: number;
  gap?: number;
}) {
  return (
    <section
      className="w-card"
      style={{ padding, display: "flex", flexDirection: "column", gap }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--uff-text-mute)",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "var(--uff-text-dim)", marginTop: 4 }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

export function FormField({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{ fontSize: 11.5, fontWeight: 600, color: "var(--uff-text-dim)" }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--uff-orange)", marginLeft: 4 }}>*</span>
        )}
      </label>
      {children}
    </div>
  );
}

export const formInputStyle: CSSProperties = {
  width: "100%",
  height: 40,
  background: "var(--uff-surface-2)",
  border: "1px solid var(--uff-line-soft)",
  borderRadius: 8,
  color: "var(--uff-text)",
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  padding: "0 12px",
  outline: "none",
};
