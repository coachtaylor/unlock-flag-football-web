"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { INVITE_COOKIE } from "@/lib/team/invite-cookie";

// Accept a full /join/<token> link, a /join/<token> path, or a bare token.
function extractInviteToken(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const marker = "/join/";
  const at = v.indexOf(marker);
  let tok = at >= 0 ? v.slice(at + marker.length) : v;
  tok = tok.split(/[?#]/)[0].replace(/\/+$/, "").trim();
  return tok || null;
}

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

// Invited users join an existing team instead of creating one. Redeem the
// token, mark onboarding complete (so the proxy lets them into the
// workspace), clear the resume cookie, and drop them on the team.
export async function joinByInvite(linkOrToken: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" } as const;

  const token = extractInviteToken(linkOrToken);
  if (!token) return { error: "Paste your invite link to join." } as const;

  const { data, error } = await supabase.rpc("redeem_team_invite", {
    p_token: token,
  });
  if (error) {
    if (error.code === "P0002" || /not found/i.test(error.message)) {
      return { error: "That invite link isn't valid. Check it and try again." } as const;
    }
    return { error: error.message } as const;
  }
  const teamId = data as string | null;
  if (!teamId) return { error: "That invite link isn't valid." } as const;

  await supabase
    .from("profiles")
    .update({ onboarding_step: 4, onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  (await cookies()).delete(INVITE_COOKIE);
  redirect(`/dashboard/team/${teamId}`);
}
