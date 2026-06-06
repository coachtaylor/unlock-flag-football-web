"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  type AssignableCoach,
  coachAssignmentColumns,
  selectedCoachKey,
} from "@/lib/team/assignable-coaches";
import { assignDrillCoach } from "@/lib/practice/actions";

// Per-drill "who leads this" control. Two exports share one presentational
// picker (DRY):
//   • CoachPicker          — controlled chip + popover. Reports the chosen
//                            member id via onChange. No persistence.
//   • DrillCoachControl    — wraps CoachPicker with the assignDrillCoach
//                            server action for the review screen (instant save).
// The plan editor uses CoachPicker directly and saves with the rest of the form.

function Avatar({ coach, size = 18 }: { coach: AssignableCoach; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: coach.color,
        color: "#0A0A0D",
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: size * 0.42,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {coach.initials}
    </span>
  );
}

export function CoachPicker({
  value,
  coaches,
  canManage,
  onChange,
  pending,
}: {
  // Selection key (`${kind}:${id}`) of the currently-assigned coach, or null.
  value: string | null;
  coaches: AssignableCoach[];
  canManage: boolean;
  onChange: (coach: AssignableCoach | null) => void;
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const coach = value ? coaches.find((c) => c.key === value) ?? null : null;

  // View-only + unassigned → render nothing (no clutter).
  if (!canManage && !coach) return null;

  const choose = (c: AssignableCoach | null) => {
    setOpen(false);
    onChange(c);
  };

  const staff = coaches.filter((c) => c.kind !== "captain");
  const captains = coaches.filter((c) => c.kind === "captain");

  const chip = coach ? (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px 3px 3px",
        borderRadius: 999,
        background: `color-mix(in srgb, ${coach.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${coach.color} 30%, transparent)`,
        fontSize: 11.5,
        fontWeight: 600,
        color: "var(--uff-text-dim)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <Avatar coach={coach} />
      {coach.name}
      {canManage && <CaretDown />}
    </span>
  ) : (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 999,
        border: "1px dashed var(--uff-line)",
        fontSize: 11.5,
        fontWeight: 600,
        color: "var(--uff-text-mute)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <PersonAdd />
      Assign coach
    </span>
  );

  if (!canManage) {
    return <div style={{ marginTop: 6 }}>{chip}</div>;
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", marginTop: 6, width: "fit-content" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        {chip}
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 30,
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: 220,
            maxHeight: 280,
            overflowY: "auto",
            background: "var(--uff-surface-raised, #1E2530)",
            border: "1px solid var(--uff-line)",
            borderRadius: 10,
            padding: 6,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          }}
        >
          <PickRow label="Unassigned" selected={value == null} onClick={() => choose(null)} dashed />
          {staff.length > 0 && <GroupLabel>Coaching staff</GroupLabel>}
          {staff.map((c) => (
            <PickRow
              key={c.key}
              label={c.name}
              sub={c.roleLabel}
              coach={c}
              selected={value === c.key}
              onClick={() => choose(c)}
            />
          ))}
          {captains.length > 0 && <GroupLabel>Captains</GroupLabel>}
          {captains.map((c) => (
            <PickRow
              key={c.key}
              label={c.name}
              sub={c.roleLabel}
              coach={c}
              selected={value === c.key}
              onClick={() => choose(c)}
            />
          ))}
          {coaches.length === 0 && (
            <div style={{ padding: "10px 8px", fontSize: 12, color: "var(--uff-text-mute)" }}>
              No coaches or captains on this team yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DrillCoachControl({
  planId,
  teamId,
  drillRowId,
  assignedMemberId,
  assignedPlayerId,
  coaches,
  canManage,
}: {
  planId: string;
  teamId: string;
  drillRowId: string;
  assignedMemberId: string | null;
  assignedPlayerId: string | null;
  coaches: AssignableCoach[];
  canManage: boolean;
}) {
  const serverKey = selectedCoachKey(assignedMemberId, assignedPlayerId);
  const [selected, setSelected] = useState<string | null>(serverKey);
  // When the server value changes (after revalidation), adopt it. Adjusting
  // state during render is the React-blessed way to reset on prop change —
  // no effect, no cascading render.
  const [prevKey, setPrevKey] = useState(serverKey);
  if (serverKey !== prevKey) {
    setPrevKey(serverKey);
    setSelected(serverKey);
  }
  const [pending, startTransition] = useTransition();

  const onChange = (coach: AssignableCoach | null) => {
    setSelected(coach?.key ?? null);
    const cols = coachAssignmentColumns(coach);
    startTransition(async () => {
      await assignDrillCoach(
        planId,
        drillRowId,
        cols.assigned_member_id,
        cols.assigned_player_id,
        teamId,
      );
    });
  };

  return (
    <CoachPicker
      value={selected}
      coaches={coaches}
      canManage={canManage}
      onChange={onChange}
      pending={pending}
    />
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "var(--uff-text-mute)",
        padding: "8px 8px 4px",
      }}
    >
      {children}
    </div>
  );
}

function PickRow({
  label,
  sub,
  coach,
  selected,
  onClick,
  dashed,
}: {
  label: string;
  sub?: string;
  coach?: AssignableCoach;
  selected: boolean;
  onClick: () => void;
  dashed?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px",
        borderRadius: 8,
        border: "none",
        background: selected ? "rgba(212,138,48,0.10)" : "transparent",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {coach ? (
        <Avatar coach={coach} size={26} />
      ) : (
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            border: dashed ? "1px dashed var(--uff-line)" : "1px solid var(--uff-line)",
            display: "grid",
            placeItems: "center",
            color: "var(--uff-text-mute)",
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          –
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--uff-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        {sub && (
          <span style={{ display: "block", fontSize: 11, color: "var(--uff-text-mute)" }}>{sub}</span>
        )}
      </span>
      {selected && (
        <span style={{ color: "var(--uff-orange)", display: "flex" }}>
          <Check />
        </span>
      )}
    </button>
  );
}

function CaretDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonAdd() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 8v6M15 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
