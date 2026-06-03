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

// Fetch ONE staff member by id. Sourced from get_team_member (migration 90),
// which has NO captain exclusion — so the coach detail/edit pages resolve a
// real team_members row instead of 404'ing on one that get_team_staff filters
// out of the roster list.
export async function loadTeamStaffMember(
  supabase: SupabaseClient,
  teamId: string,
  memberId: string,
): Promise<StaffProfile | null> {
  const { data } = await supabase.rpc("get_team_member", {
    p_team_id: teamId,
    p_member_id: memberId,
  });
  const row = (Array.isArray(data) ? data[0] : data) as StaffRpcRow | undefined;
  return row ? shapeStaffRow(row) : null;
}
