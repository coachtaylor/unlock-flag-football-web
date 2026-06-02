"use client";

// Client half of the join-invite page. Renders the invite preview and the
// right action for the visitor's state: Accept (signed in) or sign in /
// sign up (signed out, with a resume cookie so they come back here).

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/lib/team/invite-actions";
import { INVITE_COOKIE } from "@/lib/team/invite-cookie";

export type InvitePreview = {
  teamId: string;
  teamName: string;
  roleLabel: string;
  accessLabel: string;
  specialties: string[];
  inviterName: string;
  status: "pending" | "revoked" | "expired" | "accepted";
};

const INVALID_COPY: Record<string, { kicker: string; title: string; body: string }> = {
  invalid: {
    kicker: "Invite not found",
    title: "This invite link isn't valid.",
    body: "Double-check the link with whoever sent it — it may have been mistyped.",
  },
  revoked: {
    kicker: "Invite revoked",
    title: "This invite was cancelled.",
    body: "Ask a coach or captain on the team to send you a fresh link.",
  },
  expired: {
    kicker: "Invite expired",
    title: "This invite link has expired.",
    body: "Ask whoever invited you to generate a new one.",
  },
  accepted: {
    kicker: "Already used",
    title: "This invite has already been used.",
    body: "If that wasn't you, ask the team for a new link.",
  },
};

export default function JoinInviteClient({
  token,
  signedIn,
  preview,
}: {
  token: string;
  signedIn: boolean;
  preview: InvitePreview | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isPending = preview?.status === "pending";

  // Signed-out + a live invite → stash the token so login/proxy can bring
  // the visitor back here after they authenticate.
  useEffect(() => {
    if (!signedIn && isPending) {
      document.cookie = `${INVITE_COOKIE}=${token}; path=/; max-age=1800; samesite=lax`;
    }
  }, [signedIn, isPending, token]);

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInvite(token);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/dashboard/team/${res.teamId}`);
      router.refresh();
    });
  }

  // Invalid token or non-pending status → terminal message.
  if (!preview || preview.status !== "pending") {
    const key = !preview ? "invalid" : preview.status;
    const copy = INVALID_COPY[key] ?? INVALID_COPY.invalid;
    return (
      <Card>
        <Kicker>{copy.kicker}</Kicker>
        <Title>{copy.title}</Title>
        <Body>{copy.body}</Body>
        <Link
          href="/"
          className="wbtn ghost"
          style={{ justifyContent: "center", marginTop: 4 }}
        >
          Back to home
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <Kicker>You&rsquo;re invited</Kicker>
      <Title>
        Join {preview.teamName} as {preview.roleLabel.toLowerCase()}.
      </Title>
      <Body>
        {preview.inviterName} invited you to help run {preview.teamName}.
      </Body>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "12px 0 4px",
        }}
      >
        <Pill>{preview.roleLabel}</Pill>
        <Pill>{preview.accessLabel}</Pill>
        {preview.specialties.map((s) => (
          <Pill key={s}>{s}</Pill>
        ))}
      </div>

      {error && (
        <div
          style={{
            padding: "10px 12px",
            background: "rgba(255,77,77,0.08)",
            border: "1px solid rgba(255,77,77,0.28)",
            borderRadius: 10,
            color: "#FF8A8A",
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      {signedIn ? (
        <button
          type="button"
          className="wbtn primary"
          style={{ justifyContent: "center", height: 44, opacity: pending ? 0.6 : 1 }}
          onClick={accept}
          disabled={pending}
        >
          {pending ? "Joining…" : `Accept & join ${preview.teamName}`}
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--uff-text-mute)", lineHeight: 1.5 }}>
            Sign in or create an account to accept. We&rsquo;ll bring you right
            back here.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/signup"
              className="wbtn ghost"
              style={{ flex: 1, justifyContent: "center", height: 44 }}
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="wbtn primary"
              style={{ flex: 1, justifyContent: "center", height: 44 }}
            >
              Sign in to accept
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-card"
      style={{
        width: "100%",
        maxWidth: 460,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--uff-lime)",
        letterSpacing: ".08em",
        fontWeight: 700,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1
      style={{
        margin: 0,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: "var(--uff-text)",
        lineHeight: 1.15,
      }}
    >
      {children}
    </h1>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)", lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "4px 10px",
        borderRadius: 999,
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line-soft)",
        color: "var(--uff-text-dim)",
      }}
    >
      {children}
    </span>
  );
}
