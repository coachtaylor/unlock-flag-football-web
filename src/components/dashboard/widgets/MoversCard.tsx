import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import SectionHead from "./SectionHead";
import type { Mover } from "@/lib/dashboard/team-home-data";

function fmtImprovement(m: Mover) {
  if (m.unit === "s") return `−${m.improvement.toFixed(2)}s`;
  if (m.unit === "/5") return `+${m.improvement.toFixed(1)}`;
  if (m.unit === "%") return `+${Math.round(m.improvement)}%`;
  return `+${Math.round(m.improvement)}`;
}

export default function MoversCard({
  movers,
  teamId,
}: {
  movers: Mover[];
  teamId: string;
}) {
  const prCount = movers.filter((m) => m.isPr).length;
  return (
    <div className="w-card">
      <SectionHead label="Movers" meta={prCount ? `${prCount} PRS` : "THIS PERIOD"} />
      {movers.length === 0 ? (
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
          Log two benchmark sessions on the same drill to unlock movers.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {movers.map((m, i) => (
            <div key={m.playerId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 18,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--uff-text-mute)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: m.color,
                  color: "#0a0a0d",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {m.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                    color: "var(--uff-text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {m.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--uff-text-mute)" }}>{m.drillName}</div>
              </div>
              {m.isPr && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    padding: "2px 6px",
                    background: "rgba(255,106,26,0.14)",
                    color: "var(--uff-orange)",
                    border: "1px solid rgba(255,106,26,0.30)",
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                >
                  PR
                </span>
              )}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: m.isPr ? "var(--uff-lime)" : "var(--uff-text)",
                  minWidth: 54,
                  textAlign: "right",
                }}
              >
                {fmtImprovement(m)}
              </span>
            </div>
          ))}
        </div>
      )}
      <Link
        href={`/dashboard/team/${teamId}/roster`}
        className="wbtn ghost"
        style={{
          width: "100%",
          marginTop: 12,
          justifyContent: "space-between",
        }}
      >
        <span>See full roster</span>
        <Icon.chevR size={12} />
      </Link>
    </div>
  );
}
