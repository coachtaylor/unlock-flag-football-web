"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitRole(role: "coach" | "captain") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" } as const;

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_step: 3 })
    .eq("id", user.id);

  if (error) return { error: error.message } as const;

  redirect(`/onboarding/new-team?scope=single&role=${role}`);
}
