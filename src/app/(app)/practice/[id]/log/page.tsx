import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticeLogClient from "./PracticeLogClient";

type Props = { params: Promise<{ id: string }> };

function formatLongDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PracticeLogPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/team-setup");
  const teamId = membership.team_id as string;

  const { data: plan } = await supabase
    .from("practice_plans")
    .select(
      "id, team_id, practice_date, status, practice_plan_drills(id, drill_id, drill_order, duration_minutes, team_drills(id, drill_name))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!plan || plan.team_id !== teamId) notFound();

  const status = plan.status as "draft" | "finalized" | "completed";
  if (status === "draft" || status === "completed") {
    redirect(`/practice/${id}`);
  }

  const planDrills = ((plan.practice_plan_drills as
    | {
        id: string;
        drill_id: string;
        drill_order: number;
        duration_minutes: number | null;
        team_drills:
          | { id: string; drill_name: string }
          | { id: string; drill_name: string }[]
          | null;
      }[]
    | null) ?? [])
    .slice()
    .sort((a, b) => a.drill_order - b.drill_order)
    .map((pd) => {
      const drillRecord = Array.isArray(pd.team_drills)
        ? pd.team_drills[0]
        : pd.team_drills;
      return {
        id: pd.id,
        drillId: pd.drill_id,
        drillName: drillRecord?.drill_name ?? "Unknown drill",
        durationMinutes: pd.duration_minutes,
      };
    });

  return (
    <PracticeLogClient
      teamId={teamId}
      userId={user.id}
      planId={plan.id as string}
      practiceDate={formatLongDate(plan.practice_date as string)}
      drills={planDrills}
    />
  );
}
