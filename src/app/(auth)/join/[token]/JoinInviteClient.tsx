"use client";

// Client half of the join-invite page, styled in the .uff auth design
// language (card-canonical + btn-* + pill-*), so it reads as a sibling of
// the login/signup screens. Renders the invite preview and the right action
// for the visitor: Accept (signed in) or sign in / sign up (signed out, with
// a resume cookie so they come back here after auth).

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

const TERMINAL_COPY: Record<
  string,
  { kicker: string; title: string; body: string }
> = {
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

  // Signed-out + a live invite → stash the token so login/proxy bring the
  // visitor back here after they authenticate.
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
    const copy = TERMINAL_COPY[!preview ? "invalid" : preview.status] ?? TERMINAL_COPY.invalid;
    return (
      <Card>
        <Kicker tone="muted">{copy.kicker}</Kicker>
        <Title>{copy.title}</Title>
        <Body>{copy.body}</Body>
        <div style={{ marginTop: 8 }}>
          <Link href="/" className="btn btn-ghost">
            Back to home
          </Link>
        </div>
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
        <span className="pill pill-orange">{preview.roleLabel}</span>
        <span className="pill pill-ghost">{preview.accessLabel}</span>
        {preview.specialties.map((s) => (
          <span key={s} className="pill pill-ghost">
            {s}
          </span>
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
          className="btn btn-primary btn-lg"
          style={{ width: "100%" }}
          onClick={accept}
          disabled={pending}
        >
          {pending ? "Joining…" : `Accept & join ${preview.teamName}`}
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Body>
            Sign in or create an account to accept — we&rsquo;ll bring you
            right back here.
          </Body>
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              href="/signup"
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Create account
            </Link>
            <Link href="/login" className="btn btn-primary" style={{ flex: 1 }}>
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
      className="card-canonical"
      style={{
        width: "100%",
        maxWidth: 440,
        padding: 32,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}

function Kicker({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "muted";
}) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: tone === "muted" ? "var(--text-muted)" : "var(--uff-lime-400)",
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
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: "-0.5px",
        lineHeight: 1.12,
        color: "var(--text-primary)",
      }}
    >
      {children}
    </h1>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 14,
        color: "var(--text-secondary)",
        lineHeight: 1.55,
      }}
    >
      {children}
    </p>
  );
}
