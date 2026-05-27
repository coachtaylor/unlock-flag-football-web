"use client";

// Pin / unpin a drill on the team dashboard.
//
// Two variants:
//   1. Single-type drill (benchmarkTypes.length <= 1): simple toggle.
//      Pin = (type, all positions). Unpin = removes ALL pins for the
//      drill. Matches the Build 7 affordance so single-type drills feel
//      unchanged.
//   2. Multi-type drill (benchmarkTypes.length >= 2): button opens a
//      popover with one row per pinned slice + "Pin another slice" to
//      add more. Each row controls a (type, position) slice via
//      addPin/removePin. Footer shows team-wide slot usage.
//
// State lives in `team_dashboard_pins` (migration 63). The parent page
// fetches the drill's current pins, total team pin count, and active
// position options server-side and passes them in.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPin,
  addBreakdownPin,
  removePin,
  togglePinDrill,
} from "@/app/(workspace)/dashboard/team/[teamId]/actions";
import { Icon } from "@/components/uff/icons";

export type PinSlice = {
  id: string;
  benchmarkType: string;
  position: string | null;
  breakdownPositions: string[] | null;
};

type Props = {
  drillId: string;
  teamId: string;
  /** Drill's benchmark_types[] (drives which types can be pinned). */
  benchmarkTypes: string[];
  /** Pins currently on this drill (any type, any position). */
  currentPins: PinSlice[];
  /** Active positions actually present on the roster — drives the dropdown. */
  positionOptions: string[];
  /** Total pins on the team (across all drills). */
  totalTeamPins: number;
  /** Slot cap (defaults to 4). */
  slotCap?: number;
};

