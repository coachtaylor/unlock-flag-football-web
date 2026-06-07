// Streaming skeleton for the team dashboard. Mirrors the Build 7 layout:
// hero + next-practice row, KPI strip, trends + movers, 4-up quad, and
// activity + most-run. Uses the shared skeleton primitives so the shimmer +
// sidebar/topbar/section-head placeholders have one source across routes.

import {
  SkelStyles,
  SidebarSkeleton,
  TopbarSkeleton,
  SectionHeadSkeleton,
} from "@/components/dashboard/Skeleton";

export default function TeamDashboardLoading() {
  return (
    <div className="uff-web td-loading">
      <SidebarSkeleton />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopbarSkeleton />

        <div className="page" style={{ maxWidth: 1440, margin: "0 auto", width: "100%", gap: 20 }}>
          {/* Hero + Next */}
          <div className="td-skel-row td-skel-row-hero">
            <div className="w-card hero" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14, minHeight: 240 }}>
              <span className="uff-skel" style={{ width: 200, height: 11, borderRadius: 3 }} />
              <span className="uff-skel" style={{ width: "60%", maxWidth: 360, height: 28, borderRadius: 6 }} />
              <span className="uff-skel" style={{ width: "80%", height: 12, borderRadius: 3 }} />
              <span className="uff-skel" style={{ width: "70%", height: 12, borderRadius: 3 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 8 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="uff-skel" style={{ width: "70%", height: 10, borderRadius: 3 }} />
                    <span className="uff-skel" style={{ width: 60, height: 18, borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="w-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, minHeight: 240 }}>
              <SectionHeadSkeleton />
              <span className="uff-skel" style={{ width: "70%", height: 18, borderRadius: 4 }} />
              <span className="uff-skel" style={{ width: "50%", height: 12, borderRadius: 3 }} />
              <span className="uff-skel" style={{ width: "100%", height: 8, borderRadius: 999, marginTop: 8 }} />
              <span className="uff-skel" style={{ width: "60%", height: 12, borderRadius: 3 }} />
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, minHeight: 116 }}>
                <span className="uff-skel" style={{ width: "60%", height: 10, borderRadius: 3 }} />
                <span className="uff-skel" style={{ width: 70, height: 24, borderRadius: 4 }} />
                <span className="uff-skel" style={{ width: "100%", height: 28, borderRadius: 4 }} />
              </div>
            ))}
          </div>

          {/* Trends + Movers */}
          <div className="td-skel-row td-skel-row-trends">
            <div className="w-card" style={{ padding: 20, minHeight: 280, display: "flex", flexDirection: "column", gap: 12 }}>
              <SectionHeadSkeleton />
              <span className="uff-skel" style={{ width: "100%", height: 220, borderRadius: 6 }} />
            </div>
            <div className="w-card" style={{ padding: 20, minHeight: 280, display: "flex", flexDirection: "column", gap: 10 }}>
              <SectionHeadSkeleton />
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="uff-skel" style={{ width: "100%", height: 28, borderRadius: 4 }} />
              ))}
            </div>
          </div>

          {/* 4-up */}
          <div className="td-skel-row td-skel-row-quad">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-card" style={{ padding: 20, minHeight: 260, display: "flex", flexDirection: "column", gap: 10 }}>
                <SectionHeadSkeleton />
                <span className="uff-skel" style={{ width: "100%", height: 180, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <SkelStyles />
      <style>{`
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
