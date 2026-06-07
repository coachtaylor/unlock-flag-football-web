// Player Skill Profile (Build 13 · confidence-gated Build 8.7 Slice 1) — the
// per-player payoff of the assessment engine: "is Marcus actually good at
// coverage?" Consumes v_player_skill_profile WHERE player_id = X.
//
// Two coaching-lens disciplines layered on in Slice 1:
//   • CONFIDENCE GATING — strengths/weaknesses are called ONLY from skills with
//     a reliable read (≥ RELIABLE_MIN distinct drills). Skills measured by 1–2
//     drills are shown as honest "early reads", never crowned or condemned, so
//     the card stops rendering noise as a verdict.
//   • PERFORMANCE COLOR — the composite bar is heat-colored by SCORE (red→green
//     via the shared heat scale), not by skill-GROUP identity. The group color
//     survives as a small dot. A weakness now reads red, not green.
//
// Position bias is handled by the view itself: v_player_skill_profile only
// returns rows for skills the player has signal on, so a DB never shows up
// scored 0 on QB-only skills — those skills simply aren't rows.

import { skillGroupMeta } from "@/lib/drills/skill-groups";
import type { SkillGroup } from "@/lib/types/skills";
import SectionHead from "./SectionHead";
import {
  confidenceTier,
  RELIABLE_MIN,
  type ConfidenceTier,
} from "@/lib/benchmarks/confidence";
import { scoreToHeatColor } from "@/lib/dashboard/heat-scale";

export type PlayerSkill = {
  skillId: string;
  skillName: string;
  skillGroup: SkillGroup;
  // composite_score from the view, on a 0..1 scale (rating/5 or made/attempts).
  composite: number;
  // count of distinct drills that fed this skill's composite.
  sampleSize: number;
};

// Below this many RELIABLE skills the split into strengths/weaknesses is noise
// (you can't rank two things), so the card shows a flat "Reliable reads" list.
const MIN_RELIABLE_FOR_SPLIT = 4;

export default function PlayerSkillProfileCard({
  skills,
  playerName,
}: {
  skills: PlayerSkill[];
  playerName: string;
}) {
  const first = playerName.trim().split(/\s+/)[0] || "this player";
  const reliable = skills
    .filter((s) => confidenceTier(s.sampleSize) === "reliable")
    .sort((a, b) => b.composite - a.composite);
  const early = skills
    .filter((s) => confidenceTier(s.sampleSize) === "early")
    .sort((a, b) => b.composite - a.composite);

  // No reliable read yet → an honest locked state, NOT three invented
  // strengths. Surface any early reads muted so the coach sees the hint
  // without mistaking it for a verdict.
  if (reliable.length === 0) {
    return (
      <div className="w-card" style={{ padding: 14 }}>
        <SectionHead label="Skill profile" meta="EARLY" />
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
              No skill signals yet. Run rated benchmarks and {first}&apos;s
              skills appear here from the very first drill — they lock in as{" "}
              <strong style={{ color: "var(--uff-text)" }}>reliable reads</strong>{" "}
              at {RELIABLE_MIN}+ drills each.
            </>
          ) : (
            <>
              Here&apos;s what you&apos;ve measured on {first} so far. Each skill
              locks in as a{" "}
              <strong style={{ color: "var(--uff-text)" }}>reliable read</strong>{" "}
              at {RELIABLE_MIN}+ drills — keep benchmarking to turn these into
              confirmed strengths and weaknesses.
            </>
          )}
        </div>
        {early.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <SkillGroupBlock label="Early reads · building confidence" rows={early} tier="early" />
          </div>
        )}
      </div>
    );
  }

  const split = reliable.length >= MIN_RELIABLE_FOR_SPLIT;
  // Strengths = top 3; weaknesses = lowest 3 among everything below rank 3
  // (weakest first), so a skill never appears in both lists.
  const strengths = split ? reliable.slice(0, 3) : reliable;
  const weaknesses = split ? reliable.slice(3).slice(-3).reverse() : [];

  return (
    <div className="w-card" style={{ padding: 14 }}>
      <SectionHead label="Skill profile" meta="RATED · /5" />

      {split ? (
        <>
          <SkillGroupBlock label="Top skills" rows={strengths} tier="reliable" />
          {weaknesses.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <SkillGroupBlock label="Needs work" rows={weaknesses} tier="reliable" />
            </div>
          )}
        </>
      ) : (
        <SkillGroupBlock label="Reliable reads" rows={strengths} tier="reliable" />
      )}

      {early.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <SkillGroupBlock label="Early reads · building confidence" rows={early} tier="early" />
        </div>
      )}

      {/* Anchored 1–5 reference scale (matches the benchmark rating anchors
          in CLAUDE.md) so a coach reads each bar against a fixed meaning. The
          bars carry a 3.0 "inconsistent" midpoint tick to the same end. */}
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
  rows,
  tier,
}: {
  label: string;
  rows: PlayerSkill[];
  tier: ConfidenceTier;
}) {
  // Section marker dot: heat-neutral. "Needs work" reads red, "Top skills"
  // lime, early reads muted — purely a label cue; the per-row heat bar carries
  // the real valence.
  const accent =
    tier === "early"
      ? "var(--uff-text-mute)"
      : label === "Needs work"
        ? "var(--uff-red)"
        : label === "Top skills"
          ? "var(--uff-lime)"
          : "var(--uff-text-dim)";
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
          <SkillRow key={r.skillId} skill={r} tier={tier} />
        ))}
      </div>
    </div>
  );
}

function SkillRow({ skill, tier }: { skill: PlayerSkill; tier: ConfidenceTier }) {
  const meta = skillGroupMeta(skill.skillGroup);
  const score = skill.composite * 5; // 0..1 → 1..5 scale
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));
  const early = tier === "early";
  // Heat by SCORE always — a 0.4 should read as weak from rep 1 (that's useful
  // at practice 1). Early reads simply render dimmer (row opacity below) so the
  // number reads as *tentatively* weak/strong, not a confirmed verdict. The
  // confidence lives in the dimming + the "early read" grouping, not in hiding
  // the signal.
  const barColor = scoreToHeatColor(skill.composite);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 4, opacity: early ? 0.7 : 1 }}
    >
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
            color: early ? "var(--uff-text-mute)" : "var(--uff-text)",
            minWidth: 32,
            textAlign: "right",
          }}
        >
          {score.toFixed(1)}
          <span style={{ fontSize: 9.5, color: "var(--uff-text-mute)" }}>/5</span>
        </span>
      </div>
      {/* Composite bar — heat-colored by SCORE (group color survives as the dot
          above). A 3.0 "inconsistent" midpoint tick keeps a 3.0 from reading as
          a full-strength bar. */}
      <div
        style={{
          position: "relative",
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
            background: barColor,
            borderRadius: 2,
          }}
        />
        {/* 3.0/5 = 60% midpoint reference */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "60%",
            top: 0,
            bottom: 0,
            width: 1,
            background: "rgba(255,255,255,0.28)",
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
