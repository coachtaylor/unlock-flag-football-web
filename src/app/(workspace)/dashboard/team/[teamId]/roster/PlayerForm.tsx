"use client";

// Add / edit player form for the workspace-scoped roster. UFF tokens,
// section card layout per the design memory ("every form block wrapped
// in <FormSection>"). Writes directly via the browser Supabase client; RLS
// enforces team membership.

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Icon } from "@/components/uff/icons";

import { POSITION_IDS } from "@/lib/positions";
import { fullName, capitalizeName } from "@/lib/format/name";
import { FormSection, FormField, formInputStyle } from "@/components/ui/FormSection";
import { uploadPlayerPhoto } from "@/lib/storage/player-photo";
import { feetInchesToInches, inchesToFeetInches } from "@/lib/format/physicals";
import CaptainInvitePrompt from "./CaptainInvitePrompt";
import CaptainRemovalModal from "./CaptainRemovalModal";
import { revokeCaptainAccess } from "@/lib/roster/captain-actions";

const POSITION_OPTIONS = POSITION_IDS;

export type CaptainAccess = "full" | "view" | "none";

const CAPTAIN_ACCESS_OPTIONS: { id: CaptainAccess; label: string; hint: string }[] = [
  { id: "full", label: "Full access", hint: "Plan practices, log benchmarks, edit the roster." },
  { id: "view", label: "View only", hint: "Can see everything, can't make changes." },
  { id: "none", label: "No access", hint: "A captain in name only — no app login." },
];

export type PlayerFormInitial = {
  id: string;
  firstName: string;
  lastName: string;
  positions: string[];
  jerseyNumber: string;
  notes: string;
  isCaptain: boolean;
  captainAccess: CaptainAccess | null;
  photoUrl: string | null;
  heightIn: number | null;
  weightLb: number | null;
  // True when this player is linked to a login account (team_players.user_id
  // set) — i.e. an invited captain who accepted. Removing the captain tag
  // from such a player revokes their access, so we confirm keep-vs-remove.
  accountLinked: boolean;
};

type Props = {
  teamId: string;
  rosterBasePath: string;
  initial?: PlayerFormInitial;
};

