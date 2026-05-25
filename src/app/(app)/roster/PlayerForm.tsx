"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const POSITION_OPTIONS = [
  "QB",
  "WR",
  "RB",
  "C",
  "CB",
  "S",
  "LB",
  "DE",
  "Rusher",
];

export type PlayerFormInitial = {
  id: string;
  playerName: string;
  positions: string[];
  jerseyNumber: string;
  notes: string;
};

type Props = {
  teamId: string;
  initial?: PlayerFormInitial;
};

export default function PlayerForm({ teamId, initial }: Props) {
  const router = useRouter();
  const isEditing = !!initial;

  const [playerName, setPlayerName] = useState(initial?.playerName ?? "");
  const [positions, setPositions] = useState<string[]>(
    initial?.positions ?? []
  );
  const [jerseyNumber, setJerseyNumber] = useState(
    initial?.jerseyNumber ?? ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function togglePosition(pos: string) {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!playerName.trim()) {
      setError("Player name is required.");
      return;
    }
    setSubmitting(true);

    const payload = {
      team_id: teamId,
      player_name: playerName.trim(),
      positions,
      jersey_number: jerseyNumber.trim() || null,
      notes: notes.trim() || null,
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
      router.push(`/roster/${initial.id}`);
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
      router.push("/roster");
      router.refresh();
    }
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--color-surface-base)",
    border: "1px solid var(--color-border-default)",
    color: "var(--color-text-primary)",
  };

  const pillStyle = (selected: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    minHeight: "44px",
    backgroundColor: selected ? "#5C3308" : "rgba(255,255,255,0.04)",
    color: selected ? "#F0B870" : "rgba(255,255,255,0.45)",
    border: selected ? "1px solid #D48A30" : "1px solid rgba(255,255,255,0.08)",
  });

  return (
    <div className="pt-3xl pb-2xl">
      <Link
        href={isEditing && initial ? `/roster/${initial.id}` : "/roster"}
        className="text-caption no-underline"
        style={{ color: "var(--color-text-secondary)" }}
      >
        ← Back
      </Link>

      <h1
        className="text-title font-medium mt-md"
        style={{ color: "var(--color-text-primary)" }}
      >
        {isEditing ? "Edit player" : "Add a player"}
      </h1>

      <form className="flex flex-col gap-xl mt-2xl" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-xs">
          <label
            htmlFor="playerName"
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Player name
          </label>
          <input
            id="playerName"
            type="text"
            required
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="e.g., Jordan Reyes"
            className="w-full rounded-md px-md text-body outline-none transition-colors"
            style={{ height: "44px", ...inputStyle }}
          />
        </div>

        <div className="flex flex-col gap-xs">
          <span
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Positions
          </span>
          <div className="flex gap-sm flex-wrap">
            {POSITION_OPTIONS.map((pos) => {
              const selected = positions.includes(pos);
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => togglePosition(pos)}
                  aria-pressed={selected}
                  className="rounded-pill text-caption font-medium transition-all"
                  style={pillStyle(selected)}
                >
                  {pos}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-xs">
          <label
            htmlFor="jerseyNumber"
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Jersey number
          </label>
          <input
            id="jerseyNumber"
            type="text"
            inputMode="numeric"
            value={jerseyNumber}
            onChange={(e) => setJerseyNumber(e.target.value)}
            placeholder="12"
            className="rounded-md px-md text-body outline-none transition-colors"
            style={{ height: "44px", width: "96px", ...inputStyle }}
          />
        </div>

        <div className="flex flex-col gap-xs">
          <label
            htmlFor="notes"
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this player..."
            rows={4}
            className="w-full rounded-md px-md py-md text-body outline-none transition-colors"
            style={inputStyle}
          />
        </div>

        {error && (
          <p
            className="text-caption"
            style={{ color: "var(--color-error-light)" }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-lg rounded-xl text-body font-medium tracking-wide transition-opacity"
          style={{
            backgroundColor: "var(--color-orange-500)",
            color: "#FFFFFF",
            letterSpacing: "0.3px",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting
            ? isEditing
              ? "Saving…"
              : "Adding…"
            : isEditing
              ? "Save Changes"
              : "Add Player"}
        </button>
      </form>
    </div>
  );
}
