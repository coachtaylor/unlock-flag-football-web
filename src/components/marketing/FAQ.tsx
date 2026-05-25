const ITEMS = [
  {
    q: "Is this just the mobile app on a bigger screen?",
    a: "No. Same data, different surface. Mobile is for the field — quick taps, one-handed logging. Web is for the desk — building a drill library from video, planning a full practice in three panes, reviewing the dashboard with charts. Whatever you do on one shows up on the other instantly.",
  },
  {
    q: "Do players need accounts?",
    a: "Not yet. The captain is the only required user. You build a roster of players (name + jersey, no email needed) and the dashboard rolls up everything they do. A player-facing experience is on the roadmap, not the launch.",
  },
  {
    q: "What's the catch with early access?",
    a: "Free to use while we're shipping the coach MVP. We're working with a handful of teams to harden the dashboard and the diagram builder. When pricing lands, early teams stay grandfathered on a forever-free tier.",
  },
  {
    q: "Will it work on my phone browser?",
    a: "Yes — every layout collapses to a single column on mobile, every interaction works on touch. The native iOS and Android apps are the recommended way to log practice, but the web app on your phone is a fine fallback.",
  },
  {
    q: "How is this different from a spreadsheet?",
    a: "A spreadsheet doesn't know what a slant route is. We do. Drills carry diagrams, categories, and benchmark history. Players carry positions, jersey numbers, and progress curves. The dashboard tells you what your team's actually weak at, not whatever you happen to remember.",
  },
  {
    q: "Can I import drills from elsewhere?",
    a: "Not in v1. The build-from-scratch flow is fast enough — paste a YouTube link, drag cones on the field, write your setup notes. We're watching to see if import becomes a real bottleneck before we build it.",
  },
];

export default function FAQ() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {ITEMS.map((it, i) => (
        <details
          key={it.q}
          open={i === 0}
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-card)",
            borderRadius: 14,
            padding: "20px 24px",
            cursor: "pointer",
          }}
        >
          <summary
            style={{
              listStyle: "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            <span>{it.q}</span>
            <span className="mono" style={{ color: "var(--text-muted)", fontSize: 18 }}>+</span>
          </summary>
          <p
            style={{
              marginTop: 14,
              fontSize: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.65,
            }}
          >
            {it.a}
          </p>
        </details>
      ))}
    </div>
  );
}
