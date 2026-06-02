"use client";

// Invite modal (Build 16.5b) — a full-access member generates a
// per-recipient invite link with the role baked in. Lives in the roster's
// Coaching staff header. Two phases: the form, then the generated link with
// a copy button.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/uff/icons";
import { createInvite } from "@/lib/team/invite-actions";
import {
  STAFF_ROLES,
  STAFF_ROLE_META,
  SPECIALTY_LABELS,
  type InviteRole,
} from "@/lib/team/staff-roles";

// Invites cover coaching staff only — captains are added through the player
// flow (with their own permission tier), not invited as a role here.
const ROLE_OPTIONS = STAFF_ROLES.map((id) => ({
  id: id as InviteRole,
  label: STAFF_ROLE_META[id].label,
  hint: STAFF_ROLE_META[id].hint,
  access: STAFF_ROLE_META[id].accessLabel,
}));

const EXPIRY_OPTIONS: { label: string; days: number | null }[] = [
  { label: "Never", days: null },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
];

export default function InviteModal({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [role, setRole] = useState<InviteRole>("assistant_coach");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [expiryDays, setExpiryDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset everything and open. Done in the handler (not an effect) so the
  // form is fresh each time without a setState-in-effect cascade.
  function openModal() {
    setRole("assistant_coach");
    setSpecialties([]);
    setLabel("");
    setExpiryDays(null);
    setError(null);
    setLink(null);
    setCopied(false);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function toggleSpecialty(s: string) {
    setSpecialties((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createInvite({
        teamId,
        role,
        specialties: role === "assistant_coach" ? specialties : [],
        label: label.trim() || null,
        expiresInDays: expiryDays,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLink(`${window.location.origin}/join/${res.token}`);
      router.refresh(); // surface the new pending invite in the list
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy — select the link and copy manually.");
    }
  }

  return (
    <>
      <button
        type="button"
        className="wbtn primary"
        style={{ height: 34 }}
        onClick={openModal}
      >
        <Icon.plus size={13} /> Invite
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-headline"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.62)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            zIndex: 50,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "var(--uff-bg-1)",
              border: "1px solid var(--uff-line)",
              borderRadius: 14,
              padding: 22,
              boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--uff-orange)",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Invite to team
            </div>
            <h2
              id="invite-modal-headline"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--uff-text)",
              }}
            >
              {link ? "Invite link ready" : `Invite someone to ${teamName}`}
            </h2>

            {link ? (
              <LinkReady
                link={link}
                copied={copied}
                onCopy={copy}
                onAnother={() => {
                  setLink(null);
                  setCopied(false);
                }}
                onDone={() => setOpen(false)}
              />
            ) : (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Role picker */}
                <Field label="Role">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {ROLE_OPTIONS.map((opt) => {
                      const on = role === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setRole(opt.id)}
                          aria-pressed={on}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            textAlign: "left",
                            padding: "10px 12px",
                            borderRadius: 10,
                            cursor: "pointer",
                            background: on ? "rgba(255,106,26,0.08)" : "var(--uff-surface-2)",
                            border: on
                              ? "1px solid var(--uff-orange)"
                              : "1px solid var(--uff-line-soft)",
                          }}
                        >
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              flexShrink: 0,
                              border: on
                                ? "5px solid var(--uff-orange)"
                                : "2px solid var(--uff-text-mute)",
                              background: on ? "var(--uff-bg-1)" : "transparent",
                            }}
                          />
                          <span style={{ minWidth: 0 }}>
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 13.5,
                                fontWeight: 600,
                                color: "var(--uff-text)",
                              }}
                            >
                              {opt.label}
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  letterSpacing: ".06em",
                                  textTransform: "uppercase",
                                  color: "var(--uff-text-mute)",
                                }}
                              >
                                {opt.access}
                              </span>
                            </span>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11.5,
                                color: "var(--uff-text-mute)",
                                lineHeight: 1.45,
                                marginTop: 2,
                              }}
                            >
                              {opt.hint}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* Specialty (assistant coach only) */}
                {role === "assistant_coach" && (
                  <Field label="Focus (optional)">
                    <div style={{ display: "flex", gap: 8 }}>
                      {Object.keys(SPECIALTY_LABELS).map((s) => {
                        const on = specialties.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleSpecialty(s)}
                            aria-pressed={on}
                            className={`chip ${on ? "on" : ""}`}
                          >
                            {SPECIALTY_LABELS[s]}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}

                {/* Label */}
                <Field label="Who's this for? (optional)">
                  <input
                    className="fr-input"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Marcus (D-line coach)"
                    style={{ fontSize: 13 }}
                  />
                </Field>

                {/* Expiry */}
                <Field label="Link expires">
                  <div className="fr-seg" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                    {EXPIRY_OPTIONS.map((opt) => {
                      const on = expiryDays === opt.days;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setExpiryDays(opt.days)}
                          className={on ? "on" : ""}
                          style={on ? { background: "var(--uff-orange)", color: "#0a0a0d" } : undefined}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {error && <ErrorBox>{error}</ErrorBox>}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="wbtn ghost"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => setOpen(false)}
                    disabled={pending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="wbtn primary"
                    style={{ flex: 1, justifyContent: "center", opacity: pending ? 0.6 : 1 }}
                    onClick={submit}
                    disabled={pending}
                  >
                    {pending ? "Creating…" : "Create invite link"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function LinkReady({
  link,
  copied,
  onCopy,
  onAnother,
  onDone,
}: {
  link: string;
  copied: boolean;
  onCopy: () => void;
  onAnother: () => void;
  onDone: () => void;
}) {
  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)", lineHeight: 1.5 }}>
        Send this link to the person you&rsquo;re inviting. They&rsquo;ll join
        with the role you picked. It works once.
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--uff-surface-2)",
          border: "1px solid var(--uff-line-soft)",
          borderRadius: 10,
          padding: "8px 10px",
        }}
      >
        <code
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--uff-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {link}
        </code>
        <button
          type="button"
          className="wbtn"
          style={{ height: 30, flexShrink: 0 }}
          onClick={onCopy}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="wbtn ghost"
          style={{ flex: 1, justifyContent: "center" }}
          onClick={onAnother}
        >
          Create another
        </button>
        <button
          type="button"
          className="wbtn primary"
          style={{ flex: 1, justifyContent: "center" }}
          onClick={onDone}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
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
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
