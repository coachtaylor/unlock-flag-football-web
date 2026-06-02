"use client";

// Pending invites list (Build 16.5b) — outstanding, not-yet-accepted invite
// links for the team. Shown under the coaching-staff table to full-access
// members only. Each row can copy its link or revoke it. Covers every role
// (coach roles + captain), so it's a list rather than faked roster rows for
// people who haven't accepted yet.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeInvite } from "@/lib/team/invite-actions";
import {
  inviteRoleLabel,
  specialtyLabel,
  type InviteRole,
} from "@/lib/team/staff-roles";

export type PendingInvite = {
  id: string;
  token: string;
  role: InviteRole;
  specialties: string[];
  label: string | null;
  expiresAt: string | null;
};

function expiryText(expiresAt: string | null): string {
  if (!expiresAt) return "No expiry";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 1) return "Expires today";
  return `Expires in ${days}d`;
}

export default function PendingInvites({
  teamId,
  invites,
}: {
  teamId: string;
  invites: PendingInvite[];
}) {
  if (invites.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
        }}
      >
        Pending invites · {invites.length}
      </span>
      <div className="w-card" style={{ padding: 0, overflow: "hidden" }}>
        {invites.map((inv, i) => (
          <InviteRow key={inv.id} teamId={teamId} inv={inv} divider={i > 0} />
        ))}
      </div>
    </div>
  );
}

function InviteRow({
  teamId,
  inv,
  divider,
}: {
  teamId: string;
  inv: PendingInvite;
  divider: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/join/${inv.token}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy");
    }
  }

  function revoke() {
    setError(null);
    startTransition(async () => {
      const res = await revokeInvite({ inviteId: inv.id, teamId });
      if (!res.ok) {
        setError(res.error ?? "Couldn't revoke");
        return;
      }
      router.refresh();
    });
  }

  const specialtySuffix =
    inv.role === "assistant_coach" && inv.specialties.length > 0
      ? ` · ${inv.specialties.map(specialtyLabel).join(", ")}`
      : "";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderTop: divider ? "1px solid var(--uff-line-soft)" : undefined,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 200px" }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--uff-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {inv.label || "Anyone with the link"}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--uff-text-mute)", marginTop: 1 }}>
          {inviteRoleLabel(inv.role)}
          {specialtySuffix} · {expiryText(inv.expiresAt)}
        </div>
        {error && (
          <div style={{ fontSize: 11.5, color: "#FF8A8A", marginTop: 3 }}>{error}</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button type="button" className="wbtn" style={{ height: 30 }} onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          className="wbtn ghost"
          style={{ height: 30, color: "var(--uff-red)", opacity: pending ? 0.6 : 1 }}
          onClick={revoke}
          disabled={pending}
        >
          {pending ? "…" : "Revoke"}
        </button>
      </div>
    </div>
  );
}
