"use server";

// Server actions for the team-invite flow (Build 16.5b). Thin wrappers over
// the SECURITY DEFINER RPCs in migration 81, plus the uff_invite resume
// cookie that lets a signed-out recipient finish accepting after auth.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { INVITE_COOKIE } from "@/lib/team/invite-cookie";

type CreateResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

export async function createInvite(input: {
  teamId: string;
  role: "head_coach" | "assistant_coach" | "team_manager" | "captain";
  specialties?: string[];
  label?: string | null;
  expiresInDays?: number | null;
}): Promise<CreateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let expiresAt: string | null = null;
  if (input.expiresInDays && input.expiresInDays > 0) {
    expiresAt = new Date(
      Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000
    ).toISOString();
  }

  const { data, error } = await supabase.rpc("create_team_invite", {
    p_team_id: input.teamId,
    p_role: input.role,
    p_specialties: input.role === "assistant_coach" ? input.specialties ?? [] : [],
    p_label: input.label ?? null,
    p_expires_at: expiresAt,
  });

  if (error) return { ok: false, error: error.message };

  // create_team_invite returns a one-row table { id, token }.
  const row = Array.isArray(data) ? data[0] : data;
  const token = row?.token as string | undefined;
  if (!token) return { ok: false, error: "Invite created but no link returned." };

  revalidatePath(`/dashboard/team/${input.teamId}/roster`);
  return { ok: true, token };
}

export async function revokeInvite(input: {
  inviteId: string;
  teamId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_team_invite", {
    p_invite_id: input.inviteId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/team/${input.teamId}/roster`);
  return { ok: true };
}

type AcceptResult =
  | { ok: true; teamId: string }
  | { ok: false; error: string };

export async function acceptInvite(token: string): Promise<AcceptResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("redeem_team_invite", {
    p_token: token,
  });

  // Either way, this resume cookie has served its purpose.
  (await cookies()).delete(INVITE_COOKIE);

  if (error) return { ok: false, error: error.message };
  const teamId = (data as string) ?? null;
  if (!teamId) return { ok: false, error: "Could not join the team." };
  return { ok: true, teamId };
}
