export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="uff"
      style={{
        minHeight: "100dvh",
        background: "var(--surface-base)",
        color: "var(--text-primary)",
      }}
    >
      {children}
    </div>
  );
}
