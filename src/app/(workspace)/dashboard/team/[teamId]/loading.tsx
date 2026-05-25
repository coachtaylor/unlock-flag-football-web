// Streaming skeleton for the team dashboard. Mirrors the real layout:
// sidebar + topbar + hero + stat strip + 2-col body (main+side at lg+).
// Avoids using the page's components so it stays cheap and decoupled.

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
          <span
            className="td-skel"
            style={{ width: 180, height: 18, borderRadius: 4 }}
          />
          <span style={{ flex: 1 }} />
          <span
            className="td-skel"
            style={{ width: 38, height: 38, borderRadius: 10 }}
          />
          <span
            className="td-skel"
            style={{ width: 38, height: 38, borderRadius: 9999 }}
          />
        </div>

        <div className="page" style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}>
          {/* Hero */}
          <div className="w-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="td-skel" style={{ width: 120, height: 10, borderRadius: 3 }} />
            <span className="td-skel" style={{ width: "60%", maxWidth: 320, height: 28, borderRadius: 6 }} />
            <span className="td-skel" style={{ width: 180, height: 12, borderRadius: 3 }} />
          </div>

          {/* Stat strip */}
          <div className="w-card td-stat-strip">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="td-stat-cell" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <span className="td-skel" style={{ width: 60, height: 10, borderRadius: 3 }} />
                <span className="td-skel" style={{ width: 48, height: 22, borderRadius: 4 }} />
              </div>
            ))}
          </div>

          {/* Body: main + side */}
          <div className="td-body-grid">
            <div className="td-body-main">
              <SectionHeadSkeleton />
              <div className="td-overview-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <span className="td-skel" style={{ width: "60%", height: 13, borderRadius: 3 }} />
                      <span className="td-skel" style={{ width: "40%", height: 10, borderRadius: 3 }} />
                    </div>
                    <span className="td-skel" style={{ width: 56, height: 14, borderRadius: 3 }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="td-body-side">
              <div>
                <SectionHeadSkeleton />
                <div className="w-card" style={{ padding: 0, overflow: "hidden" }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        borderTop: i === 0 ? undefined : "1px solid var(--uff-line-soft)",
                      }}
                    >
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                        <span className="td-skel" style={{ width: "70%", height: 13, borderRadius: 3 }} />
                        <span className="td-skel" style={{ width: "50%", height: 10, borderRadius: 3 }} />
                      </div>
                      <span className="td-skel" style={{ width: 40, height: 14, borderRadius: 3 }} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <SectionHeadSkeleton />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="w-card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                        <span className="td-skel" style={{ width: "60%", height: 13, borderRadius: 3 }} />
                        <span className="td-skel" style={{ width: "40%", height: 10, borderRadius: 3 }} />
                      </div>
                      <span className="td-skel" style={{ width: 64, height: 12, borderRadius: 3 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
