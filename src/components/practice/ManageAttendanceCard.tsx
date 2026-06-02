"use client";

// "Who's coming" card on the practice detail page (Build 5.5 follow-up).
// Static RSVP roll-up + a Manage button that opens an inline attendance
// sheet so coaches can update RSVPs without bouncing into the editor.
//
// The editor's attendance sheet (EditorClient.tsx) is structurally
// identical; we keep this version separate for now because the editor
// holds attendees in unsaved local state, while here every change writes
// through to Supabase via the saveAttendance server action. Refactor to
// a shared sheet once they need to evolve together.

import { useState, useTransition } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveAttendance } from "@/lib/practice/actions";
import { PIcon } from "./atoms";
import { RsvpBar } from "./atoms";

export type RsvpPlayer = {
  id: string;
  name: string;
  position: string | null;
  initials: string;
  color: string;
  isInjured?: boolean;
};

type Props = {
  planId: string;
  dateLabel: string;
  roster: RsvpPlayer[];
  initialAttendees: Record<string, boolean | null>;
  /** View-only members see the roll-up but no Manage control. */
  canManage?: boolean;
};

export default function ManageAttendanceCard({
  planId,
  dateLabel,
  roster,
  initialAttendees,
  canManage = true,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [attendees, setAttendees] = useState<Record<string, boolean | null>>(initialAttendees);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inN = Object.values(attendees).filter((v) => v === true).length;
  const outN = Object.values(attendees).filter((v) => v === false).length;
  const noRespN = roster.length - inN - outN;

  const inPlayers = roster.filter((p) => attendees[p.id] === true);
  const outPlayers = roster.filter((p) => attendees[p.id] === false);

  function commitSave() {
    setError(null);
    const rows = Object.entries(attendees)
      .filter(([, v]) => v !== null)
      .map(([player_id, rsvp]) => ({ player_id, rsvp: rsvp as boolean }));
    startTransition(async () => {
      const res = await saveAttendance(planId, rows);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="w-card" style={{ padding: 18 }}>
        <div className="sect-head" style={{ marginBottom: 14 }}>
          <div className="title">
            <span className="tk" />
            Who&rsquo;s coming
          </div>
          {canManage && (
            <button
              type="button"
              className="wbtn ghost"
              style={{ height: 28, fontSize: 11, padding: "0 10px" }}
              onClick={() => setOpen(true)}
            >
              Manage
            </button>
          )}
        </div>
        <RsvpBar i={inN} m={0} o={outN} total={roster.length} />
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <RsvpGroup label="Confirmed" count={inPlayers.length} color="var(--uff-lime)" players={inPlayers} />
          {outPlayers.length > 0 && (
            <RsvpGroup
              label="Can't make it"
              count={outPlayers.length}
              color="var(--uff-text-mute)"
              players={outPlayers}
              dim
            />
          )}
        </div>
      </div>

      {open && (
        <SheetShell width={680} onClose={() => setOpen(false)}>
          <SheetHeader
            title={`Who's coming ${dateLabel}?`}
            subtitle="Tap a status for each player."
            onClose={() => setOpen(false)}
          />
          <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
            <span
              className="mono"
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: 10.5,
                color: "var(--uff-text-mute)",
                letterSpacing: ".06em",
              }}
            >
              BULK
            </span>
            <button
              type="button"
              className="wbtn"
              style={{ height: 30, fontSize: 12 }}
              onClick={() => setAttendees(Object.fromEntries(roster.map((p) => [p.id, true])))}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 2,
                  background: "var(--uff-lime)",
                  display: "inline-block",
                  marginRight: 6,
                }}
              />
              Mark all in
            </button>
            <button
              type="button"
              className="wbtn"
              style={{ height: 30, fontSize: 12 }}
              onClick={() => setAttendees({})}
            >
              Reset
            </button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "var(--uff-text-dim)" }}>
              {roster.length} players · season roster
            </span>
          </div>
          <div style={{ padding: "12px 20px 20px", flex: 1, overflow: "auto" }}>
            <div
              style={{
                background: "var(--uff-surface-2)",
                border: "1px solid var(--uff-line-soft)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 240px",
                  gap: 10,
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--uff-line-soft)",
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: ".14em",
                  color: "var(--uff-text-mute)",
                  textTransform: "uppercase",
                }}
              >
                <span>Player</span>
                <span>Position</span>
                <span>Status</span>
              </div>
              {roster.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 80px 240px",
                    gap: 10,
                    padding: "10px 14px",
                    borderBottom: i === roster.length - 1 ? "none" : "1px solid var(--uff-line-soft)",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: p.color,
                        color: "#1a0f08",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {p.initials}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--uff-text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.name}
                    </span>
                    {p.isInjured && <InjuredTag />}
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      fontSize: 11,
                      color: "var(--uff-text-dim)",
                      letterSpacing: ".04em",
                    }}
                  >
                    {p.position ?? "—"}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      background: "rgba(255,255,255,0.025)",
                      borderRadius: 8,
                      padding: 3,
                    }}
                  >
                    <StatBtn
                      active={attendees[p.id] === true}
                      label="In"
                      color="var(--uff-lime)"
                      onClick={() => setAttendees((a) => ({ ...a, [p.id]: true }))}
                    />
                    <StatBtn
                      active={attendees[p.id] === false}
                      label="Out"
                      color="var(--uff-red)"
                      onClick={() => setAttendees((a) => ({ ...a, [p.id]: false }))}
                    />
                    <StatBtn
                      active={attendees[p.id] == null}
                      label="No reply"
                      color="rgba(255,255,255,0.4)"
                      onClick={() => setAttendees((a) => ({ ...a, [p.id]: null }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--uff-line-soft)",
              display: "flex",
              gap: 10,
              alignItems: "center",
              background: "rgba(0,0,0,0.2)",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginRight: "auto",
                fontSize: 11.5,
                color: "var(--uff-text-dim)",
              }}
            >
              <Legend color="var(--uff-lime)" label={`${inN} in`} />
              <Legend color="var(--uff-red)" label={`${outN} out`} />
              <Legend color="rgba(255,255,255,0.25)" label={`${noRespN} no reply`} dim />
            </span>
            {error && (
              <span style={{ color: "var(--uff-red)", fontSize: 12, marginRight: 8 }}>{error}</span>
            )}
            <button type="button" className="wbtn ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="wbtn primary" onClick={commitSave} disabled={isPending}>
              {isPending ? "Saving…" : "Save attendance"}
            </button>
          </div>
        </SheetShell>
      )}
    </>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────
