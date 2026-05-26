// Locked-insight card for benchmark types a drill supports but has no
// data on yet (e.g. drill has benchmark_types=['timed','pct'] but the
// player has only been measured on 'timed'). Same shape as a
// BenchmarkProgressChart so the layout reads consistently.

type Props = {
  drillName: string;
  type: string; // benchmark type label
  accent: string;
  /** What action unlocks the chart, e.g. "Capture a pct rep to unlock progress" */
  hint?: string;
  height?: number;
};

const DEFAULT_HINTS: Record<string, string> = {
  timed: "Record a timed rep to unlock this chart",
  rated: "Rate this drill to unlock progress",
  reps: "Log reps to unlock progress",
  pct: "Capture made/attempts to unlock %",
  flags: "Log flag pulls to unlock progress",
  drops: "Log drops to unlock progress",
};

export default function LockedBenchmarkChart({
  drillName,
  type,
  accent,
  hint,
  height = 110,
}: Props) {
  const message = hint ?? DEFAULT_HINTS[type] ?? "Log a benchmark to unlock progress";
  return (
    <div
      style={{
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        border: "1px dashed var(--uff-line)",
        borderRadius: 8,
        padding: "0 14px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: accent,
          fontFamily: "var(--font-mono)",
        }}
      >
        {type} · locked
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: "var(--uff-text-mute)",
          lineHeight: 1.4,
        }}
      >
        {message} on <b style={{ color: "var(--uff-text-dim)" }}>{drillName}</b>
      </div>
    </div>
  );
}
