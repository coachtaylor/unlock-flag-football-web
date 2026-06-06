import Link from "next/link";
import SectionHead from "./SectionHead";
import type { MostRunDrill } from "@/lib/dashboard/team-home-data";

export default function MostRunDrillsCard({
  rows,
  teamId,
}: {
  rows: MostRunDrill[];
  teamId: string;
}) {
  // Team-scoped drills base (Build 8) — flat /drills now redirects to /dashboard.
  const drillsBase = `/dashboard/team/${teamId}/drills`;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="w-card">
      <SectionHead label="Most-run drills" meta="LAST 4 WEEKS" />
      {rows.length === 0 ? (
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
          Complete a practice to see which drills get the most reps.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((r) => (
            <div
              key={r.drillId}
              style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}
            >
              <Link
                href={`${drillsBase}/${r.drillId}`}
                style={{
                  width: 110,
                  color: "var(--uff-text-dim)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.drillName}
              </Link>
              <div
                style={{
                  flex: 1,
                  height: 14,
                  background: "var(--uff-surface-2)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(r.count / max) * 100}%`,
                    background: r.categoryColor,
                    height: "100%",
                    borderRadius: 4,
                    opacity: 0.85,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--uff-text)",
                  minWidth: 36,
                  textAlign: "right",
                }}
              >
                {r.count}×
              </span>
            </div>
          ))}
        </div>
      )}
      <Link
        href={drillsBase}
        className="wbtn ghost"
        style={{ width: "100%", marginTop: 12, justifyContent: "center" }}
      >
        Open drill library
      </Link>
    </div>
  );
}
