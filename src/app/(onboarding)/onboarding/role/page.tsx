import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoleForm from "./RoleForm";

export default async function OnboardingRolePage({
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

  // Role only applies to the single-team branch. The league branch
  // skips Step 3 entirely.
  const { scope } = await searchParams;
  if (scope !== "single") redirect("/onboarding/scope");

  return <RoleForm />;
}
