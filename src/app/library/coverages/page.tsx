// PAUSED: Individual QB tracking is on hold while the Coach/Team MVP is the focus.
// This route is no longer linked from the bottom nav. Do not extend; preserved for resumption.
// Defensive coverages — 6 pre-seeded coverage looks.
// Each entry: name, description, strengths, weaknesses, key tells.

export default function Coverages() {
  return (
    <div className="pt-3xl">
      <h1 className="text-title font-medium" style={{ color: "var(--color-text-primary)" }}>Defensive Coverages</h1>
      <p className="text-caption mt-xs" style={{ color: "var(--color-text-secondary)" }}>6 coverage looks to study</p>
      <div className="mt-2xl p-lg rounded-lg" style={{ backgroundColor: "var(--color-surface-raised)" }}>
        <p className="text-body" style={{ color: "var(--color-text-muted)" }}>Coverage cards will load from Supabase here.</p>
      </div>
    </div>
  );
}
