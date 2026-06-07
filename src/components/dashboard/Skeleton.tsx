// Shared shimmer-skeleton primitives — one source for every route loading.tsx
// (team dashboard, scouting report, …). Layout shells reuse the global .uff-web
// classes (.sidebar/.topbar/.page/.w-card); only the shimmer span + the common
// sidebar/topbar/section-head placeholders live here so they never drift.
// Server-safe (no hooks) — importable by Server Component loading.tsx files.

import type { CSSProperties } from "react";

export function Skel({
  w,
  h,
  r = 4,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number;
  style?: CSSProperties;
}) {
  return <span className="uff-skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// Renders the shimmer keyframe once. Include exactly one per loading.tsx.
export function SkelStyles() {
  return (
    <style>{`
      .uff-skel {
        display: inline-block;
        background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
        background-size: 200% 100%;
        animation: uff-skel-shimmer 1.4s ease-in-out infinite;
      }
      @keyframes uff-skel-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  );
}

export function SidebarSkeleton({ items = 6 }: { items?: number }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <Skel w={32} h={32} r={9} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Skel w={80} h={11} r={3} />
          <Skel w={60} h={9} r={3} />
        </div>
      </div>
      <div className="navlbl">Team</div>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="navitem">
          <Skel w={18} h={18} r={4} />
          <Skel h={12} r={3} style={{ flex: 1 }} />
        </div>
      ))}
      <div className="spacer" />
    </aside>
  );
}

export function TopbarSkeleton() {
  return (
    <div className="topbar">
      <Skel w={180} h={18} r={4} />
      <span style={{ flex: 1 }} />
      <Skel w={38} h={38} r={10} />
      <Skel w={38} h={38} r={9999} />
    </div>
  );
}

export function SectionHeadSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 3, height: 14, background: "var(--uff-line)", borderRadius: 2 }} />
      <Skel w={120} h={13} r={3} />
    </div>
  );
}