export default function PinButton({
  drillId,
  teamId,
  benchmarkTypes,
  currentPins,
  positionOptions,
  totalTeamPins,
  slotCap = 4,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPinned = currentPins.length > 0;
  const isMultiType = benchmarkTypes.length >= 2;

  // ── Single-type drill: simple toggle (route via legacy wrapper to
  //    keep the team_drills.is_dashboard_pinned column in sync for one
  //    deploy cycle). ─────────────────────────────────────────────────
  if (!isMultiType) {
    return (
      <button
        type="button"
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              await togglePinDrill(drillId, teamId, !isPinned);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          })
        }
        aria-pressed={isPinned}
        disabled={pending || benchmarkTypes.length === 0}
        className={`wbtn ${isPinned ? "primary" : ""}`}
        style={{
          height: 32,
          padding: "0 12px",
          fontSize: 12,
          opacity: pending ? 0.7 : 1,
        }}
        title={
          benchmarkTypes.length === 0
            ? "Drill has no benchmark type set"
            : undefined
        }
      >
        <Icon.pin size={12} />
        {isPinned ? "Pinned" : "Pin to dashboard"}
        {error && <span style={{ color: "var(--uff-red)" }}> · {error}</span>}
      </button>
    );
  }

  // ── Multi-type drill: popover. ──────────────────────────────────────
  const slotsUsed = totalTeamPins;
  const slotsLeft = Math.max(0, slotCap - slotsUsed);
  const atCap = slotsLeft <= 0;

  function refresh() {
    router.refresh();
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-pressed={isPinned}
        disabled={pending}
        className={`wbtn ${isPinned ? "primary" : ""}`}
        style={{
          height: 32,
          padding: "0 12px",
          fontSize: 12,
          opacity: pending ? 0.7 : 1,
        }}
      >
        <Icon.pin size={12} />
        {isPinned
          ? `Pinned (${currentPins.length})`
          : "Pin to dashboard"}
        <span style={{ opacity: 0.6, marginLeft: 4 }}>▾</span>
      </button>

      {open && (
        <>
          {/* Click-outside scrim */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "transparent",
              zIndex: 40,
            }}
          />
          <div
            role="dialog"
            aria-label="Pin pulses to dashboard"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              minWidth: 320,
              maxWidth: 380,
              background: "var(--uff-surface)",
              border: "1px solid var(--uff-line)",
              borderRadius: 10,
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              padding: 12,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--uff-text-mute)",
              }}
            >
              Pin pulses to dashboard
            </div>

            {/* Existing pins */}
            {currentPins.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--uff-text-dim)",
                  padding: "4px 0",
                }}
              >
                Pick a benchmark type + position to pin a pulse for this drill.
              </div>
            )}

            {currentPins.map((pin) =>
              pin.breakdownPositions && pin.breakdownPositions.length > 0 ? (
                <BreakdownPinRow
                  key={pin.id}
                  pin={pin}
                  pending={pending}
                  onRemove={() =>
                    start(async () => {
                      setError(null);
                      const r = await removePin({
                        pinId: pin.id,
                        teamId,
                        drillId,
                      });
                      if (!r.ok) setError(r.error);
                      refresh();
                    })
                  }
                />
              ) : (
                <PinRow
                  key={pin.id}
                  pin={pin}
                  positionOptions={positionOptions}
                  pending={pending}
                  onRemove={() =>
                    start(async () => {
                      setError(null);
                      const r = await removePin({
                        pinId: pin.id,
                        teamId,
                        drillId,
                      });
                      if (!r.ok) setError(r.error);
                      refresh();
                    })
                  }
                  onChangePosition={(nextPos) =>
                    start(async () => {
                      setError(null);
                      // Atomic swap: remove old, add new. If the add fails
                      // (cap reached on another captain's pin), the remove
                      // already landed — re-pin the original to roll back.
                      const r1 = await removePin({
                        pinId: pin.id,
                        teamId,
                        drillId,
                      });
                      if (!r1.ok) {
                        setError(r1.error);
                        refresh();
                        return;
                      }
                      const r2 = await addPin({
                        drillId,
                        teamId,
                        benchmarkType: pin.benchmarkType,
                        position: nextPos,
                      });
                      if (!r2.ok) {
                        setError(r2.error);
                        await addPin({
                          drillId,
                          teamId,
                          benchmarkType: pin.benchmarkType,
                          position: pin.position,
                        });
                      }
                      refresh();
                    })
                  }
                />
              )
            )}

            {/* Add a single (type, position) slice */}
            <AddSliceForm
              benchmarkTypes={benchmarkTypes}
              positionOptions={positionOptions}
              disabled={pending || atCap}
              onAdd={(type, position) =>
                start(async () => {
                  setError(null);
                  const r = await addPin({
                    drillId,
                    teamId,
                    benchmarkType: type,
                    position,
                  });
                  if (!r.ok) {
                    setError(
                      r.error === "pin_cap_reached"
                        ? `Dashboard is full (${slotCap} slots).`
                        : r.error
                    );
                  }
                  refresh();
                })
              }
            />

            {/* Add a breakdown card (one slot, N position rows) */}
            {positionOptions.length >= 2 && (
              <AddBreakdownForm
                benchmarkTypes={benchmarkTypes}
                positionOptions={positionOptions}
                disabled={pending || atCap}
                onAdd={(type, positions) =>
                  start(async () => {
                    setError(null);
                    const r = await addBreakdownPin({
                      drillId,
                      teamId,
                      benchmarkType: type,
                      positions,
                    });
                    if (!r.ok) {
                      setError(
                        r.error === "pin_cap_reached"
                          ? `Dashboard is full (${slotCap} slots).`
                          : r.error === "breakdown_requires_positions"
                          ? "Pick at least one position."
                          : r.error
                      );
                    }
                    refresh();
                  })
                }
              />
            )}

            {/* Footer */}
            <div
              style={{
                fontSize: 11,
                color: "var(--uff-text-mute)",
                borderTop: "1px solid var(--uff-line-soft)",
                paddingTop: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                {slotsUsed} of {slotCap} slots used team-wide
              </span>
              {atCap && (
                <span style={{ color: "var(--uff-orange)" }}>at cap</span>
              )}
            </div>

            {error && (
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--uff-red)",
                  background: "rgba(255,77,77,0.08)",
                  border: "1px solid rgba(255,77,77,0.3)",
                  borderRadius: 6,
                  padding: "6px 8px",
                }}
              >
                {error}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PinRow({
  pin,
  positionOptions,
  pending,
  onRemove,
  onChangePosition,
}: {
  pin: PinSlice;
  positionOptions: string[];
  pending: boolean;
  onRemove: () => void;
  onChangePosition: (next: string | null) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 8,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          padding: "2px 7px",
          borderRadius: 4,
          background: "rgba(255,106,26,0.14)",
          color: "var(--uff-orange)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {pin.benchmarkType}
      </span>
      <select
        value={pin.position ?? ""}
        onChange={(e) => onChangePosition(e.target.value || null)}
        disabled={pending}
        style={{
          flex: 1,
          height: 28,
          padding: "0 6px",
          background: "var(--uff-surface)",
          border: "1px solid var(--uff-line)",
          borderRadius: 6,
          color: "var(--uff-text)",
          fontSize: 12,
        }}
      >
        <option value="">All positions</option>
        {positionOptions.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        disabled={pending}
        aria-label="Remove pin"
        title="Remove pin"
        style={{
          height: 28,
          width: 28,
          padding: 0,
          borderRadius: 6,
          border: "1px solid var(--uff-line)",
          background: "rgba(255,255,255,0.02)",
          color: "var(--uff-text-mute)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

function BreakdownPinRow({
  pin,
  pending,
  onRemove,
}: {
  pin: PinSlice;
  pending: boolean;
  onRemove: () => void;
}) {
  const positions = pin.breakdownPositions ?? [];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        background: "rgba(255,106,26,0.05)",
        border: "1px solid rgba(255,106,26,0.25)",
        borderRadius: 8,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          padding: "2px 7px",
          borderRadius: 4,
          background: "rgba(255,106,26,0.14)",
          color: "var(--uff-orange)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {pin.benchmarkType}
      </span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--uff-text-mute)",
          }}
        >
          Breakdown
        </span>
        <span
          style={{
            fontSize: 11.5,
            color: "var(--uff-text-dim)",
            fontFamily: "var(--font-mono)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {positions.join(" · ")}
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={pending}
        aria-label="Remove breakdown pin"
        title="Remove breakdown pin"
        style={{
          height: 28,
          width: 28,
          padding: 0,
          borderRadius: 6,
          border: "1px solid var(--uff-line)",
          background: "rgba(255,255,255,0.02)",
          color: "var(--uff-text-mute)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

function AddBreakdownForm({
  benchmarkTypes,
  positionOptions,
  disabled,
  onAdd,
}: {
  benchmarkTypes: string[];
  positionOptions: string[];
  disabled: boolean;
  onAdd: (type: string, positions: string[]) => void;
}) {
  const [type, setType] = useState(benchmarkTypes[0] ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(pos: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos);
      else next.add(pos);
      return next;
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 8px",
        background: "transparent",
        border: "1px dashed var(--uff-line)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
          marginBottom: 2,
        }}
      >
        Pin a breakdown card
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={disabled}
          style={{
            height: 28,
            padding: "0 6px",
            background: "var(--uff-surface)",
            border: "1px solid var(--uff-line)",
            borderRadius: 6,
            color: "var(--uff-text)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
          }}
        >
          {benchmarkTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (!type || selected.size === 0) return;
            onAdd(type, Array.from(selected));
            setSelected(new Set());
          }}
          disabled={disabled || !type || selected.size === 0}
          className="wbtn primary"
          style={{
            height: 28,
            padding: "0 10px",
            fontSize: 11.5,
            marginLeft: "auto",
          }}
        >
          + Pin breakdown
        </button>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        {positionOptions.map((pos) => {
          const on = selected.has(pos);
          return (
            <button
              key={pos}
              type="button"
              onClick={() => toggle(pos)}
              disabled={disabled}
              aria-pressed={on}
              style={{
                height: 24,
                padding: "0 8px",
                borderRadius: 4,
                border: on
                  ? "1px solid var(--uff-orange)"
                  : "1px solid var(--uff-line)",
                background: on
                  ? "rgba(255,106,26,0.18)"
                  : "rgba(255,255,255,0.02)",
                color: on ? "var(--uff-orange)" : "var(--uff-text-dim)",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
              }}
            >
              {pos}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddSliceForm({
  benchmarkTypes,
  positionOptions,
  disabled,
  onAdd,
}: {
  benchmarkTypes: string[];
  positionOptions: string[];
  disabled: boolean;
  onAdd: (type: string, position: string | null) => void;
}) {
  const [type, setType] = useState(benchmarkTypes[0] ?? "");
  const [position, setPosition] = useState<string>(""); // "" = all

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        background: "transparent",
        border: "1px dashed var(--uff-line)",
        borderRadius: 8,
      }}
    >
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        disabled={disabled}
        style={{
          height: 28,
          padding: "0 6px",
          background: "var(--uff-surface)",
          border: "1px solid var(--uff-line)",
          borderRadius: 6,
          color: "var(--uff-text)",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        {benchmarkTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        value={position}
        onChange={(e) => setPosition(e.target.value)}
        disabled={disabled}
        style={{
          flex: 1,
          height: 28,
          padding: "0 6px",
          background: "var(--uff-surface)",
          border: "1px solid var(--uff-line)",
          borderRadius: 6,
          color: "var(--uff-text)",
          fontSize: 12,
        }}
      >
        <option value="">All positions</option>
        {positionOptions.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onAdd(type, position || null)}
        disabled={disabled || !type}
        className="wbtn primary"
        style={{ height: 28, padding: "0 10px", fontSize: 11.5 }}
      >
        + Pin
      </button>
    </div>
  );
}
