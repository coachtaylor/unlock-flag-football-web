import Link from "next/link";
import BrandLockup from "@/components/marketing/BrandLockup";

export default function AuthLayout({
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
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* accent glow behind the card */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -250,
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 600,
          background:
            "radial-gradient(ellipse, var(--accent-glow), transparent 60%)",
          pointerEvents: "none",
          opacity: 0.5,
        }}
      />

      <header
        className="uff-auth-header"
        style={{
          padding: "24px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <BrandLockup />
        </Link>
        <Link
          href="/"
          style={{
            color: "var(--text-secondary)",
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          ← Back to home
        </Link>
      </header>

      <main
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: 24,
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </main>

      <footer
        className="uff-auth-footer"
        style={{
          padding: "24px 40px",
          borderTop: "1px solid var(--border-subtle-uff)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: 1,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span>v 0.4 · early access</span>
        <span>unlockflagfootball.com</span>
      </footer>
    </div>
  );
}
