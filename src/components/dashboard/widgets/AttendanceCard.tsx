// Build 7 plan widget: attendance % w/ delta, sparkline, offense-vs-defense
// split, top 3 streaks. Lives next to the cadence heatmap; cadence shows
// "did we practice?", attendance shows "did the team show up?"

import SectionHead from "./SectionHead";
import Spark from "./Spark";
import type { AttendanceData } from "@/lib/dashboard/team-home-data";

function pct(n: number | null) {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

export default function AttendanceCard({ data }: { data: AttendanceData }) {
  if (data.rate == null) {
    return (
      <div className="w-card">
        <SectionHead label="Attendance" meta="LOCKED" />
        <div
          style={{
            border: "1px dashed var(--uff-line)",
            borderRadius: 10,
            padding: 18,
            textAlign: "center",
            color: "var(--uff-text-dim)",
            fontSize: 12.5,
          }}
        >
          Log attendance on a completed practice to unlock this widget.
        </div>
      </div>
    );
  }

  return (
    <div className="w-card">
      <SectionHead label="Attendance" meta="LAST 7 PRACTICES" />
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--uff-text)",
            }}
          >
            {pct(data.rate)}
          </span>
          {data.deltaPct != null && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                fontWeight: 700,
                color: data.deltaPct >= 0 ? "var(--uff-lime)" : "var(--uff-red)",
              }}
            >
              {data.deltaPct >= 0 ? "+" : "−"}
              {Math.abs(Math.round(data.deltaPct))}% vs prior
            </span>
          )}
        </div>
        <Spark
          data={data.series.length ? data.series : [0]}
          color="#6EA8FF"
          w={120}
          h={36}
        />
      </div>

      {(data.offensePct != null || data.defensePct != null) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <SideBar label="Offense" pct={data.offensePct} color="#FF6A1A" />
          <SideBar label="Defense" pct={data.defensePct} color="#FF4D4D" />
        </div>
      )}

      <div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--uff-text-mute)",
            marginBottom: 8,
          }}
        >
          Streaks
        </div>
        {data.streaks.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--uff-text-dim)" }}>
            No active streaks. Log a completed practice with attendance.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.streaks.map((s) => (
              <div key={s.playerId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: s.color,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#0a0a0d",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {s.name
                    .split(/\s+/)
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <span
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    color: "var(--uff-text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.name}
                </span>
                <span style={{ display: "flex", gap: 3 }}>
                  {Array.from({ length: Math.min(7, s.streak) }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: "var(--uff-lime)",
                        opacity: 0.4 + (i / 7) * 0.6,
                      }}
                    />
                  ))}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "var(--uff-lime)",
                    minWidth: 32,
                    textAlign: "right",
                  }}
                >
                  {s.streak}×
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SideBar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number | null;
  color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
      <span style={{ width: 60, color: "var(--uff-text-dim)" }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 8,
          background: "var(--uff-surface-2)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: pct != null ? `${Math.max(0, Math.min(100, pct))}%` : 0,
            height: "100%",
            background: color,
            opacity: 0.85,
            borderRadius: 4,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: pct != null ? "var(--uff-text)" : "var(--uff-text-mute)",
          minWidth: 38,
          textAlign: "right",
        }}
      >
        {pct != null ? `${Math.round(pct)}%` : "—"}
      </span>
    </div>
  );
}
