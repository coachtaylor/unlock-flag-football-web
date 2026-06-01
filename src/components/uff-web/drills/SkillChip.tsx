// Named skill chip — a dot + the skill's name, colored by its skill group
// and weighted primary (filled) vs secondary (muted). Shared by the preset
// library cards and the team drill library cards so a tagged skill reads
// identically wherever it appears.
//
// Color comes from the canonical skillGroupMeta() (the same source the radar
// + SkillPicker use) — never a local palette copy.

import type { TaggedSkill } from "@/lib/types/skills";
import { skillGroupMeta } from "@/lib/drills/skill-groups";

export function SkillChip({ skill }: { skill: TaggedSkill }) {
  const isPrimary = skill.weight === 1.0;
  const color = skillGroupMeta(skill.skill_group)?.color ?? "var(--uff-text-mute)";
  return (
    <span
      title={`${skill.skill_name}${isPrimary ? " · primary" : " · secondary"}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: 10.5,
        fontWeight: isPrimary ? 600 : 500,
        fontFamily: "inherit",
        letterSpacing: ".01em",
        background: isPrimary
          ? `color-mix(in srgb, ${color} 16%, transparent)`
          : "rgba(255,255,255,0.03)",
        color: isPrimary ? "var(--uff-text)" : "var(--uff-text-mute)",
        border: isPrimary
          ? `1px solid color-mix(in srgb, ${color} 40%, transparent)`
          : "1px solid var(--uff-line-soft)",
        lineHeight: 1.4,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          opacity: isPrimary ? 1 : 0.6,
        }}
      />
      {skill.skill_name}
    </span>
  );
}
