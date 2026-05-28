"use client";

// Post-practice log form (Build 6.5a). Four numbered sections matching
// the mobile 2026-05-19 rebuild:
//   01 Drills — toggle done/skipped per drill + per-drill log_note
//   02 Observations — pick a player, write a note; multiple per save
//   03 Notes — team performance / highlights / areas to improve
//   04 Wrap-up — attendance count + energy level
//
// On submit we call savePracticeLog which writes practice_logs +
// player_notes (replace by plan) + per-drill log_note patches, then
// transitions the plan to status='completed'.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  savePracticeLog,
  type SaveLogDrill,
  type SaveLogObservation,
} from "@/lib/practice/log-actions";

export type LogPlayer = {
  id: string;
  name: string;
  position: string | null;
  initials: string;
  color: string;
  isInjured?: boolean;
};

export type LogDrill = {
  planDrillId: string;
  drillName: string;
  blockName: string;
  blockAccent: string;
  existingLogNote: string | null;
};

export type LogObservation = {
  player_id: string;
  note_text: string;
};

export type LogInitial = {
  drills: { planDrillId: string; completed: boolean; skipped: boolean; logNote: string }[];
  observations: LogObservation[];
  teamPerformanceNotes: string;
  highlights: string;
  areasToImprove: string;
  attendanceCount: number | null;
  energyLevel: number | null;
  alreadyLogged: boolean;
};

type Props = {
  planId: string;
  teamId: string;
  planTitle: string;
  dateLabel: string;
  drills: LogDrill[];
  roster: LogPlayer[];
  initial: LogInitial;
};

type DrillState = {
  planDrillId: string;
  completed: boolean;
  skipped: boolean;
  logNote: string;
};

