import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewTeamForm from "./NewTeamForm";

export default async function OnboardingNewTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; role?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.first_name) redirect("/onboarding/name");
  if (profile?.onboarding_completed_at) redirect("/dashboard");

  const { scope, role: roleParam } = await searchParams;
  // Defensive: must come from the single-team branch with a role chosen.
  if (scope !== "single") redirect("/onboarding/scope");
  const role: "coach" | "captain" =
    roleParam === "captain" ? "captain" : roleParam === "coach" ? "coach" : (() => {
      redirect("/onboarding/role?scope=single");
    })() as never;

  return <NewTeamForm role={role} />;
}
