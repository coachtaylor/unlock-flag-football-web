"use client";

import { useId, type ReactNode } from "react";

type Props = {
  label: string;
  type: "email" | "password" | "text";
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  rightLabel?: ReactNode;
};

export default function AuthField({
  label,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  rightLabel,
}: Props) {
  const id = useId();
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <label
          htmlFor={id}
          className="mono"
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "var(--text-label)",
            fontWeight: 500,
          }}
        >
          {label}
        </label>
        {rightLabel}
      </div>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        style={{
          width: "100%",
          minHeight: 48,
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid var(--border-card)",
          background: "var(--surface-input)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-sans)",
          fontSize: 15,
          outline: "none",
          transition: "border-color 150ms ease",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border-card)";
        }}
      />
    </div>
  );
}
