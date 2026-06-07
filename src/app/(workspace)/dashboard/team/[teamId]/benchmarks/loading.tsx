// Streaming skeleton for the Team Scouting Report. Mirrors the scout-page spine
// (§0 decision card → §1 rooms 3-up → §2 movement chips → §3 player cards) so
// the shell doesn't jump when real data lands. Reuses the shared skeleton
// primitives; layout grids are inlined here (the page's .scout-* classes live in
// the page's own <style>, not globally).

import {
  Skel,
  SkelStyles,
  SidebarSkeleton,
  TopbarSkeleton,
  SectionHeadSkeleton,
} from "@/components/dashboard/Skeleton";

export default function ScoutingLoading() {
  return (
    <div className="uff-web">
      <SidebarSkeleton />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopbarSkeleton />

        <div
          className="page"
          style={{ maxWidth: 1200, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 16 }}
        >
          {/* §0 — decision card */}
          <div
            className="w-card"
            style={{ padding: 20, borderLeft: "3px solid var(--uff-line)", display: "flex", flexDirection: "column", gap: 12 }}
          >
            <Skel w={120} h={11} r={3} />
            <Skel w="72%" h={22} r={5} />
            <Skel w="55%" h={13} r={3} />
            <Skel w={150} h={34} r={8} style={{ marginTop: 4 }} />
          </div>

          {/* §1 — position rooms (3-up) */}
          <div className="w-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionHeadSkeleton />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid var(--uff-line-soft)",
                    borderRadius: 10,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Skel w={80} h={13} r={3} />
                    <Skel w={28} h={28} r={8} />
                  </div>
                  <Skel w="60%" h={11} r={3} />
                  <Skel w="75%" h={11} r={3} />
                </div>
              ))}
            </div>
          </div>

          {/* §2 — movement chips */}
          <div className="w-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionHeadSkeleton />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skel key={i} w={150} h={32} r={999} />
              ))}
            </div>
          </div>

          {/* §3 — player report cards */}
          <div className="w-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionHeadSkeleton />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid var(--uff-line-soft)",
                    borderRadius: 10,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Skel w={30} h={30} r={9999} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                      <Skel w="70%" h={13} r={3} />
                      <Skel w={48} h={11} r={3} />
                    </div>
                    <Skel w={30} h={30} r={8} />
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Skel key={j} w={56} h={18} r={6} />
                    ))}
                  </div>
                  <Skel w="80%" h={11} r={3} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SkelStyles />
    </div>
  );
}
