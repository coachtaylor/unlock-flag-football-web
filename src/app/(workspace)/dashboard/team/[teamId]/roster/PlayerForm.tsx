"use client";

// Add / edit player form for the workspace-scoped roster. UFF tokens,
// section card layout per the design memory ("every form block wrapped
// in <Section>"). Writes directly via the browser Supabase client; RLS
// enforces team membership.

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Icon } from "@/components/uff/icons";

import { POSITION_IDS } from "@/lib/positions";

const POSITION_OPTIONS = POSITION_IDS;

export type PlayerFormInitial = {
  id: string;
  playerName: string;
  positions: string[];
  jerseyNumber: string;
  notes: string;
  isCaptain: boolean;
};

type Props = {
  teamId: string;
  rosterBasePath: string;
  initial?: PlayerFormInitial;
};

export default function PlayerForm({ teamId, rosterBasePath, initial }: Props) {
  const router = useRouter();
  const isEditing = !!initial;

  const [playerName, setPlayerName] = useState(initial?.playerName ?? "");
  const [positions, setPositions] = useState<string[]>(initial?.positions ?? []);
  const [jerseyNumber, setJerseyNumber] = useState(initial?.jerseyNumber ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isCaptain, setIsCaptain] = useState(initial?.isCaptain ?? false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!playerName.trim()) {
      setError("Player name is required.");
      return;
    }
    setSubmitting(true);

    // NOTE: is_injured + injury_note are intentionally NOT in this
    // payload. Injury status is captured via the InjuryModal on the
    // player detail page (Build 6.5c). Including the fields here would
    // overwrite the modal's writes whenever the captain edits any other
    // field. See MOBILE_APP_REFERENCE §6.5.
    const payload = {
      team_id: teamId,
      player_name: playerName.trim(),
      positions,
      jersey_number: jerseyNumber.trim() || null,
      notes: notes.trim() || null,
      is_captain: isCaptain,
    };

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
      router.push(`${rosterBasePath}/${initial.id}`);
      router.refresh();
    } else {
      const { error: insertErr } = await supabase
        .from("team_players")
        .insert({ ...payload, status: "active" });
      if (insertErr) {
        setError(insertErr.message);
        setSubmitting(false);
        return;
      }
      router.push(rosterBasePath);
      router.refresh();
    }
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
        <Section title="Identity">
          <Field label="Player name" htmlFor="playerName" required>
            <input
              id="playerName"
              type="text"
              required
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g., Jordan Reyes"
              style={inputStyle}
            />
          </Field>

          <Field label="Jersey number" htmlFor="jerseyNumber">
            <input
              id="jerseyNumber"
              type="text"
              inputMode="numeric"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              placeholder="12"
              style={{ ...inputStyle, maxWidth: 120 }}
            />
          </Field>
        </Section>

        <Section
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
        </Section>

        <Section title="Roles">
          <ToggleRow
            checked={isCaptain}
            onChange={setIsCaptain}
            label="Captain"
            description="Captains can plan practices and log benchmarks."
          />
        </Section>

        <Section title="Notes" subtitle="Optional, private to your team.">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Strengths, things to work on, anything else…"
            rows={4}
            style={{ ...inputStyle, height: "auto", padding: 10, resize: "vertical" }}
          />
        </Section>

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
    </div>
  );
}

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
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--uff-text-mute)",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 12,
              color: "var(--uff-text-dim)",
              marginTop: 4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--uff-text-dim)",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--uff-orange)", marginLeft: 4 }}>*</span>
        )}
      </label>
      {children}
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  background: "var(--uff-surface-2)",
  border: "1px solid var(--uff-line-soft)",
  borderRadius: 8,
  color: "var(--uff-text)",
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  padding: "0 12px",
  outline: "none",
};
