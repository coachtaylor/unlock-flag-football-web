// Shared loader for a single coaching-staff member (Build 16.5c). Both the
// coach detail page and the edit form need the same shaped record, sourced
// from the get_team_staff RPC (which resolves the name past profiles' self-
// only RLS and returns the profile fields added in migration 87).

import type { SupabaseClient } from "@supabase/supabase-js";
import { STAFF_ROLES, type StaffRole } from "@/lib/team/staff-roles";

export type StaffProfile = {
  memberId: string;
  userId: string;
  role: StaffRole;
  specialties: string[];
  firstName: string | null;
  lastName: string | null;
  name: string;
  yearsExperience: number | null;
  experienceDetail: string | null;
  certifications: string[];
  contactEmail: string | null;
  contactPhone: string | null;
};

export type StaffRpcRow = {
  member_id: string;
  user_id: string;
  role: string;
  coach_specialties: string[] | null;
  first_name: string | null;
  last_name: string | null;
  years_experience: number | null;
  experience_detail: string | null;
  certifications: string[] | null;
  contact_email: string | null;
  contact_phone: string | null;
};

// Shape one get_team_staff row into a StaffProfile. Returns null for rows
// outside the staff-role set (defensive — the RPC already filters).
export function shapeStaffRow(row: StaffRpcRow): StaffProfile | null {
  if (!(STAFF_ROLES as string[]).includes(row.role)) return null;
  const name =
    [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Coach";
  return {
    memberId: row.member_id,
    userId: row.user_id,
    role: row.role as StaffRole,
    specialties: row.coach_specialties ?? [],
    firstName: row.first_name,
    lastName: row.last_name,
    name,
    yearsExperience: row.years_experience,
    experienceDetail: row.experience_detail,
    certifications: row.certifications ?? [],
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
  };
}

// Fetch every staff row for the team (one RPC call). Callers that need a
// single member find it in the list; callers that need head-coach count
// (for the "Co-head coach" label) compute it from the same array.
export async function loadTeamStaff(
  supabase: SupabaseClient,
  teamId: string,
): Promise<StaffRpcRow[]> {
  const { data } = await supabase.rpc("get_team_staff", { p_team_id: teamId });
  return (data as StaffRpcRow[] | null) ?? [];
}

export async function loadTeamStaffMember(
  supabase: SupabaseClient,
  teamId: string,
  memberId: string,
): Promise<StaffProfile | null> {
  const rows = await loadTeamStaff(supabase, teamId);
  const row = rows.find((r) => r.member_id === memberId);
  return row ? shapeStaffRow(row) : null;
}
