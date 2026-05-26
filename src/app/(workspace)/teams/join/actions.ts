"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_ROLES = ["captain", "coach", "assistant"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

type Result =
  | { ok: true; teamId: string }
  | { ok: false; error: string };

export async function joinTeam(formData: FormData): Promise<Result> {
  const raw = String(formData.get("teamId") ?? "").trim().toLowerCase();
  if (!raw) return { ok: false, error: "Enter a team ID." };
  if (!UUID_RE.test(raw)) {
    return {
      ok: false,
      error: "That doesn't look like a valid team ID. It should be a UUID.",
    };
  }

  const roleRaw = String(formData.get("role") ?? "assistant");
  const role: Role = (ALLOWED_ROLES as readonly string[]).includes(roleRaw)
    ? (roleRaw as Role)
    : "assistant";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("join_team_by_id", {
    p_team_id: raw,
    p_role: role,
  });

  if (error) {
    if (error.code === "P0002" || /team not found/i.test(error.message)) {
      return {
        ok: false,
        error: "No team found with that ID. Double-check it with whoever sent it.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, teamId: (data as string) ?? raw };
}
