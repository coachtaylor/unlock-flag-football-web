export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--color-surface-base)",
      }}
    >
      <main
        className="flex-1 flex items-center justify-center"
        style={{ paddingInline: "20px", paddingBlock: "32px" }}
      >
        {children}
      </main>
    </div>
  );
}
