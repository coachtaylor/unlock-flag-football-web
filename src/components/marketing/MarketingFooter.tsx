import BrandLockup from "./BrandLockup";

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          marginBottom: 18,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {links.map((l) => (
          <a
            key={l}
            href="#"
            style={{
              color: "var(--text-secondary)",
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            {l}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function MarketingFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-default-uff)",
        padding: "64px 48px 40px",
        background: "var(--surface-base)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
          gap: 48,
          marginBottom: 56,
          maxWidth: 1440,
          margin: "0 auto 56px",
        }}
      >
        <div>
          <BrandLockup size="large" />
          <p
            style={{
              marginTop: 16,
              fontSize: 14,
              color: "var(--text-secondary)",
              maxWidth: 320,
              lineHeight: 1.6,
            }}
          >
            Built captain-to-captain. The drill library and practice planner you wish
            your last coach had.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            <span className="pill pill-ghost mono">v 0.4 · early access</span>
          </div>
        </div>
        <FooterCol
          title="Product"
          links={["Features", "Diagram builder", "Practice planner", "Dashboard"]}
        />
        <FooterCol
          title="Company"
          links={["About", "Contact", "Changelog", "Press kit"]}
        />
        <FooterCol title="Legal" links={["Privacy", "Terms", "Security"]} />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 24,
          borderTop: "1px solid var(--border-subtle-uff)",
          fontSize: 12,
          color: "var(--text-muted)",
          maxWidth: 1440,
          margin: "0 auto",
        }}
      >
        <span className="mono">© {new Date().getFullYear()} Unlock Flag Football. All plays reserved.</span>
        <span className="mono">unlockflagfootball.com</span>
      </div>
    </footer>
  );
}
