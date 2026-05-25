"use server";

import { createClient } from "@/lib/supabase/server";

export type BackfillResult = { error: string } | { ok: true };

export async function submitBackfill(
  firstName: string,
  lastName: string
): Promise<BackfillResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const first = firstName.trim();
  const last = lastName.trim();
  if (!first || !last) return { error: "Both first and last name are required." };
  if (first.length > 50 || last.length > 50) {
    return { error: "Names must be 50 characters or fewer." };
  }

  const displayName = `${first} ${last}`;
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: first,
      last_name: last,
      display_name: displayName,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return { ok: true };
}
