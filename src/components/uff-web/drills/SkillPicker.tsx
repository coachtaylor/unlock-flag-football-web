"use client";

// Skill picker — used in DrillForm to tag a drill with assessment skills.
//
// Each chip cycles through 3 states on click:
//   unselected → secondary (weight 0.5) → primary (weight 1.0) → unselected
//
// Convention from the seed: every drill should have at least one primary
// (weight 1.0) and 0–3 secondaries (0.5). The picker doesn't enforce
// "exactly one primary" — coaches can pick multiple primaries when a drill
// genuinely trains two skills equally (e.g. the 7v7 Read & React drills
// in the preset library tag both pre_snap_recognition and post_snap_read
// at weight 1.0).
//
// Visual language matches the chips on PresetCard so cloned-from-preset
// drills and custom-built drills feel like the same product.

import type { Skill, SkillGroup, DrillSkillWeight } from "@/lib/types/skills";
import { SKILL_GROUP_META } from "@/lib/drills/skill-groups";

export type SkillPickerValue = Map<string, DrillSkillWeight>; // skillId → weight

type Props = {
  skills: Skill[];
  value: SkillPickerValue;
  onChange: (next: SkillPickerValue) => void;
  // When provided, only these skill groups render. Used by DrillForm to scope
  // the picker to the drill's chosen phase.
  groups?: SkillGroup[];
};

export default function SkillPicker({ skills, value, onChange, groups }: Props) {
  const groupFilter = groups ? new Set(groups) : null;
  const grouped = SKILL_GROUP_META.filter(
    (g) => !groupFilter || groupFilter.has(g.id),
  )
    .map((g) => ({
      ...g,
      // The picker uses the verbose label in its group headers.
      label: g.longLabel,
      items: skills
        .filter((s) => s.skill_group === g.id)
        .sort((a, b) => a.display_order - b.display_order),
    }))
    .filter((g) => g.items.length > 0);

  // 3-state cycle: undefined → 0.5 → 1.0 → undefined
  function cycle(skillId: string) {
    const next = new Map(value);
    const current = next.get(skillId);
    if (current === undefined) {
      next.set(skillId, 0.5);
    } else if (current === 0.5) {
      next.set(skillId, 1.0);
    } else {
      next.delete(skillId);
    }
    onChange(next);
  }

  const primaryCount = Array.from(value.values()).filter((w) => w === 1.0).length;
  const secondaryCount = Array.from(value.values()).filter((w) => w === 0.5).length;
  const noneSelected = value.size === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PickerLegend
        primaryCount={primaryCount}
        secondaryCount={secondaryCount}
        noneSelected={noneSelected}
      />

      {grouped.map((g) => (
        <GroupRow key={g.id} group={g} value={value} onToggle={cycle} />
      ))}
    </div>
  );
}

// ── Legend / status row ───────────────────────────────────────────────

function PickerLegend({
  primaryCount,
  secondaryCount,
  noneSelected,
}: {
  primaryCount: number;
  secondaryCount: number;
  noneSelected: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "8px 10px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <LegendChip swatch="var(--uff-orange)" filled label="Primary (1.0)" />
        <LegendChip swatch="var(--uff-orange)" filled={false} label="Secondary (0.5)" />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--uff-text-mute)",
          }}
        >
          Tap once → secondary · tap again → primary · tap again → off
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: noneSelected ? "var(--uff-text-mute)" : "var(--uff-text)",
        }}
      >
        {noneSelected
          ? "No skills tagged"
          : `${primaryCount} primary · ${secondaryCount} secondary`}
      </div>
    </div>
  );
}

function LegendChip({
  swatch,
  filled,
  label,
}: {
  swatch: string;
  filled: boolean;
  label: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        color: "var(--uff-text-dim)",
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 4,
          background: filled
            ? `color-mix(in srgb, ${swatch} 60%, transparent)`
            : "transparent",
          border: `1.5px solid ${swatch}`,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

// ── Group row (one per skill_group) ───────────────────────────────────

type GroupItem = {
  id: SkillGroup;
  label: string;
  color: string;
  blurb: string;
  items: Skill[];
};

function GroupRow({
  group,
  value,
  onToggle,
}: {
  group: GroupItem;
  value: SkillPickerValue;
  onToggle: (skillId: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          paddingLeft: 2,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: group.color,
            flexShrink: 0,
            transform: "translateY(1px)",
          }}
        />
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--uff-text)",
            letterSpacing: "-0.005em",
          }}
        >
          {group.label}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: "var(--uff-text-mute)",
            fontWeight: 500,
          }}
        >
          {group.blurb}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {group.items.map((skill) => (
          <SkillChip
            key={skill.id}
            skill={skill}
            color={group.color}
            weight={value.get(skill.id)}
            onClick={() => onToggle(skill.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Individual chip (3-state) ─────────────────────────────────────────

function SkillChip({
  skill,
  color,
  weight,
  onClick,
}: {
  skill: Skill;
  color: string;
  weight: DrillSkillWeight | undefined;
  onClick: () => void;
}) {
  const state: "off" | "secondary" | "primary" =
    weight === 1.0 ? "primary" : weight === 0.5 ? "secondary" : "off";

  const styles =
    state === "primary"
      ? {
          background: `color-mix(in srgb, ${color} 22%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 60%, transparent)`,
          color: "var(--uff-text)",
          weight: 600,
        }
      : state === "secondary"
        ? {
            background: "transparent",
            border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
            color: "var(--uff-text-dim)",
            weight: 500,
          }
        : {
            background: "rgba(255,255,255,0.02)",
            border: `1px solid var(--uff-line-soft)`,
            color: "var(--uff-text-mute)",
            weight: 500,
          };

  // Title attribute gives coaches the full skill description + a hint
  // about the cycle behavior, without cluttering the chip itself.
  const title = `${skill.skill_name} — ${skill.description}\nWeight: ${
    state === "primary" ? "1.0 (primary)" : state === "secondary" ? "0.5 (secondary)" : "not selected"
  }`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 5,
        fontSize: 11.5,
        fontWeight: styles.weight,
        fontFamily: "inherit",
        background: styles.background,
        border: styles.border,
        color: styles.color,
        cursor: "pointer",
        transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
        lineHeight: 1.35,
      }}
    >
      {state === "primary" && (
        <span style={{ color, fontSize: 10, lineHeight: 1 }}>★</span>
      )}
      {skill.skill_name}
    </button>
  );
}