export default function PostPracticeLogClient({
  planId,
  teamId,
  planTitle,
  dateLabel,
  drills,
  roster,
  initial,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ── Section 1: drills ──────────────────────────────────────────────
  const [drillStates, setDrillStates] = useState<DrillState[]>(initial.drills);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  function toggleDone(planDrillId: string) {
    setDrillStates((prev) =>
      prev.map((d) =>
        d.planDrillId === planDrillId
          ? d.completed
            ? { ...d, completed: false }
            : { ...d, completed: true, skipped: false }
          : d,
      ),
    );
  }
  function toggleSkipped(planDrillId: string) {
    setDrillStates((prev) =>
      prev.map((d) =>
        d.planDrillId === planDrillId
          ? d.skipped
            ? { ...d, skipped: false }
            : { ...d, skipped: true, completed: false }
          : d,
      ),
    );
  }
  function setNote(planDrillId: string, value: string) {
    setDrillStates((prev) =>
      prev.map((d) => (d.planDrillId === planDrillId ? { ...d, logNote: value } : d)),
    );
  }

  // ── Section 2: observations ────────────────────────────────────────
  // Each row is a free-form (player_id, note_text) pair. We keep one
  // pending input at the top + the list of saved-on-this-form observations
  // below. Re-edits load all prior into rows directly.
  const [observations, setObservations] = useState<LogObservation[]>(initial.observations);
  const [newObsPlayer, setNewObsPlayer] = useState<string>("");
  const [newObsText, setNewObsText] = useState<string>("");

  function addObservation() {
    const txt = newObsText.trim();
    if (!newObsPlayer || !txt) return;
    setObservations((prev) => [
      ...prev,
      { player_id: newObsPlayer, note_text: txt },
    ]);
    setNewObsPlayer("");
    setNewObsText("");
  }
  function removeObservation(idx: number) {
    setObservations((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Section 3: team notes ──────────────────────────────────────────
  const [teamNotes, setTeamNotes] = useState(initial.teamPerformanceNotes);
  const [highlights, setHighlights] = useState(initial.highlights);
  const [areasToImprove, setAreasToImprove] = useState(initial.areasToImprove);

  // ── Section 4: wrap-up ─────────────────────────────────────────────
  const [attendanceCount, setAttendanceCount] = useState<string>(
    initial.attendanceCount != null ? String(initial.attendanceCount) : "",
  );
  const [energyLevel, setEnergyLevel] = useState<number | null>(initial.energyLevel);

  // ── Submit ─────────────────────────────────────────────────────────
  function handleSubmit() {
    setError(null);
    const drillsPayload: SaveLogDrill[] = drillStates.map((d) => ({
      plan_drill_id: d.planDrillId,
      completed: d.completed,
      skipped: d.skipped,
      log_note: d.logNote.trim() ? d.logNote.trim() : null,
    }));
    const obsPayload: SaveLogObservation[] = observations
      .map((o) => ({ player_id: o.player_id, note_text: o.note_text.trim() }))
      .filter((o) => o.note_text.length > 0);
    const attendanceParsed =
      attendanceCount.trim() === "" ? null : Number(attendanceCount.trim());
    if (
      attendanceParsed != null &&
      (!Number.isFinite(attendanceParsed) || attendanceParsed < 0)
    ) {
      setError("Attendance must be a non-negative number.");
      return;
    }

    startTransition(async () => {
      const result = await savePracticeLog({
        plan_id: planId,
        team_id: teamId,
        drills: drillsPayload,
        observations: obsPayload,
        team_performance_notes: teamNotes.trim() || null,
        highlights: highlights.trim() || null,
        areas_to_improve: areasToImprove.trim() || null,
        attendance_count: attendanceParsed,
        energy_level: energyLevel,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/practice/${planId}`);
      router.refresh();
    });
  }

  // ── Render ─────────────────────────────────────────────────────────
  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const submitLabel = initial.alreadyLogged ? "Save changes" : "Save & complete";

  return (
    <div className="page" style={{ maxWidth: 1120, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Header card */}
          <div className="w-card hero" style={{ padding: "22px 24px" }}>
            <div
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: 10.5,
                color: "var(--uff-lime, #c2ff3d)",
                letterSpacing: ".06em",
                marginBottom: 6,
              }}
            >
              POST-PRACTICE LOG · {dateLabel.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--uff-text)",
              }}
            >
              {planTitle || "Untitled practice"}
            </div>
            <p
              style={{
                marginTop: 8,
                fontSize: 14,
                color: "var(--uff-text)",
                opacity: 0.85,
                lineHeight: 1.5,
              }}
            >
              Capture what actually happened. Saving marks this practice
              as completed.
            </p>
          </div>

          {/* Section 01 — Drills */}
          <SectionCard num="01" title="Drills" subtitle="Mark each drill done or skipped. Add a quick note if something stood out.">
            {drills.length === 0 ? (
              <Empty text="This plan has no drills." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {drills.map((d) => {
                  const state = drillStates.find((s) => s.planDrillId === d.planDrillId);
                  if (!state) return null;
                  const isOpen = expandedNote === d.planDrillId;
                  const hasNote = state.logNote.trim().length > 0;
                  return (
                    <div
                      key={d.planDrillId}
                      style={{
                        border: "1px solid var(--uff-line)",
                        borderRadius: 12,
                        padding: 12,
                        background: "var(--uff-bg-1)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span
                          style={{
                            width: 6,
                            height: 28,
                            borderRadius: 3,
                            background: d.blockAccent,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "var(--uff-text)",
                              lineHeight: 1.3,
                            }}
                          >
                            {d.drillName}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--uff-text-mute)",
                              letterSpacing: ".04em",
                              marginTop: 2,
                            }}
                          >
                            {d.blockName.toUpperCase()}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Toggle
                            label="Done"
                            on={state.completed}
                            onClick={() => toggleDone(d.planDrillId)}
                            accent="var(--uff-lime, #c2ff3d)"
                          />
                          <Toggle
                            label="Skipped"
                            on={state.skipped}
                            onClick={() => toggleSkipped(d.planDrillId)}
                            accent="var(--uff-red, #ff4d4d)"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedNote(isOpen ? null : d.planDrillId)
                          }
                          aria-expanded={isOpen}
                          aria-label={hasNote ? "Edit note" : "Add note"}
                          style={{
                            background: "transparent",
                            border: "1px solid var(--uff-line)",
                            borderRadius: 8,
                            padding: "6px 10px",
                            fontSize: 11.5,
                            color: hasNote
                              ? "var(--uff-orange)"
                              : "var(--uff-text-mute)",
                            cursor: "pointer",
                          }}
                        >
                          {hasNote ? "✎ note" : "+ note"}
                        </button>
                      </div>
                      {isOpen && (
                        <textarea
                          value={state.logNote}
                          onChange={(e) => setNote(d.planDrillId, e.target.value)}
                          placeholder="What happened on this drill?"
                          rows={3}
                          style={{
                            marginTop: 10,
                            width: "100%",
                            background: "var(--uff-bg-2)",
                            border: "1px solid var(--uff-line)",
                            borderRadius: 8,
                            color: "var(--uff-text)",
                            fontSize: 13,
                            padding: 10,
                            outline: "none",
                            resize: "vertical",
                            fontFamily: "inherit",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Section 02 — Observations */}
          <SectionCard
            num="02"
            title="Observations"
            subtitle="Per-player notes that show up on the player's profile."
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 200px) minmax(0, 1fr) auto",
                gap: 8,
                alignItems: "stretch",
              }}
            >
              <select
                value={newObsPlayer}
                onChange={(e) => setNewObsPlayer(e.target.value)}
                aria-label="Pick a player"
                style={selectStyle}
              >
                <option value="">Pick a player…</option>
                {roster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.position ? ` · ${p.position}` : ""}
                    {p.isInjured ? " · injured" : ""}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newObsText}
                onChange={(e) => setNewObsText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addObservation();
                  }
                }}
                placeholder="What did you observe?"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={addObservation}
                disabled={!newObsPlayer || !newObsText.trim()}
                className="wbtn primary"
                style={{
                  opacity: !newObsPlayer || !newObsText.trim() ? 0.5 : 1,
                  cursor: !newObsPlayer || !newObsText.trim() ? "not-allowed" : "pointer",
                }}
              >
                + Add
              </button>
            </div>

            {observations.length > 0 && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {observations.map((o, i) => {
                  const p = rosterById.get(o.player_id);
                  return (
                    <div
                      key={`${o.player_id}-${i}`}
                      style={{
                        display: "flex",
                        gap: 12,
                        padding: 10,
                        border: "1px solid var(--uff-line)",
                        borderRadius: 10,
                        background: "var(--uff-bg-1)",
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          background: p?.color ?? "var(--uff-line)",
                          color: "#0b0b0d",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {p?.initials ?? "?"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: "var(--uff-text)",
                            fontWeight: 600,
                          }}
                        >
                          {p?.name ?? "Unknown player"}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--uff-text-dim)",
                            marginTop: 2,
                            lineHeight: 1.4,
                          }}
                        >
                          {o.note_text}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeObservation(i)}
                        aria-label="Remove observation"
                        style={{
                          background: "transparent",
                          border: "1px solid var(--uff-line)",
                          color: "var(--uff-text-mute)",
                          borderRadius: 8,
                          padding: "4px 10px",
                          fontSize: 11.5,
                          cursor: "pointer",
                          alignSelf: "flex-start",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Section 03 — Notes */}
          <SectionCard
            num="03"
            title="Notes"
            subtitle="Captain's read on how the practice went overall."
          >
            <FieldArea
              label="Team performance"
              placeholder="How did the team look as a unit?"
              value={teamNotes}
              onChange={setTeamNotes}
            />
            <FieldArea
              label="Highlights"
              placeholder="Plays, drills, players that stood out."
              value={highlights}
              onChange={setHighlights}
            />
            <FieldArea
              label="Areas to improve"
              placeholder="What needs work next practice?"
              value={areasToImprove}
              onChange={setAreasToImprove}
            />
          </SectionCard>

          {/* Section 04 — Wrap-up */}
          <SectionCard
            num="04"
            title="Wrap-up"
            subtitle="Quick stats for the dashboard."
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 200px) minmax(0, 1fr)",
                gap: 16,
                alignItems: "start",
              }}
            >
              <div>
                <FieldLabel>Attendance</FieldLabel>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={attendanceCount}
                  onChange={(e) => setAttendanceCount(e.target.value)}
                  placeholder="0"
                  style={{ ...inputStyle, textAlign: "center", fontSize: 18, fontWeight: 600 }}
                />
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "var(--uff-text-mute)",
                  }}
                >
                  Roster: {roster.length}
                </p>
              </div>
              <div>
                <FieldLabel>Team energy</FieldLabel>
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                    const on = energyLevel != null && n <= energyLevel;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setEnergyLevel(energyLevel === n ? null : n)
                        }
                        aria-pressed={on}
                        style={{
                          flex: 1,
                          height: 36,
                          borderRadius: 8,
                          border: "1px solid var(--uff-line)",
                          background: on
                            ? "var(--uff-orange)"
                            : "var(--uff-bg-2)",
                          color: on ? "#0b0b0d" : "var(--uff-text-mute)",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "var(--uff-text-mute)",
                  }}
                >
                  {energyLevel == null
                    ? "Tap a number to rate the room."
                    : energyLevel <= 3
                      ? "Flat"
                      : energyLevel <= 6
                        ? "Steady"
                        : energyLevel <= 8
                          ? "Sharp"
                          : "Locked in"}
                </p>
              </div>
            </div>
          </SectionCard>

          {error && (
            <div
              style={{
                padding: "12px 14px",
                border: "1px solid var(--uff-red, #ff4d4d)",
                borderRadius: 10,
                background: "rgba(255,77,77,0.06)",
                color: "var(--uff-red, #ff4d4d)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => router.push(`/practice/${planId}`)}
              className="wbtn"
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="wbtn primary"
              disabled={pending}
              style={{ opacity: pending ? 0.6 : 1 }}
            >
              {pending ? "Saving…" : submitLabel}
            </button>
          </div>
        </div>

        {/* Side rail — quick summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 80 }}>
          <SideSummary
            drillStates={drillStates}
            observations={observations}
            attendanceCount={attendanceCount}
            energyLevel={energyLevel}
            alreadyLogged={initial.alreadyLogged}
          />
        </div>
      </div>
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────

function SectionCard({
  num,
  title,
  subtitle,
  children,
}: {
  num: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-card" style={{ padding: 20 }}>
      <div className="sect-head" style={{ marginBottom: 14 }}>
        <div className="title">
          <span
            className="mono"
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 11,
              color: "var(--uff-lime, #c2ff3d)",
              letterSpacing: ".08em",
              marginRight: 8,
            }}
          >
            {num}
          </span>
          {title}
        </div>
        {subtitle && (
          <div
            className="meta"
            style={{
              textTransform: "none",
              fontFamily: "inherit",
              letterSpacing: 0,
              color: "var(--uff-text)",
              opacity: 0.78,
              fontSize: 12.5,
              maxWidth: 360,
              textAlign: "right",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  on,
  onClick,
  accent,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        border: on ? `1px solid ${accent}` : "1px solid var(--uff-line)",
        background: on ? accent : "transparent",
        color: on ? "#0b0b0d" : "var(--uff-text-mute)",
        cursor: "pointer",
        minWidth: 64,
      }}
    >
      {label}
    </button>
  );
}

function FieldArea({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div style={{ marginTop: 10, marginBottom: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: "100%",
          background: "var(--uff-bg-2)",
          border: "1px solid var(--uff-line)",
          borderRadius: 8,
          color: "var(--uff-text)",
          fontSize: 13,
          padding: 10,
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 10.5,
        color: "var(--uff-text-mute)",
        letterSpacing: ".08em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {children}
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "28px 24px",
        border: "1px dashed var(--uff-line)",
        borderRadius: 12,
        color: "var(--uff-text-mute)",
        fontSize: 13,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

function SideSummary({
  drillStates,
  observations,
  attendanceCount,
  energyLevel,
  alreadyLogged,
}: {
  drillStates: DrillState[];
  observations: LogObservation[];
  attendanceCount: string;
  energyLevel: number | null;
  alreadyLogged: boolean;
}) {
  const done = drillStates.filter((d) => d.completed).length;
  const skipped = drillStates.filter((d) => d.skipped).length;
  const unmarked = drillStates.length - done - skipped;
  return (
    <div className="w-card subdued" style={{ padding: 16 }}>
      <div className="sect-head" style={{ marginBottom: 12 }}>
        <div className="title">
          <span className="tk" />
          {alreadyLogged ? "Editing log" : "At a glance"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <StatRow label="Drills done" value={String(done)} />
        <StatRow label="Skipped" value={String(skipped)} />
        {unmarked > 0 && (
          <StatRow label="Unmarked" value={String(unmarked)} dim />
        )}
        <StatRow label="Observations" value={String(observations.length)} />
        <StatRow label="Attendance" value={attendanceCount || "—"} />
        <StatRow
          label="Energy"
          value={energyLevel != null ? `${energyLevel}/10` : "—"}
        />
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  dim,
}: {
  label: string;
  value: string;
  dim?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "6px 0",
        borderBottom: "1px solid var(--uff-line-soft, rgba(255,255,255,0.04))",
      }}
    >
      <span
        style={{
          fontSize: 11.5,
          color: "var(--uff-text-mute)",
          letterSpacing: ".04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 14,
          fontWeight: 600,
          color: dim ? "var(--uff-text-mute)" : "var(--uff-text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--uff-bg-2)",
  border: "1px solid var(--uff-line)",
  borderRadius: 8,
  color: "var(--uff-text)",
  fontSize: 13,
  padding: "10px 12px",
  outline: "none",
  fontFamily: "inherit",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};
