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
      Rate players on a few skill drills to unlock your weekly focus. Skill gaps
      are scored from 1–5 ratings and made/attempts drills — timed drills build
      player speed but don&apos;t rank team skill gaps.
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
          {focus.skills.map((s, i) => (
            <FocusSkillRow
              key={s.skillId}
              skill={s}
              teamId={teamId}
              rosterSize={focus.rosterSize}
              totalMeasured={focus.totalMeasured}
              emphasis={i === 0}
            />
          ))}
          <Link
            href={`/dashboard/team/${teamId}/practice/new`}
            className="wbtn ghost"
            style={{ width: "100%", marginTop: 2, justifyContent: "center" }}
          >
            <Icon.plus size={13} /> Plan a practice
          </Link>
        </div>
      )}
    </div>
  );
}
