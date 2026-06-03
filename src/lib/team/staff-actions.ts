"use server";

// Server actions for managing coaching staff (Build 16.5c). Thin wrappers
// over the SECURITY DEFINER RPCs in migration 88 — all the access gating +
// lockout guards live in the DB. Used by the coach edit form and the remove
// control on the coach detail page.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/team/staff-roles";

type Result = { ok: true } | { ok: false; error: string };

export async function updateStaff(input: {
  memberId: string;
  teamId: string;
  role: StaffRole;
  specialties: string[];
  yearsExperience: number | null;
  experienceDetail: string | null;
  certifications: string[];
  contactEmail: string | null;
  contactPhone: string | null;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.rpc("update_team_staff", {
    p_member_id: input.memberId,
    p_role: input.role,
    p_specialties: input.role === "assistant_coach" ? input.specialties : [],
    p_years_experience: input.yearsExperience,
    p_experience_detail: input.experienceDetail,
    p_certifications: input.certifications,
    p_contact_email: input.contactEmail,
    p_contact_phone: input.contactPhone,
  });
  if (error) return { ok: false, error: error.message };

  const base = `/dashboard/team/${input.teamId}/roster`;
  revalidatePath(base);
  revalidatePath(`${base}/coach/${input.memberId}`);
  return { ok: true };
}

export async function removeStaff(input: {
  memberId: string;
  teamId: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.rpc("remove_team_member", {
    p_member_id: input.memberId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/team/${input.teamId}/roster`);
  return { ok: true };
}
