import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NameForm from "./NameForm";

export default async function OnboardingNamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) redirect("/dashboard");

  return (
    <NameForm
      initialFirst={profile?.first_name ?? ""}
      initialLast={profile?.last_name ?? ""}
    />
  );
}
