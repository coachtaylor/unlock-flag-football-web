"use client";

// Edit form for a coaching-staff profile (Build 16.5c). Name comes from the
// person's account (read-only here); captains/admins edit role, offense/
// defense focus, years of experience, background, certifications, and contact
// info. Saves through the update_team_staff RPC (via the updateStaff server
// action), which enforces access + the last-full-access lockout guard.

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/uff/icons";
import { FormSection, FormField, formInputStyle } from "@/components/ui/FormSection";
import { updateStaff } from "@/lib/team/staff-actions";
import {
  STAFF_ROLES,
  STAFF_ROLE_META,
  SPECIALTY_LABELS,
  type StaffRole,
} from "@/lib/team/staff-roles";

const SPECIALTIES = Object.keys(SPECIALTY_LABELS); // ["offense", "defense"]

export type CoachFormInitial = {
  memberId: string;
  name: string;
  role: StaffRole;
  specialties: string[];
  yearsExperience: number | null;
  experienceDetail: string;
  certifications: string[];
  contactEmail: string;
  contactPhone: string;
};

export default function CoachForm({
  teamId,
  coachBasePath,
  initial,
}: {
  teamId: string;
  coachBasePath: string;
  initial: CoachFormInitial;
}) {
  const router = useRouter();

  const [role, setRole] = useState<StaffRole>(initial.role);
  const [specialties, setSpecialties] = useState<string[]>(initial.specialties);
  const [years, setYears] = useState(
    initial.yearsExperience != null ? String(initial.yearsExperience) : "",
  );
  const [experienceDetail, setExperienceDetail] = useState(initial.experienceDetail);
  const [certifications, setCertifications] = useState<string[]>(initial.certifications);
  const [certDraft, setCertDraft] = useState("");
  const [contactEmail, setContactEmail] = useState(initial.contactEmail);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleSpecialty(s: string) {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function addCert() {
    const v = certDraft.trim();
    if (!v) return;
    if (!certifications.some((c) => c.toLowerCase() === v.toLowerCase())) {
      setCertifications((prev) => [...prev, v]);
    }
    setCertDraft("");
  }

  function removeCert(c: string) {
    setCertifications((prev) => prev.filter((x) => x !== c));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let yearsValue: number | null = null;
    if (years.trim()) {
      const n = parseInt(years.trim(), 10);
      if (!Number.isFinite(n) || n < 0 || n > 80) {
        setError("Years of experience must be a number between 0 and 80.");
        return;
      }
      yearsValue = n;
    }

    setSubmitting(true);
    const res = await updateStaff({
      memberId: initial.memberId,
      teamId,
      role,
      specialties,
      yearsExperience: yearsValue,
      experienceDetail: experienceDetail.trim() || null,
      certifications,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
    });
    if (!res.ok) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    router.push(coachBasePath);
    router.refresh();
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        maxWidth: 720,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <Link
        href={coachBasePath}
        className="wbtn ghost"
        style={{ height: 32, alignSelf: "flex-start" }}
      >
        <Icon.arrowLeft size={12} /> Back
      </Link>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FormSection title="Coach" subtitle="Name comes from their account.">
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--uff-text)",
              letterSpacing: "-0.01em",
            }}
          >
            {initial.name}
          </div>
        </FormSection>

        <FormSection
          title="Role"
          subtitle="Sets what this person can do on the team."
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STAFF_ROLES.map((r) => {
              const meta = STAFF_ROLE_META[r];
              const on = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={on}
                  style={{
                    flex: "1 1 0",
                    minWidth: 150,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    textAlign: "left",
                    padding: "11px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    background: on
                      ? "color-mix(in srgb, var(--uff-orange) 10%, transparent)"
                      : "var(--uff-surface-2)",
                    border: on
                      ? "1px solid var(--uff-orange)"
                      : "1px solid var(--uff-line-soft)",
                    color: "inherit",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: on ? "var(--uff-orange)" : "var(--uff-text)",
                    }}
                  >
                    {meta.label}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--uff-text-mute)", lineHeight: 1.4 }}>
                    {meta.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {role === "assistant_coach" && (
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
                Focus (optional)
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {SPECIALTIES.map((s) => {
                  const on = specialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      aria-pressed={on}
                      className={`chip ${on ? "on" : ""}`}
                      style={{ height: 34, fontSize: 12.5, padding: "0 14px" }}
                    >
                      {SPECIALTY_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </FormSection>

        <FormSection title="Experience">
          <FormField label="Years of experience" htmlFor="years">
            <input
              id="years"
              type="text"
              inputMode="numeric"
              value={years}
              onChange={(e) => setYears(e.target.value)}
              placeholder="8"
              style={{ ...formInputStyle, maxWidth: 120 }}
            />
          </FormField>
          <FormField label="Background" htmlFor="experienceDetail">
            <textarea
              id="experienceDetail"
              value={experienceDetail}
              onChange={(e) => setExperienceDetail(e.target.value)}
              placeholder="Coaching history, playing background, anything relevant…"
              rows={4}
              style={{ ...formInputStyle, height: "auto", padding: 10, resize: "vertical" }}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Certifications"
          subtitle="e.g. USA Football Level 1, CPR / First Aid."
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={certDraft}
              onChange={(e) => setCertDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCert();
                }
              }}
              placeholder="Add a certification"
              style={formInputStyle}
            />
            <button
              type="button"
              onClick={addCert}
              className="wbtn"
              style={{ height: 40, flexShrink: 0 }}
            >
              Add
            </button>
          </div>
          {certifications.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {certifications.map((c) => (
                <span
                  key={c}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "5px 8px 5px 12px",
                    borderRadius: 999,
                    background: "var(--uff-surface-2)",
                    border: "1px solid var(--uff-line-soft)",
                    color: "var(--uff-text-dim)",
                  }}
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCert(c)}
                    aria-label={`Remove ${c}`}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "none",
                      background: "rgba(255,255,255,0.06)",
                      color: "var(--uff-text-mute)",
                      cursor: "pointer",
                      fontSize: 12,
                      lineHeight: 1,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection title="Contact" subtitle="Optional, visible to the coaching staff.">
          <FormField label="Email" htmlFor="contactEmail">
            <input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="coach@example.com"
              style={formInputStyle}
            />
          </FormField>
          <FormField label="Phone" htmlFor="contactPhone">
            <input
              id="contactPhone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="(555) 123-4567"
              style={{ ...formInputStyle, maxWidth: 220 }}
            />
          </FormField>
        </FormSection>

        {error && (
          <p style={{ fontSize: 12.5, color: "var(--uff-red)", margin: 0 }}>{error}</p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          <Link href={coachBasePath} className="wbtn ghost" style={{ height: 44 }}>
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="wbtn primary"
            style={{ height: 44, flex: 1, justifyContent: "center" }}
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
