// Shared atoms for the Build 5.5 practice surfaces. PracticeStatusPill,
// DateTile, AvatarStack, BlockMixBar, BudgetBar, MiniStat, RsvpBar, plus
// the practice-specific icons (PIcon) and the duration stepper.

import type { ReactNode } from "react";
import type { PlanStatus, PracticePlan, PlanTotals } from "@/lib/practice/plan-data";
import { blockMinutes, interleavePlan, planTotals } from "@/lib/practice/plan-data";
import { blockColor } from "@/lib/practice/block-colors";

// ── Practice-specific icons ─────────────────────────────────────────────
// (Augments the generic Icon set; some glyphs overlap intentionally.)
const sk = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const PIcon = {
  water: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5s7 8 7 12.5a7 7 0 1 1-14 0c0-4.5 7-12.5 7-12.5z" />
    </svg>
  ),
  split: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2}>
      <path d="M12 3v18" />
      <path d="M5 8l-2 4 2 4" />
      <path d="M19 8l2 4-2 4" />
    </svg>
  ),
  drag: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  ),
  trash: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={1.8}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  ),
  plus: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2.4}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  minus: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2.6}>
      <path d="M5 12h14" />
    </svg>
  ),
  up: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  ),
  dn: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  chevR: ({ size = 12 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  chevDn: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  chevUp: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  ),
  copy: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={1.8}>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </svg>
  ),
  link: ({ size = 12 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2}>
      <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  ),
  template: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={1.8}>
      <rect x="3" y="3" width="18" height="6" rx="1" />
      <rect x="3" y="13" width="11" height="8" rx="1" />
      <rect x="18" y="13" width="3" height="8" rx="1" />
    </svg>
  ),
  bench: ({ size = 11 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L4 14h7l-2 8 9-12h-7l2-8z" />
    </svg>
  ),
  whistle: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={1.8}>
      <circle cx="9" cy="13" r="6" />
      <path d="M14 11l8-3-1 3-7 2M9 7V4M11 4h-4" />
    </svg>
  ),
  clock: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  cal: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={1.8}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  ),
  people: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={1.8}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.5c2.6.4 4.5 2.5 4.5 5" />
    </svg>
  ),
  close: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2.2}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  check: ({ size = 12 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2.6}>
      <path d="M4 12l5 5 11-12" />
    </svg>
  ),
  search: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...sk} strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  more: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  ),
};

// ── Practice status pill ───────────────────────────────────────────────
const STATUS_STYLE: Record<PlanStatus, { bg: string; fg: string; dot: string; label: string }> = {
  draft: {
    bg: "rgba(255,255,255,0.04)",
    fg: "var(--uff-text-dim)",
    dot: "var(--uff-text-mute)",
    label: "Draft",
  },
  scheduled: {
    bg: "rgba(255,106,26,0.10)",
    fg: "var(--uff-orange)",
    dot: "var(--uff-orange)",
    label: "Scheduled",
  },
  live: {
    bg: "rgba(194,255,61,0.10)",
    fg: "var(--uff-lime)",
    dot: "var(--uff-lime)",
    label: "Live now",
  },
  completed: {
    bg: "rgba(110,168,255,0.10)",
    fg: "var(--uff-blue, #6EA8FF)",
    dot: "var(--uff-blue, #6EA8FF)",
    label: "Completed",
  },
};

export function PracticeStatusPill({ status, mini }: { status: PlanStatus; mini?: boolean }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: mini ? "2px 8px" : "3px 10px",
        borderRadius: 4,
        background: s.bg,
        color: s.fg,
        fontSize: mini ? 9.5 : 10.5,
        fontWeight: 700,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: s.dot,
          boxShadow: status === "live" ? "0 0 0 3px rgba(194,255,61,0.18)" : "none",
        }}
      />
      {s.label}
    </span>
  );
}

