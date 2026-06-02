"use client";

// Settings UI on the workspace shell: profile (editable name + read-only
// email), workspace switcher, and account actions (sign out + delete stub).

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashTopBar from "@/components/dashboard/DashTopBar";
import UserSidebar, { type WorkspaceItem } from "@/components/dashboard/UserSidebar";
import SignOutButton from "@/components/dashboard/SignOutButton";
import { Icon } from "@/components/uff/icons";
import { submitBackfill } from "@/components/BackfillModal.actions";
import { capitalizeName } from "@/lib/format/name";
import type { UserHomeData } from "@/lib/dashboard/user-home-data";

export default function SettingsClient({ data }: { data: UserHomeData }) {
  const { user, leagues, teams } = data;
  const router = useRouter();

  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() ||
    user.email[0]?.toUpperCase() ||
    "U";

  const workspaces: WorkspaceItem[] = [
    ...leagues.map((l) => ({
      id: l.id,
      kind: "league" as const,
      name: l.league_name,
      color: l.league_color,
    })),
    ...teams.map((t) => ({
      id: t.id,
      kind: "team" as const,
      name: t.team_name,
      color: t.team_color ?? "#FF6A1A",
    })),
  ];

  return (
    <div className="uff-web">
      <UserSidebar
        workspaces={workspaces}
        user={{
          firstName: user.firstName ?? user.email.split("@")[0],
          lastName: user.lastName ?? "",
          email: user.email,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          title="Settings"
          kicker="Your account"
          showSearch={false}
          userInitials={initials}
        />

        <div
          className="page"
          style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}
        >
          <ProfileSection
            initialFirst={user.firstName ?? ""}
            initialLast={user.lastName ?? ""}
            email={user.email}
            onSaved={() => router.refresh()}
          />

          <WorkspacesSection workspaces={workspaces} />

          <AccountSection />
        </div>
      </div>
    </div>
  );
}

/* ── Profile ── */

function ProfileSection({
  initialFirst,
  initialLast,
  email,
  onSaved,
}: {
  initialFirst: string;
  initialLast: string;
  email: string;
  onSaved: () => void;
}) {
  const [first, setFirst] = useState(initialFirst);
  const [last, setLast] = useState(initialLast);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = first.trim() !== initialFirst || last.trim() !== initialLast;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await submitBackfill(first, last);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSaved(true);
      onSaved();
    });
  }

  return (
    <Section title="Profile" subtitle="How you show up across your teams.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <FieldCol label="First name" htmlFor="first">
          <input
            id="first"
            className="fr-input"
            value={first}
            onChange={(e) => {
              setFirst(capitalizeName(e.target.value));
              setSaved(false);
            }}
            placeholder="Taylor"
          />
        </FieldCol>
        <FieldCol label="Last name" htmlFor="last">
          <input
            id="last"
            className="fr-input"
            value={last}
            onChange={(e) => {
              setLast(capitalizeName(e.target.value));
              setSaved(false);
            }}
            placeholder="Pangilinan"
          />
        </FieldCol>
      </div>

      <FieldCol label="Email" htmlFor="email" full>
        <input
          id="email"
          className="fr-input"
          value={email}
          readOnly
          disabled
          style={{ opacity: 0.6, cursor: "not-allowed" }}
        />
        <span style={{ fontSize: 11.5, color: "var(--uff-text-mute)", marginTop: 4 }}>
          Email is managed by your login and can&rsquo;t be changed here.
        </span>
      </FieldCol>

      {error && <ErrorBox>{error}</ErrorBox>}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className="wbtn primary"
          style={{ height: 38, opacity: !dirty || pending ? 0.5 : 1 }}
          onClick={save}
          disabled={!dirty || pending}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && !dirty && (
          <span style={{ fontSize: 12.5, color: "var(--uff-lime)", fontWeight: 600 }}>
            Saved
          </span>
        )}
      </div>
    </Section>
  );
}

/* ── Workspaces ── */

function WorkspacesSection({ workspaces }: { workspaces: WorkspaceItem[] }) {
  return (
    <Section
      title="Your workspaces"
      subtitle="Jump to any league or team you belong to."
    >
      {workspaces.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)", lineHeight: 1.5 }}>
          You&rsquo;re not part of any team or league yet.{" "}
          <Link href="/teams/new" style={{ color: "var(--uff-orange)" }}>
            Create one.
          </Link>
        </p>
      ) : (
        <div className="w-card" style={{ padding: 0, overflow: "hidden" }}>
          {workspaces.map((w, i) => (
            <Link
              key={`${w.kind}-${w.id}`}
              href={
                w.kind === "league"
                  ? `/dashboard/league/${w.id}`
                  : `/dashboard/team/${w.id}`
              }
              className="settings-ws-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderTop: i > 0 ? "1px solid var(--uff-line-soft)" : undefined,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: w.color,
                  color: "#0d1117",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {w.name[0]?.toUpperCase() ?? "?"}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--uff-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {w.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--uff-text-mute)",
                  }}
                >
                  {w.kind}
                </span>
              </span>
              <Icon.chevR size={13} />
            </Link>
          ))}
        </div>
      )}
      <style>{`
        .settings-ws-row { transition: background 120ms ease; }
        .settings-ws-row:hover { background: rgba(255,255,255,0.025); }
      `}</style>
    </Section>
  );
}

/* ── Account ── */

function AccountSection() {
  return (
    <Section title="Account">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <SignOutButton className="wbtn" style={{ height: 38 }}>
          Sign out
        </SignOutButton>
        <button
          type="button"
          className="wbtn"
          style={{
            height: 38,
            color: "var(--uff-red)",
            opacity: 0.55,
            cursor: "not-allowed",
          }}
          disabled
          title="Account deletion isn't available yet"
        >
          Delete account
        </button>
      </div>
      <span style={{ fontSize: 11.5, color: "var(--uff-text-mute)" }}>
        Account deletion isn&rsquo;t available yet — reach out and we&rsquo;ll
        handle it for you.
      </span>
    </Section>
  );
}

/* ── Layout atoms ── */

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="w-card"
      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--uff-text-mute)",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--uff-text-dim)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function FieldCol({
  label,
  htmlFor,
  full,
  children,
}: {
  label: string;
  htmlFor: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        flex: full ? "1 1 100%" : "1 1 200px",
        minWidth: 0,
      }}
    >
      <label
        htmlFor={htmlFor}
        style={{ fontSize: 11.5, fontWeight: 600, color: "var(--uff-text-dim)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(255,77,77,0.08)",
        border: "1px solid rgba(255,77,77,0.28)",
        borderRadius: 10,
        color: "#FF8A8A",
        fontSize: 12.5,
      }}
    >
      {children}
    </div>
  );
}
