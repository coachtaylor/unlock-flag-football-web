// PAUSED: Individual QB tracking is on hold while the Coach/Team MVP is the focus.
// This route is no longer linked from the bottom nav. Do not extend; preserved for resumption.
// Progress — charts and trends over time.
// Elbow pain trends, muscle group balance, game performance by format.
// This is a read-only data visualization screen.

export default function Progress() {
  return (
    <div className="pt-3xl">
      <h1 className="text-title font-medium" style={{ color: "var(--color-text-primary)" }}>
        Progress
      </h1>
      <p className="text-caption mt-xs" style={{ color: "var(--color-text-secondary)" }}>
        Your trends and development over time.
      </p>

      <div className="mt-2xl p-lg rounded-lg" style={{ backgroundColor: "var(--color-blue-800)" }}>
        <p className="label-micro" style={{ color: "var(--color-blue-400)" }}>Elbow pain vs. throwing volume</p>
        <div className="mt-lg" style={{ height: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p className="text-caption" style={{ color: "var(--color-text-muted)" }}>Chart goes here (Recharts)</p>
        </div>
      </div>

      <div className="mt-lg p-lg rounded-lg" style={{ backgroundColor: "var(--color-surface-raised)" }}>
        <p className="label-micro">Game performance</p>
        <div className="mt-lg" style={{ height: "120px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p className="text-caption" style={{ color: "var(--color-text-muted)" }}>Performance trend chart goes here</p>
        </div>
      </div>
    </div>
  );
}
