import Link from "next/link";
import BrandLockup from "./BrandLockup";

const navLinkStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: 0.1,
};

export default function MarketingNav({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 48px",
        borderBottom: "1px solid transparent",
        background: "transparent",
        position: "relative",
        zIndex: 10,
      }}
    >
      <Link href="/" style={{ textDecoration: "none" }}>
        <BrandLockup size="xl" />
      </Link>
      <nav style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <a href="#features" style={navLinkStyle}>Features</a>
        <a href="#how" style={navLinkStyle}>How it works</a>
        <a href="#faq" style={navLinkStyle}>FAQ</a>
        <span style={{ width: 1, height: 16, background: "var(--border-default-uff)" }} />
        {loggedIn ? (
          <Link
            href="/dashboard"
            className="btn btn-primary"
            style={{ padding: "10px 18px", fontSize: 14 }}
          >
            Go to dashboard <span style={{ opacity: 0.7 }}>→</span>
          </Link>
        ) : (
          <>
            <Link href="/login" style={navLinkStyle}>Log in</Link>
            <Link
              href="/signup"
              className="btn btn-primary"
              style={{ padding: "10px 18px", fontSize: 14 }}
            >
              Sign up free
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