export default function PlayerForm({ teamId, rosterBasePath, initial }: Props) {
  const router = useRouter();
  const isEditing = !!initial;

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [positions, setPositions] = useState<string[]>(initial?.positions ?? []);
  const [jerseyNumber, setJerseyNumber] = useState(initial?.jerseyNumber ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isCaptain, setIsCaptain] = useState(initial?.isCaptain ?? false);
  const [captainAccess, setCaptainAccess] = useState<CaptainAccess>(
    initial?.captainAccess ?? "full"
  );

  // Player card. A stable id is generated up front so a photo can be uploaded to
  // {teamId}/{id}.ext even on the create flow (before the row exists), then
  // written into the insert. Height is captured as ft+in, stored as total inches.
  const [stableId] = useState(() => initial?.id ?? crypto.randomUUID());
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photoUrl ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const initHt = inchesToFeetInches(initial?.heightIn);
  const [heightFt, setHeightFt] = useState(initHt.feet != null ? String(initHt.feet) : "");
  const [heightInch, setHeightInch] = useState(initHt.inches != null ? String(initHt.inches) : "");
  const [weightLb, setWeightLb] = useState(
    initial?.weightLb != null ? String(initial.weightLb) : ""
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // After saving a captain with full/view access, prompt to generate an
  // access invite linked to their player row.
  const [invitePrompt, setInvitePrompt] = useState<{
    playerId: string;
    access: "full" | "view";
    destination: string;
  } | null>(null);
  // When an invited captain has their tag removed, confirm whether to keep
  // them as a player or remove them from the roster (their access is revoked
  // either way).
  const [captainRemoval, setCaptainRemoval] = useState(false);

  function togglePosition(pos: string) {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  }

  // Move `pos` to the front of the positions[] array — by convention,
  // index 0 is the player's primary position. See src/lib/positions.ts.
  function promoteToPrimary(pos: string) {
    setPositions((prev) => {
      if (!prev.includes(pos)) return prev;
      return [pos, ...prev.filter((p) => p !== pos)];
    });
  }

  // NOTE: is_injured + injury_note are intentionally NOT in this payload.
  // Injury status is captured via the InjuryModal on the player detail page
  // (Build 6.5c). Including the fields here would overwrite the modal's writes
  // whenever the captain edits any other field. See MOBILE_APP_REFERENCE §6.5.
  function buildPayload() {
    return {
      team_id: teamId,
      // player_name stays the canonical display field (= first [+ last]);
      // first_name/last_name add the structured form.
      player_name: fullName(firstName, lastName),
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      positions,
      jersey_number: jerseyNumber.trim() || null,
      notes: notes.trim() || null,
      is_captain: isCaptain,
      // Permission tier only applies to captains; cleared otherwise.
      captain_access: isCaptain ? captainAccess : null,
      photo_url: photoUrl,
      height_in: feetInchesToInches(
        heightFt.trim() ? parseInt(heightFt, 10) : null,
        heightInch.trim() ? parseInt(heightInch, 10) : null,
      ),
      weight_lb: weightLb.trim() ? parseInt(weightLb, 10) : null,
    };
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setError(null);
    setPhotoBusy(true);
    const res = await uploadPlayerPhoto({ teamId, playerId: stableId, file });
    setPhotoBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setPhotoUrl(res.url);
  }

  // Keep the invited captain on the roster as a regular player: persist the
  // edits (with is_captain off) then revoke their coach-side membership.
  async function handleKeepAsPlayer() {
    if (!initial) return;
    setSubmitting(true);
    setError(null);
    const { error: updErr } = await supabase
      .from("team_players")
      .update(buildPayload())
      .eq("id", initial.id);
    if (updErr) {
      setError(updErr.message);
      setSubmitting(false);
      return;
    }
    const res = await revokeCaptainAccess({
      playerId: initial.id,
      teamId,
      deletePlayer: false,
    });
    if (!res.ok) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    setCaptainRemoval(false);
    router.push(`${rosterBasePath}/${initial.id}`);
    router.refresh();
  }

  // Remove the player from the roster entirely (revokes access + deletes row).
  async function handleRemoveFromRoster() {
    if (!initial) return;
    setSubmitting(true);
    setError(null);
    const res = await revokeCaptainAccess({
      playerId: initial.id,
      teamId,
      deletePlayer: true,
    });
    if (!res.ok) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    setCaptainRemoval(false);
    router.push(rosterBasePath);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }

    // Removing the captain tag from an invited captain revokes their access —
    // confirm keep-vs-remove before saving.
    if (isEditing && initial?.isCaptain && !isCaptain && initial.accountLinked) {
      setCaptainRemoval(true);
      return;
    }

    setSubmitting(true);

    const payload = buildPayload();

    let savedId: string;
    let destination: string;

    if (isEditing && initial) {
      const { error: updateErr } = await supabase
        .from("team_players")
        .update(payload)
        .eq("id", initial.id);
      if (updateErr) {
        setError(updateErr.message);
        setSubmitting(false);
        return;
      }
      savedId = initial.id;
      destination = `${rosterBasePath}/${initial.id}`;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("team_players")
        .insert({ ...payload, id: stableId, status: "active" })
        .select("id")
        .single();
      if (insertErr || !inserted) {
        setError(insertErr?.message ?? "Couldn't add player.");
        setSubmitting(false);
        return;
      }
      savedId = inserted.id as string;
      destination = rosterBasePath;
    }

    // A captain with full/view access needs a login → offer an invite linked
    // to this player row before leaving the form.
    if (isCaptain && (captainAccess === "full" || captainAccess === "view")) {
      setInvitePrompt({ playerId: savedId, access: captainAccess, destination });
      setSubmitting(false);
      return;
    }

    router.push(destination);
    router.refresh();
  }

  const backHref =
    isEditing && initial ? `${rosterBasePath}/${initial.id}` : rosterBasePath;

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
        href={backHref}
        className="wbtn ghost"
        style={{ height: 32, alignSelf: "flex-start" }}
      >
        <Icon.arrowLeft size={12} /> Back
      </Link>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <FormSection title="Identity">
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <FormField label="First name" htmlFor="firstName" required>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(capitalizeName(e.target.value))}
                  placeholder="Jordan"
                  style={formInputStyle}
                />
              </FormField>
            </div>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <FormField label="Last name" htmlFor="lastName">
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(capitalizeName(e.target.value))}
                  placeholder="Reyes (optional)"
                  style={formInputStyle}
                />
              </FormField>
            </div>
          </div>

          <FormField label="Jersey number" htmlFor="jerseyNumber">
            <input
              id="jerseyNumber"
              type="text"
              inputMode="numeric"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              placeholder="12"
              style={{ ...formInputStyle, maxWidth: 120 }}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Player card"
          subtitle="Optional — a photo and measurables for the player's card."
        >
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <label
              style={{
                position: "relative",
                width: 76,
                height: 76,
                borderRadius: "50%",
                overflow: "hidden",
                cursor: "pointer",
                flexShrink: 0,
                border: "1px solid var(--uff-line)",
                background: "var(--uff-surface-2)",
                display: "grid",
                placeItems: "center",
              }}
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: 24, color: "var(--uff-text-mute)", lineHeight: 1 }}>+</span>
              )}
              {photoBusy && (
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(0,0,0,0.5)",
                    fontSize: 11,
                    color: "#fff",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  …
                </span>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePhotoChange}
                style={{ display: "none" }}
              />
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 13, color: "var(--uff-text)" }}>
                {photoUrl ? "Photo added" : "Add a photo"}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--uff-text-dim)" }}>
                JPG, PNG, or WebP · under 5 MB
              </span>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 2,
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--uff-red)",
                    fontSize: 11.5,
                    cursor: "pointer",
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <FormField label="Height" htmlFor="heightFt">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  id="heightFt"
                  type="text"
                  inputMode="numeric"
                  value={heightFt}
                  onChange={(e) => setHeightFt(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="6"
                  style={{ ...formInputStyle, maxWidth: 56, textAlign: "center" }}
                />
                <span style={{ fontSize: 12.5, color: "var(--uff-text-dim)" }}>ft</span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Height inches"
                  value={heightInch}
                  onChange={(e) => setHeightInch(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="1"
                  style={{ ...formInputStyle, maxWidth: 56, textAlign: "center" }}
                />
                <span style={{ fontSize: 12.5, color: "var(--uff-text-dim)" }}>in</span>
              </div>
            </FormField>
            <FormField label="Weight" htmlFor="weightLb">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  id="weightLb"
                  type="text"
                  inputMode="numeric"
                  value={weightLb}
                  onChange={(e) => setWeightLb(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="190"
                  style={{ ...formInputStyle, maxWidth: 80, textAlign: "center" }}
                />
                <span style={{ fontSize: 12.5, color: "var(--uff-text-dim)" }}>lb</span>
              </div>
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title="Positions"
          subtitle="Tap a position to add or remove. The first selected position is the player's primary."
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            {POSITION_OPTIONS.map((pos) => {
              const selectedIdx = positions.indexOf(pos);
              const selected = selectedIdx >= 0;
              const isPrimary = selectedIdx === 0;
              const isSecondary = selected && !isPrimary;
              return (
                <div
                  key={pos}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    // Reserve the eyebrow line height for every chip so the
                    // row stays aligned whether or not the PRIMARY badge is shown.
                    minHeight: 56,
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      color: isPrimary ? "var(--uff-orange)" : "transparent",
                      fontFamily: "var(--font-mono)",
                      lineHeight: 1,
                      userSelect: "none",
                    }}
                    aria-hidden={!isPrimary}
                  >
                    PRIMARY
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => togglePosition(pos)}
                      aria-pressed={selected}
                      className={`chip ${selected ? "on" : ""}`}
                      style={{ height: 34, fontSize: 12.5, padding: "0 14px" }}
                    >
                      {pos}
                    </button>
                    {isSecondary && (
                      <button
                        type="button"
                        onClick={() => promoteToPrimary(pos)}
                        aria-label={`Make ${pos} primary position`}
                        title="Make primary"
                        style={{
                          height: 28,
                          width: 28,
                          padding: 0,
                          borderRadius: 6,
                          border: "1px solid var(--uff-line)",
                          background: "rgba(255,255,255,0.03)",
                          color: "var(--uff-text-mute)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 14,
                          lineHeight: 1,
                          cursor: "pointer",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        ↑
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </FormSection>

        <FormSection title="Roles">
          <ToggleRow
            checked={isCaptain}
            onChange={setIsCaptain}
            label="Captain"
            description="Player-leader. Badged on the roster; choose their app access below."
          />

          {isCaptain && (
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
                Captain access
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CAPTAIN_ACCESS_OPTIONS.map((opt) => {
                  const on = captainAccess === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCaptainAccess(opt.id)}
                      aria-pressed={on}
                      style={{
                        flex: "1 1 0",
                        minWidth: 130,
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
                        {opt.label}
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--uff-text-mute)", lineHeight: 1.4 }}>
                        {opt.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--uff-text-dim)", lineHeight: 1.5 }}>
                Full or view access requires the captain to have an account —
                send them an invite from the roster to set up their login.
              </p>
            </div>
          )}
        </FormSection>

        <FormSection title="Notes" subtitle="Optional, private to your team.">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Strengths, things to work on, anything else…"
            rows={4}
            style={{ ...formInputStyle, height: "auto", padding: 10, resize: "vertical" }}
          />
        </FormSection>

        {error && (
          <p
            style={{
              fontSize: 12.5,
              color: "var(--uff-red)",
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingTop: 4,
          }}
        >
          <Link href={backHref} className="wbtn ghost" style={{ height: 44 }}>
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="wbtn primary"
            style={{ height: 44, flex: 1, justifyContent: "center" }}
          >
            {submitting
              ? isEditing
                ? "Saving…"
                : "Adding…"
              : isEditing
                ? "Save changes"
                : "Add player"}
          </button>
        </div>
      </form>

      {invitePrompt && (
        <CaptainInvitePrompt
          teamId={teamId}
          playerId={invitePrompt.playerId}
          playerName={fullName(firstName, lastName)}
          access={invitePrompt.access}
          onClose={() => {
            const dest = invitePrompt.destination;
            setInvitePrompt(null);
            router.push(dest);
            router.refresh();
          }}
        />
      )}

      {captainRemoval && (
        <CaptainRemovalModal
          playerName={fullName(firstName, lastName)}
          pending={submitting}
          error={error}
          onKeep={handleKeepAsPlayer}
          onRemove={handleRemoveFromRoster}
          onCancel={() => {
            if (submitting) return;
            setCaptainRemoval(false);
            // Re-check the captain box so the form matches saved state — they
            // backed out of removing the tag.
            setIsCaptain(true);
            setError(null);
          }}
        />
      )}
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  description,
  accent = "var(--uff-orange)",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: checked
          ? `color-mix(in srgb, ${accent} 10%, transparent)`
          : "var(--uff-surface-2)",
        border: `1px solid ${checked ? accent : "var(--uff-line-soft)"}`,
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        color: "inherit",
      }}
    >
      <span
        style={{
          width: 36,
          height: 22,
          borderRadius: 999,
          background: checked ? accent : "rgba(255,255,255,0.10)",
          position: "relative",
          transition: "background 0.12s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 16 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#0d1117",
            transition: "left 0.12s",
          }}
        />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--uff-text)" }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--uff-text-mute)",
            marginTop: 2,
          }}
        >
          {description}
        </div>
      </div>
    </button>
  );
}

