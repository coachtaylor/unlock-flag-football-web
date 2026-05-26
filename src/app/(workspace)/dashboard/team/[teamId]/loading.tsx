// Streaming skeleton for the team dashboard. Mirrors the Build 7 layout:
// hero + next-practice row, KPI strip, trends + movers, 4-up quad, and
// activity + most-run. Avoids importing the page's components so the
// skeleton stays cheap and decoupled.

export default function TeamDashboardLoading() {
  return (
    <div className="uff-web td-loading">
      <aside className="sidebar">
        <SidebarBrandSkeleton />
        <div className="navlbl">Team</div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="navitem">
            <span className="td-skel" style={{ width: 18, height: 18, borderRadius: 4 }} />
            <span className="td-skel" style={{ flex: 1, height: 12, borderRadius: 3 }} />
          </div>
        ))}
        <div className="spacer" />
      </aside>

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div className="topbar">
          <span className="td-skel" style={{ width: 180, height: 18, borderRadius: 4 }} />
          <span style={{ flex: 1 }} />
          <span className="td-skel" style={{ width: 38, height: 38, borderRadius: 10 }} />
          <span className="td-skel" style={{ width: 38, height: 38, borderRadius: 9999 }} />
        </div>

        <div className="page" style={{ maxWidth: 1440, margin: "0 auto", width: "100%", gap: 20 }}>
          {/* Hero + Next */}
          <div className="td-skel-row td-skel-row-hero">
            <div className="w-card hero" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14, minHeight: 240 }}>
              <span className="td-skel" style={{ width: 200, height: 11, borderRadius: 3 }} />
              <span className="td-skel" style={{ width: "60%", maxWidth: 360, height: 28, borderRadius: 6 }} />
              <span className="td-skel" style={{ width: "80%", height: 12, borderRadius: 3 }} />
              <span className="td-skel" style={{ width: "70%", height: 12, borderRadius: 3 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 8 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="td-skel" style={{ width: "70%", height: 10, borderRadius: 3 }} />
                    <span className="td-skel" style={{ width: 60, height: 18, borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="w-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, minHeight: 240 }}>
              <SectionHeadSkeleton />
              <span className="td-skel" style={{ width: "70%", height: 18, borderRadius: 4 }} />
              <span className="td-skel" style={{ width: "50%", height: 12, borderRadius: 3 }} />
              <span className="td-skel" style={{ width: "100%", height: 8, borderRadius: 999, marginTop: 8 }} />
              <span className="td-skel" style={{ width: "60%", height: 12, borderRadius: 3 }} />
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, minHeight: 116 }}>
                <span className="td-skel" style={{ width: "60%", height: 10, borderRadius: 3 }} />
                <span className="td-skel" style={{ width: 70, height: 24, borderRadius: 4 }} />
                <span className="td-skel" style={{ width: "100%", height: 28, borderRadius: 4 }} />
              </div>
            ))}
          </div>

          {/* Trends + Movers */}
          <div className="td-skel-row td-skel-row-trends">
            <div className="w-card" style={{ padding: 20, minHeight: 280, display: "flex", flexDirection: "column", gap: 12 }}>
              <SectionHeadSkeleton />
              <span className="td-skel" style={{ width: "100%", height: 220, borderRadius: 6 }} />
            </div>
            <div className="w-card" style={{ padding: 20, minHeight: 280, display: "flex", flexDirection: "column", gap: 10 }}>
              <SectionHeadSkeleton />
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="td-skel" style={{ width: "100%", height: 28, borderRadius: 4 }} />
              ))}
            </div>
          </div>

          {/* 4-up */}
          <div className="td-skel-row td-skel-row-quad">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-card" style={{ padding: 20, minHeight: 260, display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionHeadSkeleton />
                <span className="td-skel" style={{ width: "100%", height: 180, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .td-skel {
          display: inline-block;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: td-skel-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes td-skel-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .td-skel-row { display: grid; gap: 16px; grid-template-columns: 1fr; }
        @media (min-width: 1024px) {
          .td-skel-row-hero { grid-template-columns: 1.4fr 1fr; }
          .td-skel-row-trends { grid-template-columns: 1.6fr 1fr; }
          .td-skel-row-quad { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1280px) {
          .td-skel-row-quad { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </div>
  );
}

function SidebarBrandSkeleton() {
  return (
    <div className="brand">
      <span className="td-skel" style={{ width: 32, height: 32, borderRadius: 9 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="td-skel" style={{ width: 80, height: 11, borderRadius: 3 }} />
        <span className="td-skel" style={{ width: 60, height: 9, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function SectionHeadSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 3, height: 14, background: "var(--uff-line)", borderRadius: 2 }} />
      <span className="td-skel" style={{ width: 120, height: 13, borderRadius: 3 }} />
    </div>
  );
}
