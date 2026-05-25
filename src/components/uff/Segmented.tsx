"use client";

// Segmented control: dark-themed multi-button row.
// Used for format pickers (5v5 / 7v7 / etc.) and the smart league picker
// chip-pair variant.

import { type ReactNode } from "react";

export type SegmentedOption<V extends string> = {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
};

type Props<V extends string> = {
  value: V;
  onChange: (next: V) => void;
  options: SegmentedOption<V>[];
  cols?: number;
};

export default function Segmented<V extends string>({
  value,
  onChange,
  options,
  cols,
}: Props<V>) {
  return (
    <div
      className="fr-seg"
      style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, 1fr)` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
