import SectionHead from "./SectionHead";
import CadenceHeatmap from "./CadenceHeatmap";
import type { CadenceData } from "@/lib/dashboard/team-home-data";

export default function PracticeCadenceCard({ data }: { data: CadenceData }) {
  const hasData = data.cells.length > 0;
  return (
    <div className="w-card">
      <SectionHead label="Practice cadence" meta={`${data.weeks} WEEKS`} />
      {hasData ? <CadenceHeatmap data={data} /> : (
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
          Schedule a practice to start filling the heatmap.
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 14,
          fontSize: 11.5,
        }}
      >
        <Stat label="Avg per week" v={data.avgPerWeek.toFixed(1)} />
        <Stat label="Avg duration" v={data.avgDurationMin ? `${data.avgDurationMin}m` : "—"} />
        <Stat
          label="Streak"
          v={data.streakWeeks > 0 ? `${data.streakWeeks}w` : "—"}
          tone={data.streakWeeks > 0 ? "lime" : undefined}
        />
      </div>
    </div>
  );
}

function Stat({ label, v, tone }: { label: string; v: string; tone?: "lime" }) {
  return (
    <div>
      <div
        style={{
          color: "var(--uff-text-mute)",
          fontSize: 10.5,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 16,
          fontWeight: 700,
          color: tone === "lime" ? "var(--uff-lime)" : "var(--uff-text)",
        }}
      >
        {v}
      </div>
    </div>
  );
}
