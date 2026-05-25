"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitScope(scope: "single" | "league") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" } as const;

  // Bump onboarding_step so we know the user got past Scope. The branch
  // choice itself is carried in the URL — see §7 of the workflow doc.
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_step: 2 })
    .eq("id", user.id);

  if (error) return { error: error.message } as const;

  if (scope === "single") redirect("/onboarding/role?scope=single");
  redirect("/onboarding/create-league?scope=league");
}
