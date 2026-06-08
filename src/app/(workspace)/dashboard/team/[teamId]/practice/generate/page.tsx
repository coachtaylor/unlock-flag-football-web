import { createClient } from "@/lib/supabase/server";
import { loadTeamFocus } from "@/lib/dashboard/team-home-data";
import type { SkillGroup } from "@/lib/types/skills";
import GenerateClient from "@/components/practice/generate/GenerateClient";

export default async function GeneratePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const supabase = await createClient();
  const focus = await loadTeamFocus(supabase, teamId);

  return (
    <GenerateClient
      data={{
        teamId,
        defaultMinutes: 90, // refine from last plan start/end at build time
        defaultFormat: "7v7",
        availableSkills: focus.skills.map((s) => ({
          skillId: s.skillId,
          skillName: s.skillName,
          skillGroup: s.skillGroup as SkillGroup,
          avgScore: s.avgScore,
        })),
      }}
    />
  );
}
