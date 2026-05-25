// Server component that checks if the current user needs the backfill
// modal and renders it if so. Safe to mount inside any authenticated
// layout — short-circuits to null when there's no work to do.

import { createClient } from "@/lib/supabase/server";
import BackfillModal from "./BackfillModal";

export default async function BackfillMount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  const needs = !!profile?.onboarding_completed_at && !profile?.first_name;
  if (!needs) return null;

  return <BackfillModal />;
}
