import Link from "next/link";
import SectionHead from "./SectionHead";
import type { ActivityRow } from "@/lib/dashboard/team-home-data";

const CAT_COLOR: Record<string, string> = {
  offense: "#FF6A1A",
  defense: "#FF4D4D",
  footwork: "#C2FF3D",
  routes: "#6EA8FF",
  conditioning: "#B89BFF",
  qb: "#7DDFD2",
  flag: "#FF6A8B",
  fundamentals: "#FFB347",
};

export default function RecentActivityCard({
  rows,
  teamId,
  needsReviewCount,
}: {
  rows: ActivityRow[];
  teamId: string;
  needsReviewCount: number;
}) {
  return (
    <div className="w-card">
      <SectionHead label="Recent activity" meta="LAST 7 DAYS" />
      {needsReviewCount > 0 && (
        <Link
          href={`/dashboard/team/${teamId}/review`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
            marginBottom: 12,
            borderRadius: 10,
            border: "1px solid rgba(255, 138, 48, 0.32)",
            background: "rgba(255, 138, 48, 0.08)",
            color: "var(--uff-text)",
            textDecoration: "none",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 9999,
                background: "var(--color-orange-500, #D48A30)",
                color: "#0D1117",
                fontWeight: 600,
              }}
            >
              {needsReviewCount}
            </span>
            <span style={{ fontSize: 13 }}>
              flagged for review
            </span>
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--uff-text-dim)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Open queue →
          </span>
        </Link>
      )}
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
          Nothing logged this week yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((a, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: i < rows.length - 1 ? "1px solid var(--uff-line-soft)" : "none",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: CAT_COLOR[a.category] ?? "var(--uff-text-mute)",
                }}
              />
              <div style={{ flex: 1, fontSize: 13, minWidth: 0 }}>
                <span style={{ color: "var(--uff-text)" }}>{a.who} </span>
                <span style={{ color: "var(--uff-text-dim)" }}>{a.verb} </span>
                <span style={{ color: "var(--uff-text)" }}>{a.what}</span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--uff-text-mute)",
                  whiteSpace: "nowrap",
                }}
              >
                {a.when}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
