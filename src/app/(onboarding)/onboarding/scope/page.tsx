import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ScopeForm from "./ScopeForm";

export default async function OnboardingScopePage() {
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

  // Need a name before scope.
  if (!profile?.first_name) redirect("/onboarding/name");
  if (profile?.onboarding_completed_at) redirect("/dashboard");

  return <ScopeForm />;
}
