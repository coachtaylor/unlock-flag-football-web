// Player Skill Profile (Build 13) — the per-player payoff of the whole
// assessment engine: "is Marcus actually good at coverage?" Consumes
// v_player_skill_profile WHERE player_id = X and surfaces the player's
// top skills + the ones that need work, each on the anchored 1–5 scale
// with a sample-size badge so a 1-rating average isn't mistaken for a
// trustworthy score.
//
// Position bias is handled by the view itself: v_player_skill_profile
// only returns rows for skills the player has at least one signal on
// (inner-join drill_skills + `where score is not null`), so a DB never
// shows up scored 0 on QB-only skills — those skills simply aren't rows.

import { skillGroupMeta } from "@/lib/drills/skill-groups";
import type { SkillGroup } from "@/lib/types/skills";
import SectionHead from "./SectionHead";

export type PlayerSkill = {
  skillId: string;
  skillName: string;
  skillGroup: SkillGroup;
  // composite_score from the view, on a 0..1 scale (rating/5 or made/attempts).
  composite: number;
  // count of distinct drills that fed this skill's composite.
  sampleSize: number;
};

// Below this many measured skills the split into strengths/weaknesses is
// noise, so the card shows a locked-insight state instead.
const MIN_SKILLS = 3;

export default function PlayerSkillProfileCard({
  skills,
  playerName,
}: {
  skills: PlayerSkill[];
  playerName: string;
}) {
  if (skills.length < MIN_SKILLS) {
    const need = MIN_SKILLS - skills.length;
    const first = playerName.trim().split(/\s+/)[0] || "this player";
    return (
      <div className="w-card" style={{ padding: 14 }}>
        <SectionHead label="Skill profile" meta="LOCKED" />
        <div
          style={{
            border: "1px dashed var(--uff-line)",
            borderRadius: 10,
            padding: 16,
            textAlign: "center",
            color: "var(--uff-text-dim)",
            fontSize: 12.5,
            lineHeight: 1.55,
          }}
        >
          {skills.length === 0 ? (
            <>
              No skill signals yet. Run rated benchmarks on{" "}
              <strong style={{ color: "var(--uff-text)" }}>
                {MIN_SKILLS}+ skills
              </strong>{" "}
              to unlock {first}&apos;s strengths and weaknesses. Each rated
              drill feeds the skills it&apos;s tagged with.
            </>
          ) : (
            <>
              {first} has{" "}
              <strong style={{ color: "var(--uff-text)" }}>
                {skills.length} skill{skills.length === 1 ? "" : "s"}
              </strong>{" "}
              measured. Benchmark{" "}
              <strong style={{ color: "var(--uff-text)" }}>
                {need} more
              </strong>{" "}
              to unlock the strengths / weaknesses breakdown.
            </>
          )}
        </div>
      </div>
    );
  }

  // Sort strongest → weakest. Strengths = top 3; weaknesses = the lowest
  // 3 among everything below rank 3 (weakest first), so a skill never
  // appears in both lists even for players with only 4–5 measured skills.
  const sorted = [...skills].sort((a, b) => b.composite - a.composite);
  const strengths = sorted.slice(0, 3);
  const weaknesses = sorted.slice(3).slice(-3).reverse();

  return (
    <div className="w-card" style={{ padding: 14 }}>
      <SectionHead label="Skill profile" meta="RATED · /5" />

      <SkillGroupBlock label="Top skills" accent="var(--uff-lime)" rows={strengths} />

      {weaknesses.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <SkillGroupBlock
            label="Needs work"
            accent="var(--uff-red)"
            rows={weaknesses}
          />
        </div>
      )}

      {/* Anchored 1–5 reference scale (matches the benchmark rating anchors
          in CLAUDE.md) so a coach reads each bar against a fixed meaning. */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: "1px solid var(--uff-line-soft)",
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
          fontSize: 9.5,
          color: "var(--uff-text-mute)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span>1 Can&apos;t execute</span>
        <span>3 Inconsistent</span>
        <span>5 Reliable</span>
      </div>
    </div>
  );
}

function SkillGroupBlock({
  label,
  accent,
  rows,
}: {
  label: string;
  accent: string;
  rows: PlayerSkill[];
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginBottom: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: accent,
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--uff-text-mute)",
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <SkillRow key={r.skillId} skill={r} />
        ))}
      </div>
    </div>
  );
}

function SkillRow({ skill }: { skill: PlayerSkill }) {
  const meta = skillGroupMeta(skill.skillGroup);
  const score = skill.composite * 5; // 0..1 → 1..5 scale
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          title={meta.label}
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: meta.color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12.5,
            color: "var(--uff-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {skill.skillName}
        </span>
        <SampleBadge n={skill.sampleSize} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            color: "var(--uff-text)",
            minWidth: 32,
            textAlign: "right",
          }}
        >
          {score.toFixed(1)}
          <span style={{ fontSize: 9.5, color: "var(--uff-text-mute)" }}>/5</span>
        </span>
      </div>
      {/* Composite bar tinted to the skill's group color. */}
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: meta.color,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
}

// Sample-size badge — non-negotiable per Build 13 spec so coaches don't
// trust a composite built from a single rating.
function SampleBadge({ n }: { n: number }) {
  const thin = n < 2;
  return (
    <span
      title={`${n} drill${n === 1 ? "" : "s"} measured`}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.04em",
        padding: "1px 5px",
        borderRadius: 4,
        color: thin ? "var(--uff-red)" : "var(--uff-text-mute)",
        background: thin ? "rgba(255,77,77,0.12)" : "rgba(255,255,255,0.05)",
      }}
    >
      n{n}
    </span>
  );
}
