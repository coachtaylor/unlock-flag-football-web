// This week's focus — the Action Layer's prescription hero (Build 8.5).
// Each weak skill tells its own story via FocusSkillRow (rank, who's dragging
// it, which drills prove it, trend). Data from v_team_skill_focus +
// v_team_skill_player/_drill + v_team_focus_recommendations (migrations 98/99).

import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import SectionHead from "./SectionHead";
import FocusSkillRow from "./FocusSkillRow";
import type { TeamFocus } from "@/lib/dashboard/team-home-data";

function UnlockState() {
  return (
    <div
      style={{
        border: "1px dashed var(--uff-line)",
        borderRadius: 10,
        padding: 18,
        color: "var(--uff-text-dim)",
        fontSize: 12.5,
        lineHeight: 1.6,
      }}
    >
      Rate or time players on a few skill drills to unlock your weekly focus.
      Skill gaps are scored from 1–5 ratings, made/attempts, and timed drills
      (timed scored against your team&apos;s range).
      <Link
        href="/benchmarks"
        className="wbtn primary"
        style={{ width: "100%", marginTop: 14, justifyContent: "center" }}
      >
        Start a skill benchmark
      </Link>
    </div>
  );
}

export default function WeeklyFocusCard({
  focus,
  teamId,
}: {
  focus: TeamFocus;
  teamId: string;
}) {
  return (
    <div className="w-card">
      <SectionHead
        label="This week's focus"
        meta={
          focus.hasSignal
            ? `${focus.skills.length} TEAM GAP${focus.skills.length === 1 ? "" : "S"}`
            : "LOCKED"
        }
      />
      {!focus.hasSignal ? (
        <UnlockState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--uff-text-dim)",
              margin: "0 0 2px",
            }}
          >
            {`Your team's ${
              focus.skills.length === 1 ? "biggest gap" : `${focus.skills.length} biggest gaps`
            } — and the drills to close ${
              focus.skills.length === 1 ? "it" : "them"
            } at Sunday's practice.`}
          </p>
          <div className="focus-grid">
            {focus.skills.map((s, i) => (
              <div className="focus-col" key={s.skillId}>
                <FocusSkillRow
                  skill={s}
                  teamId={teamId}
                  rosterSize={focus.rosterSize}
                  totalMeasured={focus.totalMeasured}
                  emphasis={i === 0}
                />
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 12,
              marginTop: 4,
              paddingTop: 12,
              borderTop: "1px solid var(--uff-line-soft)",
            }}
          >
            <span style={{ fontSize: 11.5, color: "var(--uff-text-mute)" }}>
              Turn these gaps into a session
            </span>
            <Link
              href={`/dashboard/team/${teamId}/practice/generate`}
              className="wbtn ghost"
            >
              <Icon.bolt size={13} /> Generate with AI
            </Link>
            <Link
              href={`/dashboard/team/${teamId}/practice/new`}
              className="wbtn primary"
            >
              <Icon.plus size={13} /> Build a practice
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
