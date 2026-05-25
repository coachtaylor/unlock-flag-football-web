// Onboarding shell primitives: stage chrome, top bar, footer meta,
// centered card, optional right-side summary rail, progress dots,
// header (eyebrow + title + subtitle), and the back/continue footer.
//
// All client-side: every interaction (sign-out button, footer buttons)
// needs onClick handlers. Form state and submission live in the
// per-route page components.

"use client";

import { type ReactNode } from "react";
import { Icon } from "@/components/uff/icons";

type Accent = "orange" | "lime";

function accentVar(a: Accent) {
  return a === "lime" ? "var(--uff-lime)" : "var(--uff-orange)";
}

// ── Stage: full viewport, glow, top bar + footer meta ─────────────────
export function OnbStage({
  children,
  step,
  total = 4,
  accent = "orange",
  signOutHref = "/login",
}: {
  children: ReactNode;
  step: number;
  total?: number;
  accent?: Accent;
  signOutHref?: string;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: `
          radial-gradient(ellipse 70% 36% at 50% -10%, rgba(255, 106, 26, 0.10), transparent 70%),
          radial-gradient(ellipse 50% 30% at 12% 110%, rgba(255, 106, 26, 0.06), transparent 70%),
          var(--uff-ink)
        `,
        color: "var(--uff-text)",
        fontFamily: "var(--font-sans)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <OnbTopBar step={step} total={total} accent={accent} signOutHref={signOutHref} />

      {/* Centered content well — flex grows to fill remaining height. */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
          minHeight: 0,
        }}
        className="onb-stage-well"
      >
        {children}
      </div>

      <OnbFooterMeta />

      <style>{`
        @media (max-width: 767px) {
          .onb-stage-well {
            align-items: flex-start !important;
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

function OnbTopBar({
  step,
  total,
  accent,
  signOutHref,
}: {
  step: number;
  total: number;
  accent: Accent;
  signOutHref: string;
}) {
  return (
    <div
      style={{
        height: 72,
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--uff-line-soft)",
        flexShrink: 0,
        background: "rgba(8, 9, 11, 0.45)",
        backdropFilter: "blur(6px)",
      }}
      className="onb-topbar"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "var(--uff-orange)",
            display: "grid",
            placeItems: "center",
            color: "#1a0f08",
            fontFamily: "var(--font-mono)",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: "-0.5px",
            boxShadow: "0 4px 16px rgba(255, 106, 26, 0.35)",
          }}
        >
          U
        </div>
        <div
          className="onb-brand-meta"
          style={{ display: "flex", flexDirection: "column", gap: 1, lineHeight: 1.1 }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Unlock FF
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              color: "var(--uff-text-dim)",
              letterSpacing: "0.04em",
            }}
          >
            Set up your account
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            color: accentVar(accent),
          }}
        >
          {String(step).padStart(2, "0")}
        </span>
        <span>/</span>
        <span>{String(total).padStart(2, "0")}</span>
        <span style={{ width: 1, height: 14, background: "var(--uff-line)" }} />
        <span className="onb-step-word">ONBOARDING</span>

        <span style={{ width: 18 }} />
        <a
          href={signOutHref}
          style={{
            background: "transparent",
            border: 0,
            color: "var(--uff-text-dim)",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            letterSpacing: 0,
            textDecoration: "none",
          }}
        >
          Sign out
        </a>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .onb-topbar { height: 56px !important; padding: 0 18px !important; }
          .onb-brand-meta { display: none !important; }
          .onb-step-word { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function OnbFooterMeta() {
  return (
    <div
      className="onb-footer-meta"
      style={{
        padding: "14px 32px 18px",
        display: "flex",
        justifyContent: "space-between",
        fontSize: 11,
        color: "var(--uff-text-mute)",
        borderTop: "1px solid var(--uff-line-soft)",
        flexShrink: 0,
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", letterSpacing: ".08em" }}>
        UFF · COACH CONSOLE
      </span>
      <span style={{ display: "flex", gap: 18 }}>
        <span>Privacy</span>
        <span>Support</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>v2.4.0</span>
      </span>
      <style>{`
        @media (max-width: 767px) {
          .onb-footer-meta { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── Centered card body, optionally with a right-side summary rail ─────
export function OnbCard({
  width = 560,
  children,
  withSummary,
}: {
  width?: number;
  children: ReactNode;
  withSummary?: ReactNode;
}) {
  return (
    <div
      className="onb-card-grid"
      style={{
        width: "100%",
        maxWidth: withSummary ? width + 304 : width,
        display: "grid",
        gridTemplateColumns: withSummary ? `minmax(0, ${width}px) 280px` : "1fr",
        gap: 24,
        alignItems: "start",
      }}
    >
      <div
        className="onb-card-body"
        style={{
          background: "var(--uff-surface)",
          border: "1px solid var(--uff-line-soft)",
          borderRadius: 20,
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.36), 0 1px 0 rgba(255,255,255,0.02) inset",
          padding: "32px 36px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          minWidth: 0,
        }}
      >
        {children}
      </div>
      {withSummary && (
        <aside
          className="onb-summary-rail"
          style={{
            position: "sticky",
            top: 24,
            padding: "20px 18px",
            background: "var(--uff-surface-2)",
            border: "1px solid var(--uff-line-soft)",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {withSummary}
        </aside>
      )}

      <style>{`
        @media (max-width: 900px) {
          .onb-card-grid {
            grid-template-columns: 1fr !important;
          }
          .onb-summary-rail { display: none !important; }
        }
        @media (max-width: 767px) {
          .onb-card-body {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 20px 4px 12px !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── Progress dots ─────────────────────────────────────────────────────
export function WebProgressDots({
  step,
  total = 4,
  accent = "orange",
}: {
  step: number;
  total?: number;
  accent?: Accent;
}) {
  const av = accentVar(accent);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i + 1 < step;
        const isCur = i + 1 === step;
        const w = isCur ? 28 : 6;
        return (
          <div
            key={i}
            style={{
              height: 6,
              width: w,
              borderRadius: 3,
              background: isDone || isCur ? av : "var(--uff-line)",
              opacity: isDone ? 0.55 : 1,
              transition: "width 200ms ease",
            }}
          />
        );
      })}
      <span
        style={{
          marginLeft: 10,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
          fontFamily: "var(--font-mono)",
        }}
      >
        STEP {step} / {total}
      </span>
    </div>
  );
}

// ── Header: eyebrow + title + subtitle ────────────────────────────────
export function OnbHeader({
  eyebrow,
  title,
  subtitle,
  accent = "orange",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  accent?: Accent;
}) {
  const av = accentVar(accent);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {eyebrow && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".18em",
            color: "var(--uff-text-dim)",
          }}
        >
          <span style={{ width: 3, height: 11, background: av, borderRadius: 2 }} />
          {eyebrow}
        </div>
      )}
      <h1
        style={{
          margin: 0,
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
          color: "var(--uff-text)",
          textWrap: "balance" as never,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            margin: 0,
            fontSize: 14.5,
            fontWeight: 500,
            lineHeight: 1.5,
            color: "var(--uff-text-dim)",
            maxWidth: 460,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── Footer: back + helper + continue ──────────────────────────────────
export function OnbFooter({
  primaryLabel = "Continue",
  primaryType = "button",
  onPrimary,
  primaryDisabled,
  primaryPending,
  backHref,
  backLabel = "Back",
  helper,
  accent = "orange",
}: {
  primaryLabel?: string;
  primaryType?: "button" | "submit";
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryPending?: boolean;
  backHref?: string;
  backLabel?: string;
  helper?: ReactNode;
  accent?: Accent;
}) {
  const av = accentVar(accent);
  const disabled = primaryDisabled || primaryPending;
  return (
    <div
      style={{
        marginTop: 4,
        paddingTop: 18,
        borderTop: "1px solid var(--uff-line-soft)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {backHref ? (
        <a
          href={backHref}
          style={{
            height: 44,
            padding: "0 18px",
            background: "transparent",
            border: "1px solid var(--uff-line)",
            borderRadius: 12,
            color: "var(--uff-text)",
            fontFamily: "inherit",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <Icon.arrowLeft size={14} />
          {backLabel}
        </a>
      ) : (
        <span />
      )}

      {helper && (
        <span
          style={{
            fontSize: 12,
            color: "var(--uff-text-mute)",
            maxWidth: 240,
            lineHeight: 1.4,
          }}
        >
          {helper}
        </span>
      )}

      <span style={{ flex: 1 }} />

      <button
        type={primaryType}
        onClick={onPrimary}
        disabled={disabled}
        style={{
          height: 44,
          padding: "0 22px",
          background: disabled ? "rgba(255,255,255,0.06)" : av,
          color: disabled ? "var(--uff-text-mute)" : "#1a0f08",
          border: 0,
          borderRadius: 12,
          fontFamily: "inherit",
          fontSize: 13.5,
          fontWeight: 700,
          letterSpacing: "0.01em",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          boxShadow: disabled
            ? "none"
            : accent === "lime"
            ? "0 8px 24px rgba(194,255,61,0.20)"
            : "0 8px 24px rgba(255, 106, 26, 0.28)",
          transition: "background 120ms ease",
        }}
      >
        {primaryPending ? "Saving…" : primaryLabel}
        {!primaryPending && <Icon.arrowRight size={14} />}
      </button>
    </div>
  );
}

// ── Big choice card (Scope / Role) ────────────────────────────────────
export function WebChoiceCard({
  icon,
  title,
  body,
  footer,
  selected,
  onClick,
  accent = "orange",
}: {
  icon: ReactNode;
  title: string;
  body: string;
  footer?: string;
  selected?: boolean;
  onClick?: () => void;
  accent?: Accent;
}) {
  const av = accentVar(accent);
  const accentSoft =
    accent === "lime" ? "rgba(194,255,61,0.10)" : "rgba(255,106,26,0.10)";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        background: selected
          ? `linear-gradient(180deg, ${accentSoft} 0%, transparent 60%), var(--uff-surface-2)`
          : "var(--uff-surface-2)",
        border: `1.5px solid ${selected ? av : "var(--uff-line)"}`,
        borderRadius: 16,
        padding: 20,
        cursor: "pointer",
        transition:
          "border-color 120ms ease, background 120ms ease, transform 120ms ease",
        fontFamily: "inherit",
        color: "var(--uff-text)",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
        minHeight: 184,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: selected ? av : "rgba(255,255,255,0.04)",
            color: selected ? "#0a0a0d" : "var(--uff-text-dim)",
            border: selected ? "none" : "1px solid var(--uff-line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 120ms ease, color 120ms ease",
          }}
        >
          {icon}
        </div>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: selected ? av : "transparent",
            border: selected ? "none" : "1.5px solid var(--uff-line)",
            color: "#0a0a0d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected && <Icon.check size={13} />}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--uff-text-dim)",
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>
      </div>
      {footer && (
        <div
          style={{
            paddingTop: 10,
            borderTop: "1px solid var(--uff-line-soft)",
            fontSize: 11,
            color: "var(--uff-text-mute)",
            letterSpacing: ".08em",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
          }}
        >
          {footer}
        </div>
      )}
    </button>
  );
}

// ── Label + input wrapper used on the team/league forms ───────────────
export function OnbField({
  label,
  optional,
  hint,
  children,
  right,
}: {
  label: string;
  optional?: string;
  hint?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: "var(--uff-text-dim)",
          }}
        >
          {label}
        </span>
        {optional && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: ".08em",
              color: "var(--uff-text-mute)",
            }}
          >
            · {optional}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {right}
      </div>
      {children}
      {hint && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--uff-text-mute)",
            lineHeight: 1.45,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

// ── Inline tip / hint pill ────────────────────────────────────────────
export function OnbHint({
  icon,
  children,
  accent = "orange",
}: {
  icon?: ReactNode;
  children: ReactNode;
  accent?: Accent;
}) {
  const av = accentVar(accent);
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "12px 14px",
        background: "rgba(255, 255, 255, 0.025)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 12,
        color: "var(--uff-text-dim)",
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: av, marginTop: 1, flexShrink: 0 }}>
        {icon ?? <Icon.bolt size={12} />}
      </span>
      <span>{children}</span>
    </div>
  );
}

// ── Inline error banner ───────────────────────────────────────────────
export function OnbError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        padding: "10px 12px",
        background: "rgba(255, 77, 77, 0.10)",
        border: "1px solid rgba(255, 77, 77, 0.35)",
        borderRadius: 10,
        color: "#FFB4B4",
        fontSize: 12.5,
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  );
}

// ── Summary rail row (used in the team / league summaries) ────────────
export function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          color: "var(--uff-text-mute)",
          letterSpacing: ".12em",
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: muted ? "var(--uff-text-mute)" : "var(--uff-text)",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Team identity preview card ────────────────────────────────────────
export function TeamIdentityPreview({
  name,
  colorHex,
  format,
  role,
  ready,
}: {
  name: string;
  colorHex: string;
  format: string;
  role: string;
  ready: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--uff-surface)",
        border: "1px solid var(--uff-line)",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: colorHex,
          color: "#0a0a0d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: "-0.04em",
        }}
      >
        {(name.trim()[0] ?? "T").toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
          flex: 1,
        }}
      >
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: ready ? "var(--uff-text)" : "var(--uff-text-mute)",
          }}
        >
          {ready ? name : "Your team"}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: "var(--uff-text-dim)",
            fontFamily: "var(--font-mono)",
            letterSpacing: ".06em",
          }}
        >
          {format.toUpperCase()} · {role.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

// ── League identity preview card ──────────────────────────────────────
export function LeagueIdentityPreview({
  name,
  colorHex,
  format,
  ready,
}: {
  name: string;
  colorHex: string;
  format: string;
  ready: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--uff-surface)",
        border: "1px solid var(--uff-line)",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: colorHex,
          color: "#0a0a0d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: "-0.04em",
        }}
      >
        {(name.trim()[0] ?? "L").toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
          flex: 1,
        }}
      >
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: ready ? "var(--uff-text)" : "var(--uff-text-mute)",
          }}
        >
          {ready ? name : "Your league"}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: "var(--uff-text-dim)",
            fontFamily: "var(--font-mono)",
            letterSpacing: ".06em",
          }}
        >
          LEAGUE · {format.toUpperCase()} · 0 TEAMS
        </span>
      </div>
    </div>
  );
}
