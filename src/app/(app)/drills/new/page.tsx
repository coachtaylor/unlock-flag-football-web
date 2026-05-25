import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DrillForm from "../DrillForm";

export const dynamic = "force-dynamic";

export default async function NewDrillPage() {
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

  const { data: categories } = await supabase
    .from("drill_categories")
    .select("id, category_name")
    .or(`team_id.is.null,team_id.eq.${membership.team_id}`)
    .order("display_order", { ascending: true })
    .order("category_name", { ascending: true });

  return (
    <DrillForm
      teamId={membership.team_id}
      categories={(categories ?? []).map((c) => ({
        id: c.id as string,
        name: c.category_name as string,
      }))}
    />
  );
}
