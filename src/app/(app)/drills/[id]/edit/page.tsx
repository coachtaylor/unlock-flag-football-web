import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DrillForm, { type DrillFormInitial } from "../../DrillForm";
import type { DiagramData } from "@/types/diagram";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditDrillPage({ params }: Props) {
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

  const [{ data: drill }, { data: categories }] = await Promise.all([
    supabase
      .from("team_drills")
      .select(
        "id, drill_name, category_id, additional_category_ids, description, source_url, benchmark_type, status, setup_diagram, setup_instructions, equipment, team_id"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("drill_categories")
      .select("id, category_name")
      .or(`team_id.is.null,team_id.eq.${membership.team_id}`)
      .order("display_order", { ascending: true })
      .order("category_name", { ascending: true }),
  ]);

  if (!drill || drill.team_id !== membership.team_id) notFound();

  const rawDiagram = drill.setup_diagram as DiagramData | null;
  const setupDiagram =
    rawDiagram && Array.isArray(rawDiagram.cones) && rawDiagram.cones.length > 0
      ? rawDiagram
      : null;

  const initial: DrillFormInitial = {
    id: drill.id as string,
    drillName: (drill.drill_name as string) ?? "",
    categoryId: (drill.category_id as string | null) ?? null,
    additionalCategoryIds:
      (drill.additional_category_ids as string[] | null) ?? [],
    description: (drill.description as string | null) ?? "",
    sourceUrl: (drill.source_url as string | null) ?? "",
    benchmarkType: (drill.benchmark_type as "timed" | "rated" | null) ?? null,
    status: (drill.status as "draft" | "published") ?? "draft",
    setupDiagram,
    setupInstructions: (drill.setup_instructions as string | null) ?? null,
    otherEquipment: (() => {
      const eq = drill.equipment as { other?: unknown } | null;
      const other = eq?.other;
      return Array.isArray(other)
        ? other.filter((x): x is string => typeof x === "string")
        : [];
    })(),
  };

  return (
    <DrillForm
      teamId={membership.team_id}
      categories={(categories ?? []).map((c) => ({
        id: c.id as string,
        name: c.category_name as string,
      }))}
      initial={initial}
    />
  );
}
