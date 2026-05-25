// PAUSED: Individual QB tracking is on hold while the Coach/Team MVP is the focus.
// This route is no longer linked from the bottom nav. Do not extend; preserved for resumption.
// Route library — 10 pre-seeded flag football routes.
// Each entry: name, description, best formations, diagram (future).

export default function Routes() {
  return (
    <div className="pt-3xl">
      <h1 className="text-title font-medium" style={{ color: "var(--color-text-primary)" }}>Routes</h1>
      <p className="text-caption mt-xs" style={{ color: "var(--color-text-secondary)" }}>10 flag football routes</p>
      <div className="mt-2xl p-lg rounded-lg" style={{ backgroundColor: "var(--color-surface-raised)" }}>
        <p className="text-body" style={{ color: "var(--color-text-muted)" }}>Route cards will load from Supabase here.</p>
      </div>
    </div>
  );
}