function RsvpGroup({
  label,
  count,
  color,
  players,
  dim,
}: {
  label: string;
  count: number;
  color: string;
  players: RsvpPlayer[];
  dim?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".1em",
            color: "var(--uff-text-dim)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span
          className="mono"
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 11,
            color: "var(--uff-text-mute)",
          }}
        >
          {count}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {players.slice(0, 9).map((p) => (
          <span
            key={p.id}
            title={p.isInjured ? `${p.name} · injured` : p.name}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 7px",
              background: dim ? "transparent" : "rgba(255,255,255,0.03)",
              border: p.isInjured
                ? "1px solid rgba(255,77,77,0.40)"
                : "1px solid var(--uff-line-soft)",
              borderRadius: 999,
              opacity: dim ? 0.5 : 1,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: p.color,
                color: "#1a0f08",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 8,
                fontWeight: 800,
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                boxShadow: p.isInjured ? "0 0 0 1.5px var(--uff-red)" : "none",
              }}
            >
              {p.initials}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--uff-text-dim)" }}>{p.name.split(" ")[0]}</span>
          </span>
        ))}
        {players.length > 9 && (
          <span
            style={{
              padding: "3px 7px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--uff-line-soft)",
              fontSize: 10.5,
              color: "var(--uff-text-mute)",
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            }}
          >
            +{players.length - 9}
          </span>
        )}
      </div>
    </div>
  );
}

function SheetShell({
  children,
  width = 560,
  onClose,
}: {
  children: ReactNode;
  width?: number;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,9,11,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "60px 24px",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxHeight: "calc(100vh - 120px)",
          background: "var(--uff-surface)",
          border: "1px solid var(--uff-line)",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SheetHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--uff-line-soft)",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--uff-text-dim)", marginTop: 3 }}>{subtitle}</div>}
      </div>
      <button type="button" className="icon-btn" onClick={onClose}>
        <PIcon.close size={14} />
      </button>
    </div>
  );
}

function StatBtn({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color: string;
  onClick: () => void;
}) {
  const style: CSSProperties = {
    flex: 1,
    height: 28,
    border: 0,
    padding: "0 10px",
    borderRadius: 6,
    background: active ? `${color}24` : "transparent",
    color: active ? color : "var(--uff-text-mute)",
    fontFamily: "inherit",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: ".04em",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    cursor: "pointer",
  };
  return (
    <button type="button" onClick={onClick} style={style}>
      {active && (
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      )}
      {label}
    </button>
  );
}

// Small red pill rendered next to an injured player's name. Matches the
// "Injured" eyebrow treatment from the player-detail hero (Build 6.5).
function InjuredTag() {
  return (
    <span
      title="This player is currently marked injured"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px",
        borderRadius: 4,
        background: "rgba(255,77,77,0.12)",
        border: "1px solid rgba(255,77,77,0.30)",
        color: "var(--uff-red)",
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "var(--uff-red)",
        }}
      />
      Injured
    </span>
  );
}

function Legend({ color, label, dim }: { color: string; label: string; dim?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        opacity: dim ? 0.6 : 1,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}
