import type { HeroStats } from "@/lib/dashboard/team-home-data";

export default function HeroCard({
  greeting,
  weekLabel,
  practicesLogged,
  practicesPlanned,
  copy,
  stats,
}: {
  greeting: string;
  weekLabel: string;
  practicesLogged: number;
  practicesPlanned: number;
  copy: string;
  stats: HeroStats;
}) {
  const cells: { label: string; v: string; delta: string; tone?: "lime" }[] = [
    {
      label: "Squad benchmark",
      v:
        stats.squadDelta == null
          ? "—"
          : `${stats.squadDelta > 0 ? "+" : ""}${stats.squadDelta.toFixed(1)}%`,
      delta: "vs prior 4w",
      tone: stats.squadDelta != null && stats.squadDelta > 0 ? "lime" : undefined,
    },
    { label: "Drills logged", v: String(stats.drillsLogged), delta: "this period" },
    {
      label: "Streak",
      v: stats.streakWeeks > 0 ? `${stats.streakWeeks}w` : "—",
      delta: stats.streakWeeks > 0 ? "active" : "none",
    },
    {
      label: "Roster locked",
      v: `${stats.rosterLocked.benchmarked} / ${stats.rosterLocked.total}`,
      delta:
        stats.rosterLocked.benchmarked === stats.rosterLocked.total &&
        stats.rosterLocked.total > 0
          ? "all benchmarked"
          : "needs benchmarks",
    },
  ];

  return (
    <div
      className="w-card hero"
      style={{
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.16em",
            color: "var(--uff-orange)",
          }}
        >
          COACH CONSOLE · {weekLabel}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--uff-text-mute)",
            letterSpacing: "0.06em",
          }}
        >
          {practicesLogged} OF {practicesPlanned} PRACTICES LOGGED
        </span>
      </div>
      <div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            color: "var(--uff-text)",
          }}
        >
          {greeting}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "var(--uff-text-dim)",
            marginTop: 8,
            maxWidth: "60ch",
            lineHeight: 1.5,
          }}
        >
          {copy}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 18,
          marginTop: 4,
        }}
      >
        {cells.map((c, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--uff-text-mute)",
              }}
            >
              {c.label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: c.tone === "lime" ? "var(--uff-lime)" : "var(--uff-text)",
              }}
            >
              {c.v}
            </span>
            <span style={{ fontSize: 11, color: "var(--uff-text-dim)" }}>{c.delta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
