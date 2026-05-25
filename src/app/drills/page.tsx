import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DrillLibraryClient from "./DrillLibraryClient";

export const dynamic = "force-dynamic";

export default async function DrillsPage() {
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

  const [{ data: categories }, { data: drills }] = await Promise.all([
    supabase
      .from("drill_categories")
      .select("id, category_name, display_order")
      .or(`team_id.is.null,team_id.eq.${teamId}`)
      .order("display_order", { ascending: true })
      .order("category_name", { ascending: true }),
    supabase
      .from("team_drills")
      .select(
        "id, drill_name, status, benchmark_type, category_id, additional_category_ids"
      )
      .eq("team_id", teamId)
      .in("status", ["draft", "published"])
      .order("created_at", { ascending: false }),
  ]);

  const categoryNameById = new Map<string, string>(
    (categories ?? []).map((c) => [
      c.id as string,
      c.category_name as string,
    ])
  );

  const drillRows = (drills ?? []).map((d) => {
    const primaryId = (d.category_id as string | null) ?? null;
    const additional = (d.additional_category_ids as string[] | null) ?? [];
    const allIds = Array.from(
      new Set<string>(
        [primaryId, ...additional].filter((x): x is string => !!x)
      )
    );
    const categoryNames = allIds
      .map((id) => categoryNameById.get(id))
      .filter((n): n is string => !!n);
    return {
      id: d.id as string,
      name: d.drill_name as string,
      status: d.status as "draft" | "published",
      benchmarkType: (d.benchmark_type as "timed" | "rated" | null) ?? null,
      categoryIds: allIds,
      categoryNames,
    };
  });

  const categoryRows = (categories ?? []).map((c) => ({
    id: c.id as string,
    name: c.category_name as string,
  }));

  return (
    <div className="pt-3xl">
      <div className="flex items-center justify-between">
        <h1
          className="text-title font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          Drill Library
        </h1>
        <Link
          href="/drills/new"
          className="rounded-pill text-caption font-medium no-underline"
          style={{
            padding: "8px 14px",
            minHeight: "44px",
            display: "inline-flex",
            alignItems: "center",
            backgroundColor: "var(--color-orange-500)",
            color: "#FFFFFF",
            letterSpacing: "0.3px",
          }}
        >
          Add Drill
        </Link>
      </div>

      <DrillLibraryClient categories={categoryRows} drills={drillRows} />
    </div>
  );
}
