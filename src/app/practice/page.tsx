import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticeListClient from "./PracticeListClient";

export default async function PracticePage() {
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

  const { data: plans } = await supabase
    .from("practice_plans")
    .select(
      "id, practice_date, title, status, notes, practice_plan_drills(id, duration_minutes)"
    )
    .eq("team_id", teamId)
    .order("practice_date", { ascending: false });

  const planRows = (plans ?? []).map((p) => {
    const drills = (p.practice_plan_drills as
      | { id: string; duration_minutes: number | null }[]
      | null) ?? [];
    const totalDuration = drills.reduce(
      (sum, d) => sum + (d.duration_minutes ?? 0),
      0
    );
    return {
      id: p.id as string,
      practiceDate: p.practice_date as string,
      title: (p.title as string | null) ?? null,
      status: p.status as "draft" | "finalized" | "completed",
      drillCount: drills.length,
      totalDuration,
    };
  });

  return (
    <div className="pt-3xl">
      <div className="flex items-center justify-between">
        <h1
          className="text-title font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          Practice Plans
        </h1>
        <Link
          href="/practice/new"
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
          New Plan
        </Link>
      </div>

      <PracticeListClient plans={planRows} />
    </div>
  );
}
