// /join/[token] — accept a team invite (Build 16.5b).
//
// Lives in the (auth) route group so it inherits the branded auth chrome
// (accent glow + BrandLockup header + mono footer + centered main). Public
// route (the proxy treats /join/* as public by prefix): a signed-out
// recipient sees what they're invited to and is prompted to sign in / sign
// up; a signed-in recipient gets an Accept button. The preview comes from
// the get_invite_preview RPC (the token is the authorization — no
// membership), so it renders for non-members too.

import { createClient } from "@/lib/supabase/server";
import {
  inviteRoleLabel,
  inviteRoleAccessLabel,
  specialtyLabel,
  type InviteRole,
} from "@/lib/team/staff-roles";
import JoinInviteClient, { type InvitePreview } from "./JoinInviteClient";

export const dynamic = "force-dynamic";

type PreviewRow = {
  team_id: string;
  team_name: string;
  role: string;
  coach_specialties: string[] | null;
  inviter_first: string | null;
  inviter_last: string | null;
  status: string;
  expires_at: string | null;
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.rpc("get_invite_preview", { p_token: token });
  const row = (Array.isArray(data) ? data[0] : data) as PreviewRow | undefined;

  let preview: InvitePreview | null = null;
  if (row) {
    const role = row.role as InviteRole;
    const inviter =
      [row.inviter_first, row.inviter_last].filter(Boolean).join(" ").trim() ||
      "A coach";
    preview = {
      teamId: row.team_id,
      teamName: row.team_name,
      roleLabel: inviteRoleLabel(role),
      accessLabel: inviteRoleAccessLabel(role),
      specialties:
        role === "assistant_coach"
          ? (row.coach_specialties ?? []).map(specialtyLabel)
          : [],
      inviterName: inviter,
      status: row.status as InvitePreview["status"],
    };
  }

  return <JoinInviteClient token={token} signedIn={!!user} preview={preview} />;
}
