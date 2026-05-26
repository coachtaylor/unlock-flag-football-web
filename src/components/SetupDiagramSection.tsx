"use client";

// SetupDiagramSection — Build 5 chrome around the existing DiagramEditor.
//
// Two states from the UFF Web Drills design (uff-web-drill-form-setup.jsx):
//   - collapsed: dashed "+ Add diagram" CTA when no cones exist yet.
//   - expanded: dark inline editor with an EDITING pill + stats header and a
//     counter / autosave / "Open full editor" footer wrapping the live
//     DiagramEditor canvas in the middle.
//
// The wrapped DiagramEditor still owns all interaction (cone placement,
// routes, ball paths, selection). The header / footer affordances here are
// presentation; grid/rotate/undo/redo/Open are visual stubs until Build 5
// wires the desktop-polish features.

import { useEffect, useState, type ReactNode } from "react";
import DiagramEditor from "@/components/DiagramEditor";
import type { DiagramData } from "@/types/diagram";

type Props = {
  value: DiagramData | null;
  onChange: (data: DiagramData) => void;
  catColor?: string;
};

export default function SetupDiagramSection({
  value,
  onChange,
  catColor = "var(--uff-orange)",
}: Props) {
  const hasCones = !!value && value.cones.length > 0;
  const [open, setOpen] = useState<boolean>(hasCones);

  // Auto-open the moment the diagram gets its first cone (e.g. after a
  // dropped-in template), and stay open across renders.
  useEffect(() => {
    if (hasCones && !open) setOpen(true);
  }, [hasCones, open]);

  if (!open) {
    return <SetupDiagramEmpty onExpand={() => setOpen(true)} />;
  }
  return (
    <SetupDiagramEditor
      value={value}
      onChange={onChange}
      catColor={catColor}
      onCollapse={() => setOpen(false)}
    />
  );
}

// ── COLLAPSED · empty state ────────────────────────────────────────────

function SetupDiagramEmpty({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      style={{
        width: "100%",
        background: "transparent",
        border: "1.5px dashed rgba(255,255,255,0.16)",
        borderRadius: 14,
        padding: "34px 22px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        fontFamily: "inherit",
        transition: "border-color 140ms ease, background 140ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,106,26,0.42)";
        e.currentTarget.style.background = "rgba(255,106,26,0.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "rgba(255,106,26,0.14)",
            color: "var(--uff-orange)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "var(--uff-text)",
            letterSpacing: "-0.005em",
          }}
        >
          Add diagram
        </span>
      </span>
      <span style={{ fontSize: 12.5, color: "var(--uff-text-mute)" }}>
        Sketch the cone setup and routes
      </span>

      <span
        style={{
          marginTop: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          fontSize: 10.5,
          color: "var(--uff-text-mute)",
          fontFamily: "var(--font-mono)",
          letterSpacing: ".08em",
        }}
      >
        <SetupChip label="20 × 20 yd" />
        <span>·</span>
        <SetupChip label="auto cones" />
        <span>·</span>
        <SetupChip label="route arrows" />
      </span>
    </button>
  );
}

function SetupChip({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: "3px 7px",
        borderRadius: 4,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--uff-line-soft)",
        color: "var(--uff-text-dim)",
      }}
    >
      {label}
    </span>
  );
}

// ── EXPANDED · inline editor chrome ────────────────────────────────────

