"use client";

// Player scouting side sheet (Build 8.7 Phase 3) — the depth behind a §3
// report card. Opens as a right drawer (no accordion layout-thrash across the
// grid); all data is pre-loaded on the card, so opening never fetches.
//
// Read: header (muted avatar + positions + overall grade), position-relevant
// group pills, corroborating tags, per-skill profile, per-drill trend, and the
// observations feed. Write (canManage only): add an observation, and correct a
// fat-fingered benchmark value — the two desk-work edits awkward on a phone.
//
// Reuses the roster page's PlayerHistory + PlayerSkillProfileCard + the shared
// ObservationsFeed + the §3 atoms, so nothing here is a second implementation.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PlayerHistory from "@/app/(workspace)/dashboard/team/[teamId]/roster/[playerId]/PlayerHistory";
import PlayerSkillProfileCard from "@/components/dashboard/widgets/PlayerSkillProfileCard";
import ObservationsFeed from "@/components/dashboard/ObservationsFeed";
import { Avatar, GradeBadge, GroupPill, PosBadge, RelativeStandingLine } from "./ScoutingSections";
import { gradeLabel } from "@/lib/dashboard/heat-scale";
import {
  addPlayerNote,
  correctBenchmarkResult,
} from "@/app/(workspace)/dashboard/team/[teamId]/benchmarks/actions";
import type {
  PlayerReportCard,
  EditableResult,
} from "@/lib/dashboard/team-scouting-data";
import { planFromScoutingHref } from "@/lib/dashboard/team-scouting-data";

