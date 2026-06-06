import SectionHead from "./SectionHead";
import CategoryDonut from "./CategoryDonut";
import type { DrillMixEntry } from "@/lib/dashboard/team-home-data";

export default function DrillMixCard({
  entries,
  total,
  underweight,
}: {
  entries: DrillMixEntry[];
  total: number;
  underweight: string | null;
}) {
  return (
    <div className="w-card">
      <SectionHead label="Drill mix" meta={`4 WK · ${total} RUNS`} />
      {total === 0 ? (
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
          Log a completed practice to see your drill mix.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <CategoryDonut entries={entries} size={120} stroke={12} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {entries.slice(0, 5).map((e) => (
                <div
                  key={e.key}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 2,
                      background: e.color,
                    }}
                  />
                  <span style={{ flex: 1, color: "var(--uff-text-dim)" }}>{e.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--uff-text)" }}>
                    {e.count}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      color: "var(--uff-text-mute)",
                      minWidth: 32,
                      textAlign: "right",
                    }}
                  >
                    {Math.round((e.count / total) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          {underweight && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "rgba(255,77,77,0.06)",
                border: "1px solid rgba(255,77,77,0.18)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                color: "#FF8A8A",
              }}
            >
              <span style={{ fontSize: 14 }}>⚠</span>
              <span>
                {underweight[0].toUpperCase() + underweight.slice(1)} ratio is below 15%. Consider
                adding more.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
