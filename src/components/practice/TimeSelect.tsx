// TimeSelect — compact popover time picker for the practice planner.
//
// Native <input type="time"> / <select> both render an unstyled, endless
// scroll of options that clashes with the rest of the UI. Instead this is a
// styled trigger that opens a small popover with three short columns —
// hour (1–12), minute (5-minute steps), and AM/PM. The value contract is
// unchanged: 24h "HH:MM" strings, so nothing downstream changes.

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";

const STEP_MINUTES = 5;
type Period = "AM" | "PM";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 / STEP_MINUTES }, (_, i) => i * STEP_MINUTES); // 0,5,..55
const PERIODS: Period[] = ["AM", "PM"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// 24h "HH:MM" → 12h parts (or null for empty/malformed).
function parse24(v: string | null): { h12: number; minute: number; period: Period } | null {
  if (!v) return null;
  const [hs, ms] = v.split(":");
  const h = parseInt(hs ?? "", 10);
  const m = parseInt(ms ?? "", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const period: Period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { h12, minute: m, period };
}

// 12h parts → 24h "HH:MM". 12 AM → 00, 12 PM → 12.
function to24(h12: number, minute: number, period: Period): string {
  let h = h12 % 12; // 12 → 0, 1–11 unchanged
  if (period === "PM") h += 12;
  return `${pad(h)}:${pad(minute)}`;
}

export default function TimeSelect({
  value,
  onChange,
  style,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const parts = parse24(value);
  const h12 = parts?.h12 ?? null;
  const minute = parts?.minute ?? null;
  const period = parts?.period ?? null;

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Build the next value from a partial change, filling sensible defaults the
  // first time so a single tap produces a complete time.
  function commit(next: { h12?: number; minute?: number; period?: Period }) {
    const nh = next.h12 ?? h12 ?? 12;
    const nm = next.minute ?? minute ?? 0;
    const np = next.period ?? period ?? "AM";
    onChange(to24(nh, nm, np));
  }

  const triggerLabel = parts
    ? `${parts.h12}:${pad(parts.minute)} ${parts.period}`
    : "Set time";

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: "pointer",
          textAlign: "left",
          color: parts ? "var(--uff-text)" : "var(--uff-text-mute)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <ClockIcon />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {triggerLabel}
          </span>
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div
          role="dialog"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            display: "flex",
            gap: 4,
            padding: 6,
            background: "var(--uff-surface-2)",
            border: "1px solid var(--uff-line-soft)",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          }}
        >
          <Column
            ariaLabel="Hour"
            items={HOURS}
            selected={h12}
            format={(h) => String(h)}
            onPick={(h) => commit({ h12: h })}
          />
          <Column
            ariaLabel="Minute"
            items={MINUTES}
            selected={minute}
            format={pad}
            onPick={(m) => commit({ minute: m })}
          />
          <Column
            ariaLabel="AM/PM"
            items={PERIODS}
            selected={period}
            format={(p) => p}
            onPick={(p) => commit({ period: p })}
          />
        </div>
      )}
    </div>
  );
}

function Column<T extends string | number>({
  ariaLabel,
  items,
  selected,
  format,
  onPick,
}: {
  ariaLabel: string;
  items: readonly T[];
  selected: T | null;
  format: (v: T) => string;
  onPick: (v: T) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<HTMLButtonElement>(null);
  // Drag-to-scroll state. `moved` distinguishes a drag from a tap so we don't
  // select an option the user only dragged past.
  const drag = useRef({ active: false, startY: 0, startTop: 0, moved: false });

  // Center the active option when the popover opens.
  useLayoutEffect(() => {
    selRef.current?.scrollIntoView({ block: "center" });
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el) return;
    // Don't capture the pointer yet — capturing on a plain tap would retarget
    // the click to this container and swallow the option's onClick. We only
    // capture once a real drag begins (see onPointerMove).
    drag.current = { active: true, startY: e.clientY, startTop: el.scrollTop, moved: false };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || !drag.current.active) return;
    const dy = e.clientY - drag.current.startY;
    if (!drag.current.moved && Math.abs(dy) > 4) {
      drag.current.moved = true;
      el.style.cursor = "grabbing";
      el.setPointerCapture(e.pointerId);
    }
    if (drag.current.moved) el.scrollTop = drag.current.startTop - dy;
  }
  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (el) {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.style.cursor = "grab";
    }
    drag.current.active = false;
  }

  return (
    <div
      ref={scrollRef}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxHeight: 196,
        overflowY: "auto",
        scrollbarWidth: "none",
        paddingRight: 2,
        cursor: "grab",
        touchAction: "none",
      }}
    >
      {items.map((it) => {
        const isSel = selected === it;
        return (
          <button
            key={String(it)}
            type="button"
            ref={isSel ? selRef : undefined}
            onClick={() => {
              // Ignore the click that ends a drag gesture.
              if (drag.current.moved) {
                drag.current.moved = false;
                return;
              }
              onPick(it);
            }}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              minWidth: 44,
              padding: "7px 10px",
              borderRadius: 8,
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 13,
              fontWeight: isSel ? 700 : 500,
              textAlign: "center",
              background: isSel ? "var(--uff-orange)" : "transparent",
              color: isSel ? "#1a0f02" : "var(--uff-text)",
              transition: "background 100ms",
            }}
            onMouseEnter={(e) => {
              if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              if (!isSel) e.currentTarget.style.background = "transparent";
            }}
          >
            {format(it)}
          </button>
        );
      })}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flex: "0 0 auto" }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ flex: "0 0 auto", transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms", color: "var(--uff-text-mute)" }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
