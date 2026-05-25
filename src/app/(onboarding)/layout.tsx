// Onboarding route group. Each page renders its own OnbStage with the
// correct step number; the layout just plants the background color and
// keeps Next from inheriting the (app) sidebar shell.

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--uff-ink)" }}>
      {children}
    </div>
  );
}
