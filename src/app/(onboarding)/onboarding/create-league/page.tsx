import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateLeagueForm from "./CreateLeagueForm";

export default async function OnboardingCreateLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
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

  const { scope } = await searchParams;
  if (scope !== "league") redirect("/onboarding/scope");

  return <CreateLeagueForm />;
}
