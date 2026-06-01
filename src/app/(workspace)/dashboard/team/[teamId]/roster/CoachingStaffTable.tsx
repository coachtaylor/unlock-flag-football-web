// Coaching-staff table — the top section of the roster. Lists team_members
// in staff roles (head_coach / assistant_coach / team_manager), ordered by
// the RPC (heads → assistants → managers). Captains are NOT here — they
// render in the players table below via team_players.is_captain.
//
// Display-only in Build 16.5a. The "Invite coach" action + role management
// land in 16.5b alongside the invite flow.

import { initialsFor } from "@/lib/format/initials";
import {
  STAFF_ROLE_META,
  staffRoleLabel,
  specialtyLabel,
  type StaffRole,
} from "@/lib/team/staff-roles";
import SectionLabel from "./SectionLabel";

export type StaffMember = {
  memberId: string;
  userId: string;
  name: string;
  role: StaffRole;
  specialties: string[];
  isYou: boolean;
};

export default function CoachingStaffTable({
  staff,
}: {
  staff: StaffMember[];
}) {
  // Count head coaches so a lone head reads "Head coach" but multiple read
  // "Co-head coaches".
  const headCount = staff.filter((s) => s.role === "head_coach").length;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel
        label="Coaching staff"
        note={
          staff.length === 0
            ? "none yet"
            : `${staff.length} ${staff.length === 1 ? "person" : "people"}`
        }
      />

      {staff.length === 0 ? (
        <div
          className="w-card subdued"
          style={{
            padding: 20,
            border: "1px dashed var(--uff-line)",
            background: "transparent",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--uff-text-mute)", lineHeight: 1.5 }}>
            No coaching staff yet. Head coaches, assistant coaches, and team
            managers you invite will appear here.
          </p>
        </div>
      ) : (
        <div className="staff-table w-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="staff-row-grid staff-head">
            <span />
            <span>Coach</span>
            <span>Role</span>
            <span>Focus</span>
            <span style={{ textAlign: "right" }}>Access</span>
          </div>

          {staff.map((m, i) => (
            <StaffRow key={m.memberId} m={m} headCount={headCount} stripe={i % 2 === 1} />
          ))}
        </div>
      )}

      <style>{`
        .staff-row-grid {
          display: grid;
          grid-template-columns: 44px 1.7fr 1.2fr 1.1fr 120px;
          align-items: center;
          gap: 14px;
          padding: 12px 18px;
        }
        .staff-head {
          padding: 10px 18px;
          border-bottom: 1px solid var(--uff-line-soft);
          background: rgba(255,255,255,0.015);
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--uff-text-mute);
        }
        .staff-row {
          border-bottom: 1px solid var(--uff-line-soft);
          transition: background 120ms ease;
        }
        .staff-row:last-child { border-bottom: 0; }
        .staff-row.stripe { background: rgba(255,255,255,0.012); }
        @media (max-width: 720px) {
          .staff-row-grid { grid-template-columns: 40px 1.4fr 1fr 110px; }
          .staff-col-focus { display: none; }
        }
      `}</style>
    </section>
  );
}

function StaffRow({
  m,
  headCount,
  stripe,
}: {
  m: StaffMember;
  headCount: number;
  stripe: boolean;
}) {
  const meta = STAFF_ROLE_META[m.role];
  return (
    <div className={`staff-row staff-row-grid ${stripe ? "stripe" : ""}`}>
      <StaffAvatar name={m.name} color={meta.color} />

      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--uff-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {m.name}
        </span>
        {m.isYou && <YouPip />}
      </div>

      <span style={{ fontSize: 13, color: "var(--uff-text-dim)" }}>
        {staffRoleLabel(m.role, headCount)}
      </span>

      <div className="staff-col-focus" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {m.role === "assistant_coach" && m.specialties.length > 0 ? (
          m.specialties.map((s) => <SpecialtyPill key={s} label={specialtyLabel(s)} />)
        ) : (
          <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>—</span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <AccessBadge tier={meta.access} label={meta.accessLabel} />
      </div>
    </div>
  );
}

function StaffAvatar({ name, color }: { name: string; color: string }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "var(--uff-surface-2)",
        border: `1.5px solid ${color}`,
        color: "var(--uff-text)",
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        flexShrink: 0,
      }}
    >
      {initialsFor(name)}
    </div>
  );
}

function YouPip() {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: "var(--uff-lime)",
        padding: "1px 5px",
        borderRadius: 3,
        background: "rgba(194,255,61,0.12)",
        textTransform: "uppercase",
      }}
    >
      You
    </span>
  );
}

function SpecialtyPill({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.06em",
        padding: "2px 8px",
        borderRadius: 4,
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line-soft)",
        color: "var(--uff-text-dim)",
      }}
    >
      {label}
    </span>
  );
}

function AccessBadge({ tier, label }: { tier: "full" | "view"; label: string }) {
  const isFull = tier === "full";
  const color = isFull ? "var(--uff-lime)" : "var(--uff-text-mute)";
  const bg = isFull ? "rgba(194,255,61,0.10)" : "rgba(255,255,255,0.04)";
  const border = isFull
    ? "1px solid rgba(194,255,61,0.30)"
    : "1px solid var(--uff-line-soft)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "5px 10px",
        borderRadius: 999,
        background: bg,
        border,
        color,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}