function SetupDiagramEditor({
  value,
  onChange,
  catColor,
  onCollapse,
}: {
  value: DiagramData | null;
  onChange: (data: DiagramData) => void;
  catColor: string;
  onCollapse: () => void;
}) {
  const [showGrid, setShowGrid] = useState(true);

  const allCones = value?.cones ?? [];
  const cones = allCones.filter((c) => (c.kind ?? "cone") === "cone").length;
  const qbs = allCones.filter((c) => c.kind === "qb").length;
  const footballs = allCones.filter((c) => c.kind === "football").length;
  const players = allCones.filter((c) => c.kind === "player");
  const routes = value?.routes.length ?? 0;
  const passes = value?.ballPaths?.length ?? 0;

  // Group player markers by their label (e.g., 2× WR, 1× RB).
  const playerCounts = new Map<string, number>();
  for (const p of players) {
    const key = (p.label || "Player").trim().toUpperCase() || "Player";
    playerCounts.set(key, (playerCounts.get(key) ?? 0) + 1);
  }

  // Build the ordered list of counters, omitting any that are empty.
  const counters: Array<{ label: string; value: number }> = [];
  if (cones) counters.push({ label: cones === 1 ? "Cone" : "Cones", value: cones });
  if (qbs) counters.push({ label: "QB", value: qbs });
  if (footballs)
    counters.push({ label: footballs === 1 ? "Football" : "Footballs", value: footballs });
  for (const [label, count] of playerCounts) {
    counters.push({ label, value: count });
  }
  if (routes) counters.push({ label: routes === 1 ? "Route" : "Routes", value: routes });
  if (passes) counters.push({ label: passes === 1 ? "Pass" : "Passes", value: passes });

  const totalMarkers =
    cones + qbs + footballs + players.length + routes + passes;
  const canClear = totalMarkers > 0;
  const handleClear = () => {
    if (!canClear) return;
    onChange({
      cones: [],
      paths: [],
      routes: [],
      ballPaths: [],
      gridScale: value?.gridScale ?? 1,
    });
  };

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid var(--uff-line-soft)",
        background: "var(--uff-surface-2)",
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div
        style={{
          minHeight: 44,
          padding: "0 12px 0 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--uff-line-soft)",
          background: "rgba(255,255,255,0.015)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "4px 9px",
            borderRadius: 6,
            background: "rgba(255,106,26,0.10)",
            border: "1px solid rgba(255,106,26,0.28)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".12em",
            color: "var(--uff-orange)",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--uff-orange)",
              boxShadow: "0 0 0 2px rgba(255,106,26,0.25)",
            }}
          />
          EDITING
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--uff-text-mute)",
            letterSpacing: ".04em",
          }}
        >
          {[
            "20 × 20 yd box",
            cones ? `${cones} cone${cones === 1 ? "" : "s"}` : null,
            routes ? `${routes} route${routes === 1 ? "" : "s"}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>

        <span style={{ flex: 1 }} />

        <SmIconBtn
          label="Toggle grid"
          on={showGrid}
          onClick={() => setShowGrid((g) => !g)}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
          </svg>
        </SmIconBtn>
        <SmIconBtn label="Rotate field">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 4v5h-5" />
          </svg>
        </SmIconBtn>
        <Divider />
        <button
          type="button"
          onClick={onCollapse}
          style={{
            height: 28,
            padding: "0 10px",
            borderRadius: 7,
            background: "transparent",
            border: "1px solid var(--uff-line-soft)",
            color: "var(--uff-text-dim)",
            fontFamily: "inherit",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 15l6-6 6 6" />
          </svg>
          Collapse
        </button>
      </div>

      {/* Canvas — the live DiagramEditor handles all interactions */}
      <div
        style={{
          position: "relative",
          background: `radial-gradient(80% 50% at 50% 0%, ${
            catColor.startsWith("var")
              ? "rgba(255,106,26,0.08)"
              : `${catColor}14`
          } 0%, transparent 60%), var(--uff-surface)`,
          borderBottom: "1px solid var(--uff-line-soft)",
          padding: 12,
        }}
      >
        <DiagramEditor value={value} onChange={onChange} />
      </div>

      {/* Footer · counters + actions */}
      <div
        style={{
          minHeight: 46,
          padding: "8px 12px 8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.015)",
          flexWrap: "wrap",
        }}
      >
        {counters.map((c) => (
          <SetupCount key={c.label} label={c.label} value={c.value} />
        ))}

        <span style={{ flex: 1 }} />

        <SmIconBtn label="Undo (⌘Z)" disabled>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H8" />
            <path d="M7 11L3 7l4-4" />
          </svg>
        </SmIconBtn>
        <SmIconBtn label="Redo (⌘⇧Z)" disabled>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 7H10a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h6" />
            <path d="M17 11l4-4-4-4" />
          </svg>
        </SmIconBtn>
        <SmIconBtn label="Clear" disabled={!canClear} onClick={handleClear}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </SmIconBtn>

        <Divider />

        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--uff-text-mute)",
            letterSpacing: ".08em",
          }}
        >
          AUTOSAVED · live
        </span>

        <button
          type="button"
          disabled
          title="Coming in the full Build 5 editor"
          style={{
            marginLeft: 4,
            height: 28,
            padding: "0 10px",
            borderRadius: 7,
            background: "rgba(255,106,26,0.08)",
            border: "1px solid rgba(255,106,26,0.28)",
            color: "var(--uff-orange)",
            fontFamily: "inherit",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "not-allowed",
            opacity: 0.6,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Open full editor
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── small atoms ────────────────────────────────────────────────────────

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: "var(--uff-line-soft)",
        margin: "0 4px",
      }}
    />
  );
}

function SmIconBtn({
  children,
  label,
  on,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  on?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28,
        height: 28,
        display: "grid",
        placeItems: "center",
        borderRadius: 7,
        background: on ? "rgba(255,106,26,0.12)" : "transparent",
        border: `1px solid ${on ? "rgba(255,106,26,0.32)" : "var(--uff-line-soft)"}`,
        color: on ? "var(--uff-orange)" : "var(--uff-text-dim)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SetupCount({ label, value }: { label: string; value: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 5,
        padding: "4px 9px",
        background: "rgba(255,255,255,0.025)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 6,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--uff-text)",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </span>
  );
}
