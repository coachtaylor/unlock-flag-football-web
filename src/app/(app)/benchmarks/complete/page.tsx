import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ drill?: string; count?: string }>;

export default async function BenchmarkCompletePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { drill: drillId, count: countParam } = await searchParams;

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

  let drillName = "the drill";
  if (drillId) {
    const { data: drill } = await supabase
      .from("team_drills")
      .select("drill_name, team_id")
      .eq("id", drillId)
      .maybeSingle();
    if (drill && drill.team_id === membership.team_id) {
      drillName = drill.drill_name as string;
    }
  }

  const count = countParam ? Number(countParam) : 0;
  const safeCount = Number.isFinite(count) && count > 0 ? count : 0;

  return (
    <div className="pt-3xl pb-2xl flex flex-col items-center">
      <div
        className="flex items-center justify-center"
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "9999px",
          backgroundColor: "rgba(74, 222, 128, 0.12)",
          color: "var(--color-green-400)",
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1
        className="text-title font-medium mt-xl text-center"
        style={{ color: "var(--color-text-primary)" }}
      >
        Assessment Complete
      </h1>

      <p
        className="text-body mt-md text-center"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Logged results for {safeCount}{" "}
        {safeCount === 1 ? "player" : "players"} on {drillName}.
      </p>

      <div className="w-full flex flex-col gap-sm mt-3xl">
        {drillId && (
          <Link
            href={`/drills/${drillId}`}
            className="w-full block py-lg rounded-xl text-body font-medium tracking-wide text-center no-underline"
            style={{
              backgroundColor: "var(--color-orange-500)",
              color: "#FFFFFF",
              letterSpacing: "0.3px",
            }}
          >
            View Results
          </Link>
        )}

        <Link
          href="/benchmarks"
          className="w-full block py-lg rounded-xl text-body font-medium tracking-wide text-center no-underline"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-subtle)",
            letterSpacing: "0.3px",
          }}
        >
          Run Another
        </Link>

        <Link
          href="/dashboard"
          className="w-full block py-md text-caption font-medium text-center no-underline"
          style={{
            color: "var(--color-text-secondary)",
            minHeight: "44px",
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
