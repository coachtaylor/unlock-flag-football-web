// 8-week × 7-day heatmap. Each cell is the # of practices on that day.
// Intensity 0..3 controlled by the data layer.

import type { CadenceData } from "@/lib/dashboard/team-home-data";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function CadenceHeatmap({ data }: { data: CadenceData }) {
  const grid = new Array(data.weeks * 7).fill(0);
  for (const c of data.cells) grid[c.week * 7 + c.day] = c.intensity;

  const tone = (v: number) =>
    v === 0
      ? "rgba(255,255,255,0.04)"
      : v === 1
      ? "rgba(255,106,26,0.25)"
      : v === 2
      ? "rgba(255,106,26,0.55)"
      : "rgba(255,106,26,0.95)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "24px repeat(7, 1fr)",
          gap: 4,
          fontSize: 9.5,
          color: "var(--uff-text-mute)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.08em",
        }}
      >
        <span />
        {DAYS.map((d, i) => (
          <span key={i} style={{ textAlign: "center" }}>
            {d}
          </span>
        ))}
      </div>
      {Array.from({ length: data.weeks }).map((_, r) => (
        <div
          key={r}
          style={{
            display: "grid",
            gridTemplateColumns: "24px repeat(7, 1fr)",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              color: "var(--uff-text-mute)",
              fontFamily: "var(--font-mono)",
              alignSelf: "center",
            }}
          >
            W{data.weeks - r}
          </span>
          {Array.from({ length: 7 }).map((__, c) => (
            <div
              key={c}
              style={{
                aspectRatio: "1.4 / 1",
                borderRadius: 4,
                background: tone(grid[r * 7 + c]),
                border: "1px solid rgba(255,255,255,0.03)",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
