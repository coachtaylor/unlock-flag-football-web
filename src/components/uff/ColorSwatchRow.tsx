"use client";

import { TEAM_COLORS, type TeamColorId } from "./team-colors";
import { Icon } from "./icons";

type Props = {
  value: TeamColorId;
  onChange: (next: TeamColorId) => void;
};

export default function ColorSwatchRow({ value, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {TEAM_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-label={c.label}
          className={`fr-swatch ${value === c.id ? "on" : ""}`}
          style={{ background: c.hex }}
          onClick={() => onChange(c.id)}
        >
          {value === c.id && (
            <span className="check">
              <Icon.check size={16} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