// ── Date tile (calendar block) ─────────────────────────────────────────
export function DateTile({ iso, size = "lg" }: { iso: string; size?: "lg" | "sm" }) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  const dow = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const mon = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = String(d.getDate());
  const dim = size === "lg" ? 76 : 60;
  return (
    <div
      style={{
        width: dim,
        height: dim,
        flexShrink: 0,
        borderRadius: 14,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid var(--uff-line-soft)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
      }}
    >
      <span style={{ fontSize: size === "lg" ? 9 : 8, fontWeight: 700, letterSpacing: ".16em", color: "var(--uff-text-mute)" }}>
        {mon}
      </span>
      <span
        style={{
          fontSize: size === "lg" ? 28 : 22,
          fontWeight: 800,
          color: "var(--uff-text)",
          lineHeight: 1,
          marginTop: 2,
          marginBottom: 2,
          letterSpacing: "-0.02em",
        }}
      >
        {day}
      </span>
      <span style={{ fontSize: size === "lg" ? 9 : 8, fontWeight: 700, letterSpacing: ".16em", color: "var(--uff-text-mute)" }}>
        {dow}
      </span>
    </div>
  );
}

// ── Avatar stack ────────────────────────────────────────────────────────
export type AvatarItem = { initials: string; color: string };

export function AvatarStack({
  items,
  size = 22,
  max = 5,
}: {
  items: AvatarItem[];
  size?: number;
  max?: number;
}) {
  const shown = items.slice(0, max);
  const overflow = items.length - shown.length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {shown.map((p, i) => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: p.color,
            color: "#1a0f08",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size <= 22 ? 9 : 10,
            fontWeight: 800,
            border: "2px solid var(--uff-surface)",
            marginLeft: i === 0 ? 0 : -Math.round(size * 0.32),
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            letterSpacing: "-0.02em",
          }}
        >
          {p.initials}
        </span>
      ))}
      {overflow > 0 && (
        <span
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: "var(--uff-surface-2)",
            color: "var(--uff-text-dim)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
            border: "2px solid var(--uff-surface)",
            marginLeft: -Math.round(size * 0.32),
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}

// ── Block mix bar — colored segments per block + breaks ────────────────
export function BlockMixBar({ plan, height = 6 }: { plan: PracticePlan; height?: number }) {
  const rows = interleavePlan(plan);
  const totalUnits = rows.reduce((a, r) => {
    if (r.kind === "block") return a + blockMinutes(r.payload);
    return a + r.payload.duration_minutes;
  }, 0);
  if (totalUnits === 0) {
    return (
      <div
        style={{
          height,
          borderRadius: height / 2,
          background: "rgba(255,255,255,0.05)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        height,
        borderRadius: height / 2,
        overflow: "hidden",
        background: "rgba(255,255,255,0.05)",
        display: "flex",
        gap: 2,
      }}
    >
      {rows.map((row) => {
        if (row.kind === "block") {
          const mn = blockMinutes(row.payload);
          if (mn === 0) return null;
          const c = blockColor(row.payload.name);
          return (
            <div
              key={row.payload.id}
              title={`${row.payload.name} · ${mn}m`}
              style={{ flex: mn, background: c.accent, borderRadius: 2 }}
            />
          );
        }
        return (
          <div
            key={row.payload.id}
            title={`Water · ${row.payload.duration_minutes}m`}
            style={{
              flex: row.payload.duration_minutes,
              background: "#6EA8FF",
              opacity: 0.6,
              borderRadius: 2,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Plan summary mix bar (for list summary cards) ──────────────────────
// Takes the lighter PlanSummary shape so we don't need to hydrate full
// drill rows just to draw the bar on the list.
export function SummaryMixBar({
  blocks,
  breakMinutes,
  height = 6,
}: {
  blocks: { id: string; name: string; minutes: number }[];
  breakMinutes: number;
  height?: number;
}) {
  const total = blocks.reduce((a, b) => a + b.minutes, 0) + breakMinutes;
  if (total === 0) {
    return (
      <div
        style={{
          height,
          borderRadius: height / 2,
          background: "rgba(255,255,255,0.05)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        height,
        borderRadius: height / 2,
        overflow: "hidden",
        background: "rgba(255,255,255,0.05)",
        display: "flex",
        gap: 2,
      }}
    >
      {blocks.map((b) => {
        if (b.minutes === 0) return null;
        const c = blockColor(b.name);
        return (
          <div
            key={b.id}
            title={`${b.name} · ${b.minutes}m`}
            style={{ flex: b.minutes, background: c.accent, borderRadius: 2 }}
          />
        );
      })}
      {breakMinutes > 0 && (
        <div
          title={`Water · ${breakMinutes}m`}
          style={{
            flex: breakMinutes,
            background: "#6EA8FF",
            opacity: 0.6,
            borderRadius: 2,
          }}
        />
      )}
    </div>
  );
}

// ── Budget bar (used in detail hero) ───────────────────────────────────
export function BudgetBar({ plan, totals }: { plan: PracticePlan; totals: PlanTotals }) {
  const denom = Math.max(totals.target, totals.total, 1);
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".14em",
            color: "var(--uff-text-mute)",
            textTransform: "uppercase",
          }}
        >
          Time budget
        </span>
        <span
          className="mono"
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 11.5,
            color: totals.total > totals.target ? "var(--uff-red)" : "var(--uff-text-dim)",
          }}
        >
          {totals.total}m / {totals.target}m
          {totals.total > totals.target && (
            <span style={{ marginLeft: 6 }}>+{totals.total - totals.target}m over</span>
          )}
          {totals.total < totals.target && (
            <span style={{ marginLeft: 6 }}>{totals.target - totals.total}m room</span>
          )}
        </span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 5,
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        {interleavePlan(plan).map((row) => {
          if (row.kind === "block") {
            const mn = blockMinutes(row.payload);
            const c = blockColor(row.payload.name);
            return (
              <div
                key={row.payload.id}
                title={`${row.payload.name} · ${mn}m`}
                style={{
                  width: `${(mn / denom) * 100}%`,
                  background: c.accent,
                  opacity: 0.92,
                  borderRight: "1px solid #08090B",
                }}
              />
            );
          }
          return (
            <div
              key={row.payload.id}
              title={`Water · ${row.payload.duration_minutes}m`}
              style={{
                width: `${(row.payload.duration_minutes / denom) * 100}%`,
                background: "#6EA8FF",
                opacity: 0.6,
                borderRight: "1px solid #08090B",
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
        {plan.blocks.map((b) => {
          const c = blockColor(b.name);
          return (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c.accent }} />
              <span style={{ fontSize: 11, color: "var(--uff-text-dim)" }}>{b.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MiniStat({ label, value, sub }: { label: string; value: ReactNode; sub?: string[] | null }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 11, color: "var(--uff-text-mute)", letterSpacing: ".04em" }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {Array.isArray(sub) && (
          <span style={{ display: "inline-flex", gap: 2 }}>
            {sub.map((c, i) => (
              <span key={i} style={{ width: 6, height: 12, borderRadius: 1, background: c }} />
            ))}
          </span>
        )}
        <span
          className="mono"
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--uff-text)",
          }}
        >
          {value}
        </span>
      </span>
    </div>
  );
}

export function RsvpBar({
  i,
  m,
  o,
  total,
}: {
  i: number;
  m: number;
  o: number;
  total: number;
}) {
  const noResp = Math.max(0, total - i - m - o);
  const pct = total > 0 ? Math.round((i / total) * 100) : 0;
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          className="mono"
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--uff-lime)",
          }}
        >
          {i}
          <span style={{ fontSize: 12, color: "var(--uff-text-mute)" }}>/{total}</span>
        </span>
        <span style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>{pct}% confirmed</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          background: "rgba(255,255,255,0.05)",
          display: "flex",
          gap: 1,
        }}
      >
        {i > 0 && <div style={{ flex: i, background: "var(--uff-lime)" }} />}
        {m > 0 && <div style={{ flex: m, background: "#FFB347" }} />}
        {o > 0 && <div style={{ flex: o, background: "var(--uff-red)" }} />}
        {noResp > 0 && <div style={{ flex: noResp, background: "rgba(255,255,255,0.06)" }} />}
      </div>
    </div>
  );
}

// ── Common helpers ─────────────────────────────────────────────────────
export function formatDateLabel(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatTimeLabel(time: string | null): string | null {
  if (!time) return null;
  // time is "HH:MM:SS" — strip seconds
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hr12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hr12}:${m} ${ampm}`;
}

export function durLabel(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export { planTotals, interleavePlan, blockMinutes };
