import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticePlanForm from "../../PracticePlanForm";

type Props = { params: Promise<{ id: string }> };

// Postgres TIME values come back as "HH:MM:SS"; the <input type="time"> wants "HH:MM".
function trimTime(t: string | null): string {
  if (!t) return "";
  const match = t.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

export default async function EditPracticePlanPage({ params }: Props) {
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
  const teamId = membership.team_id;

  const [{ data: plan }, { data: drills }, { data: categories }] =
    await Promise.all([
      supabase
        .from("practice_plans")
        .select(
          "id, team_id, practice_date, start_time, end_time, title, status, notes, practice_plan_drills(drill_id, drill_order, duration_minutes)"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("team_drills")
        .select("id, drill_name, category_id, drill_categories(category_name)")
        .eq("team_id", teamId)
        .eq("status", "published")
        .order("drill_name", { ascending: true }),
      supabase
        .from("drill_categories")
        .select("id, category_name, display_order")
        .or(`team_id.is.null,team_id.eq.${teamId}`)
        .order("display_order", { ascending: true })
        .order("category_name", { ascending: true }),
    ]);

  if (!plan || plan.team_id !== teamId) notFound();

  const planDrills = ((plan.practice_plan_drills as
    | {
        drill_id: string;
        drill_order: number;
        duration_minutes: number | null;
      }[]
    | null) ?? [])
    .slice()
    .sort((a, b) => a.drill_order - b.drill_order)
    .map((d) => ({
      drillId: d.drill_id,
      durationMinutes: d.duration_minutes ?? 0,
    }));

  const drillRows = (drills ?? []).map((d) => {
    const cat = d.drill_categories as
      | { category_name: string }
      | { category_name: string }[]
      | null;
    const categoryName = Array.isArray(cat)
      ? cat[0]?.category_name
      : cat?.category_name;
    return {
      id: d.id as string,
      name: d.drill_name as string,
      categoryId: (d.category_id as string | null) ?? null,
      categoryName: categoryName ?? null,
    };
  });

  const categoryRows = (categories ?? []).map((c) => ({
    id: c.id as string,
    name: c.category_name as string,
  }));

  return (
    <PracticePlanForm
      teamId={teamId}
      drills={drillRows}
      categories={categoryRows}
      initial={{
        id: plan.id as string,
        practiceDate: plan.practice_date as string,
        startTime: trimTime(plan.start_time as string | null),
        endTime: trimTime(plan.end_time as string | null),
        title: (plan.title as string | null) ?? "",
        notes: (plan.notes as string | null) ?? "",
        status: plan.status as "draft" | "finalized" | "completed",
        drills: planDrills,
      }}
    />
  );
}
