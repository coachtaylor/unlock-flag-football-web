import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticePlanForm from "../PracticePlanForm";

export default async function NewPracticePlanPage() {
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

  const [{ data: drills }, { data: categories }] = await Promise.all([
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
    />
  );
}
