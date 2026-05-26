"use client";

import { PIcon } from "./atoms";

export function DurStepper({
  value,
  onChange,
  accent = "var(--uff-orange)",
  min = 1,
  max = 240,
  step = 1,
  suffix = "m",
  width = 110,
}: {
  value: number;
  onChange: (v: number) => void;
  accent?: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  width?: number;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "var(--uff-surface-2)",
        borderRadius: 8,
        padding: 2,
        border: "1px solid var(--uff-line-soft)",
        width,
      }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        style={stepBtn(accent)}
      >
        <PIcon.minus size={12} />
      </button>
      <div
        className="mono"
        style={{
          flex: 1,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 700,
          color: accent,
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
        <span style={{ fontSize: 10, marginLeft: 1, opacity: 0.7 }}>{suffix}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        style={stepBtn(accent)}
      >
        <PIcon.plus size={12} />
      </button>
    </div>
  );
}

function stepBtn(color: string): React.CSSProperties {
  return {
    width: 26,
    height: 26,
    border: 0,
    padding: 0,
    borderRadius: 6,
    background: "transparent",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color,
  };
}