export default function PlayerScoutSheet({
  card,
  teamId,
  canManage,
  onClose,
}: {
  card: PlayerReportCard | null;
  teamId: string;
  canManage: boolean;
  onClose: () => void;
}) {
  // Close on Escape.
  useEffect(() => {
    if (!card) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [card, onClose]);

  if (!card) return null;

  const assessed = card.benchmarkCount > 0 && card.overallGrade != null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} scouting detail`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 60,
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        className="scout-sheet"
        style={{
          width: "100%",
          maxWidth: 520,
          height: "100%",
          overflowY: "auto",
          background: "var(--uff-bg-0, #0B0F14)",
          borderLeft: "1px solid var(--uff-line)",
          boxShadow: "-24px 0 64px rgba(0,0,0,0.5)",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <Avatar color={card.color} initials={card.initials} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--uff-text)" }}>
              {card.name}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
              {card.positions.length ? (
                card.positions.map((p, i) => (
                  <PosBadge key={p} pos={i === 0 ? `${p}★` : p} />
                ))
              ) : (
                <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>
                  no position
                </span>
              )}
              {card.roomLabel && (
                <span style={{ fontSize: 11, color: "var(--uff-text-mute)", alignSelf: "center" }}>
                  · {card.roomLabel}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <GradeBadge grade={assessed ? card.overallGrade : null} size={38} />
            <div style={{ fontSize: 9.5, color: "var(--uff-text-mute)", marginTop: 4 }}>
              {assessed && card.overallGrade ? gradeLabel(card.overallGrade) : "No data"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="wbtn"
            style={{ height: 32, width: 32, padding: 0, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Role-relative standing (§3) — "are they OUR problem at this position?"
            sits right under the absolute grade. Suppressed when the room is too
            thin to rank honestly (loader passes null). */}
        {assessed && card.relativeStanding && (
          <RelativeStandingLine standing={card.relativeStanding} />
        )}

        {/* Verdict header — the volume-aware "so what" (§12.2a). Leads the
            sheet so a coach gets the conclusion before the supporting detail. */}
        <VerdictHeader card={card} teamId={teamId} canManage={canManage} />

        {/* Position-relevant group grades */}
        {assessed && card.groupScores.length > 0 && (
          <div>
            <SheetLabel>Position skill groups</SheetLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {card.groupScores.map((g) => (
                <GroupPill key={g.group} g={g} />
              ))}
            </div>
          </div>
        )}

        {/* Corroborating tags — the qual that backs the numbers. Sized by
            count: the loudest, most-repeated signal reads loudest; one-off tags
            recede instead of competing as equals. */}
        {card.recentTags.length > 0 && <MostTagged tags={card.recentTags} />}

        {/* Per-skill profile (reused) */}
        <PlayerSkillProfileCard skills={card.skillProfile} playerName={card.name} />

        {/* Per-drill trend (reused) */}
        <PlayerHistory drills={card.historyDrills} locked={card.historyLocked} />

        {/* Recent results — inline correct (canManage) */}
        {canManage && card.editableResults.length > 0 && (
          <div className="w-card" style={{ padding: 14 }}>
            <SheetLabel>Recent results · correct a value</SheetLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {card.editableResults.map((r) => (
                <CorrectResultRow
                  key={r.id}
                  result={r}
                  teamId={teamId}
                  playerId={card.playerId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Observations (reused) + add-note footer (canManage) */}
        <ObservationsFeed
          rows={card.observations}
          practiceBase={`/dashboard/team/${teamId}/practice`}
          footer={
            canManage ? (
              <AddNoteForm teamId={teamId} playerId={card.playerId} />
            ) : undefined
          }
        />
      </div>

      <style>{`
        @media (max-width: 560px) {
          .scout-sheet { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}

// Verdict header — one synthesized claim at the top of the sheet. Volume-aware:
// at low data it's an honest "what you measured" read; with reliable data it's a
// gap verdict with a planner CTA. The left accent + role chip give it answer-card
// weight without competing with the player header above.
function VerdictHeader({
  card,
  teamId,
  canManage,
}: {
  card: PlayerReportCard;
  teamId: string;
  canManage: boolean;
}) {
  const v = card.verdict;
  const isVerdict = v.dataState === "verdict";
  const href = planFromScoutingHref(teamId, v.gapSkillId);
  // Role chip tint: a real verdict earns accent weight; early reads stay muted.
  const chipColor = isVerdict ? "var(--accent)" : "var(--uff-text-mute)";

  return (
    <div
      className="w-card"
      style={{
        padding: 14,
        borderLeft: `3px solid ${isVerdict ? "var(--accent)" : "var(--uff-line)"}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <span
        style={{
          alignSelf: "flex-start",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: chipColor,
          border: `1px solid ${isVerdict ? "var(--accent)" : "var(--uff-line-soft)"}`,
          borderRadius: 5,
          padding: "2px 7px",
        }}
      >
        {v.roleRead}
      </span>
      <div style={{ fontSize: 14, lineHeight: 1.45, color: "var(--uff-text)" }}>
        {v.headline}
      </div>
      {canManage && (v.dataState !== "none") && (
        <div>
          <Link href={href} className="wbtn" style={{ marginTop: 2 }}>
            {v.ctaLabel} →
          </Link>
        </div>
      )}
    </div>
  );
}

// Most-tagged, sized by frequency. The count IS the signal — N independent
// tags of "needs reps" is the defensible evidence behind a low number — so the
// loudest tag gets the most ink and one-offs recede.
function MostTagged({ tags }: { tags: { tag: string; count: number }[] }) {
  const max = Math.max(...tags.map((t) => t.count), 1);
  return (
    <div>
      <SheetLabel>Most-tagged</SheetLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "baseline" }}>
        {tags.map((t) => {
          const p = t.count / max; // 0..1 prominence
          const loud = p >= 0.5;
          return (
            <span
              key={t.tag}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: loud ? "4px 11px" : "3px 9px",
                borderRadius: 999,
                fontSize: 11 + p * 3, // 11 → 14
                fontWeight: loud ? 600 : 400,
                background: loud ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.035)",
                border: "1px solid var(--uff-line-soft)",
                color: loud ? "var(--uff-text)" : "var(--uff-text-mute)",
                opacity: 0.55 + p * 0.45,
              }}
            >
              {t.tag}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  color: loud ? "var(--uff-text-dim)" : "var(--uff-text-mute)",
                }}
              >
                {t.count}×
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SheetLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--uff-text-mute)",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

/* ── add-note write path ── */

function AddNoteForm({ teamId, playerId }: { teamId: string; playerId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await addPlayerNote({ teamId, playerId, noteText: trimmed });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add an observation…"
        rows={2}
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
      {error && (
        <span style={{ fontSize: 12, color: "var(--uff-red, #ff4d4d)" }}>{error}</span>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !text.trim()}
          className="wbtn primary"
          style={{ opacity: pending || !text.trim() ? 0.6 : 1 }}
        >
          {pending ? "Saving…" : "Add note"}
        </button>
      </div>
    </div>
  );
}

/* ── correct-result write path ── */

function CorrectResultRow({
  result,
  teamId,
  playerId,
}: {
  result: EditableResult;
  teamId: string;
  playerId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Local edit state, seeded from the row's current values.
  const [time, setTime] = useState(result.timeSeconds?.toString() ?? "");
  const [rating, setRating] = useState<number | null>(result.rating ?? null);
  const [count, setCount] = useState(result.madeCount?.toString() ?? "");
  const [made, setMade] = useState(result.madeCount?.toString() ?? "");
  const [attempts, setAttempts] = useState(result.attemptsCount?.toString() ?? "");

  const type = result.benchmarkType;
  const dateLabel = new Date(result.date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });

  function save() {
    setError(null);
    const patch: Parameters<typeof correctBenchmarkResult>[0] = {
      teamId,
      playerId,
      resultId: result.id,
    };
    if (type === "timed") {
      const v = Number(time);
      if (!time.trim() || !Number.isFinite(v) || v < 0)
        return setError("Enter a valid time");
      patch.timeSeconds = v;
    } else if (type === "rated") {
      if (!rating) return setError("Pick a rating");
      patch.rating = rating;
    } else if (type === "pct") {
      const m = Number(made);
      const a = Number(attempts);
      if (!made.trim() || !attempts.trim() || !Number.isFinite(m) || !Number.isFinite(a) || m < 0 || a <= 0 || m > a)
        return setError("Made ≤ attempts, attempts > 0");
      patch.madeCount = Math.floor(m);
      patch.attemptsCount = Math.floor(a);
    } else {
      // reps / flags / drops / legacy → single count in made_count
      const v = Number(count);
      if (!count.trim() || !Number.isFinite(v) || v < 0)
        return setError("Enter a valid number");
      patch.madeCount = Math.floor(v);
    }

    startTransition(async () => {
      const res = await correctBenchmarkResult(patch);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div
      style={{
        padding: "8px 10px",
        background: "var(--uff-bg-1)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--uff-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {result.drillName}
          {type && (
            <span style={{ fontSize: 10, color: "var(--uff-text-mute)", marginLeft: 6, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
              {type}
            </span>
          )}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--uff-text-dim)" }}>
          {result.label}
          {result.unit}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--uff-text-mute)" }}>
          {dateLabel}
        </span>
        <button
          type="button"
          onClick={() => {
            setEditing((v) => !v);
            setError(null);
          }}
          className="wbtn"
          style={{ height: 26, fontSize: 11.5, padding: "0 8px" }}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {editing && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {type === "rated" ? (
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRating(r)}
                  aria-pressed={rating === r}
                  className="wbtn"
                  style={{
                    height: 32,
                    width: 32,
                    padding: 0,
                    background: rating === r ? "var(--uff-orange)" : undefined,
                    color: rating === r ? "#0b0b0d" : undefined,
                    borderColor: rating === r ? "transparent" : undefined,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          ) : type === "pct" ? (
            <>
              <CorrectInput value={made} onChange={setMade} placeholder="Made" />
              <span style={{ color: "var(--uff-text-mute)" }}>/</span>
              <CorrectInput value={attempts} onChange={setAttempts} placeholder="Att" />
            </>
          ) : type === "timed" ? (
            <CorrectInput value={time} onChange={setTime} placeholder="Seconds" step="0.01" />
          ) : (
            <CorrectInput value={count} onChange={setCount} placeholder="Count" />
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="wbtn primary"
            style={{ height: 32, opacity: pending ? 0.6 : 1 }}
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {error && (
            <span style={{ fontSize: 11.5, color: "var(--uff-red, #ff4d4d)", width: "100%" }}>
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CorrectInput({
  value,
  onChange,
  placeholder,
  step = "1",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step={step}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 84,
        background: "var(--uff-bg-2)",
        border: "1px solid var(--uff-line)",
        borderRadius: 6,
        color: "var(--uff-text)",
        fontSize: 13,
        padding: "6px 8px",
        outline: "none",
        textAlign: "center",
        fontFamily: "var(--font-mono)",
      }}
    />
  );
}
