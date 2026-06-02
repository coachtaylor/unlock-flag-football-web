// /join/[token] — accept a team invite (Build 16.5b).
//
// Public route (see proxy): a signed-out recipient can land here, see what
// they're being invited to, and is prompted to sign in / sign up. A
// signed-in recipient gets an Accept button that redeems the invite and
// drops them on the team dashboard. The preview comes from the
// get_invite_preview RPC (the token is the authorization — no membership).

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

  return (
    <div
      className="uff-web"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "48px 20px",
      }}
    >
      <JoinInviteClient token={token} signedIn={!!user} preview={preview} />
    </div>
  );
}
