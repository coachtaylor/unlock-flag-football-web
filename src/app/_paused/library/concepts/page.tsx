// PAUSED: Individual QB tracking is on hold while the Coach/Team MVP is the focus.
// This route is no longer linked from the bottom nav. Do not extend; preserved for resumption.
// Play concepts — 6 pre-seeded concepts with read progressions.
// Each entry: name, formation, primary/secondary/outlet reads, best vs. coverages.

export default function Concepts() {
  return (
    <div className="pt-3xl">
      <h1 className="text-title font-medium" style={{ color: "var(--color-text-primary)" }}>Play Concepts</h1>
      <p className="text-caption mt-xs" style={{ color: "var(--color-text-secondary)" }}>6 concepts with read progressions</p>
      <div className="mt-2xl p-lg rounded-lg" style={{ backgroundColor: "var(--color-surface-raised)" }}>
        <p className="text-body" style={{ color: "var(--color-text-muted)" }}>Play concept cards will load from Supabase here.</p>
      </div>
    </div>
  );
}
