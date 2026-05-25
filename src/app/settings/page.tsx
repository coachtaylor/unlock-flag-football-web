// User settings — profile, theme toggle, account management.

export default function Settings() {
  return (
    <div className="pt-3xl">
      <h1 className="text-title font-medium" style={{ color: "var(--color-text-primary)" }}>Settings</h1>
      <div className="mt-2xl p-lg rounded-lg" style={{ backgroundColor: "var(--color-surface-raised)" }}>
        <p className="text-body" style={{ color: "var(--color-text-muted)" }}>Profile, theme toggle, and account settings go here.</p>
      </div>
    </div>
  );
}
