import Link from "next/link";

type Props = {
  searchParams: Promise<{ email?: string }>;
};

export default async function CheckEmailPage({ searchParams }: Props) {
  const { email = "your inbox" } = await searchParams;

  return (
    <div style={{ width: "100%", maxWidth: 460 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "var(--accent-tint)",
            border: "1px solid var(--accent-tint-border)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 0 60px var(--accent-glow)",
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M2 7l10 7 10-7" />
          </svg>
        </div>
      </div>

      <div
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--accent)",
          letterSpacing: 2,
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        ✓ Account created
      </div>
      <h1
        style={{
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: -1,
          textAlign: "center",
          lineHeight: 1.1,
          marginBottom: 16,
        }}
        className="uff-auth-headline"
      >
        Check your email.
      </h1>
      <p
        style={{
          fontSize: 15,
          color: "var(--text-secondary)",
          textAlign: "center",
          lineHeight: 1.55,
          marginBottom: 32,
          maxWidth: "44ch",
          margin: "0 auto 32px",
        }}
      >
        We sent a confirmation link to{" "}
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{email}</span>.
        Tap the link to activate your account, then come back here to sign in.
      </p>

      <div
        className="card"
        style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}
      >
        {[
          {
            n: 1,
            t: "Open the email from Unlock",
            s: 'Subject: "Confirm your captain account"',
          },
          {
            n: 2,
            t: 'Tap "Confirm my account"',
            s: "You'll land back here, signed in.",
          },
          {
            n: 3,
            t: "Set up your team",
            s: "Name, color, league. About a minute.",
          },
        ].map((step) => (
          <div
            key={step.n}
            style={{ display: "flex", alignItems: "flex-start", gap: 14 }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "var(--surface-elevated)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--accent)",
              }}
            >
              {step.n}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                {step.t}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {step.s}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--text-secondary)",
          flexWrap: "wrap",
        }}
      >
        <span>No email?</span>
        <Link
          href="/signup"
          style={{
            color: "var(--accent)",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Try again
        </Link>
        <span style={{ color: "var(--text-muted)" }}>·</span>
        <Link
          href="/login"
          style={{
            color: "var(--accent)",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          I'll log in instead
        </Link>
      </div>
    </div>
  );
}
