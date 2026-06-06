import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import SectionHead from "./SectionHead";
import type { AttentionItem } from "@/lib/dashboard/team-home-data";

const FLAG_COLOR: Record<AttentionItem["flag"], string> = {
  down: "#FF4D4D",
  absent: "#FFB347",
  stale: "#6EA8FF",
};

export default function NeedsAttentionCard({
  items,
  teamId,
}: {
  items: AttentionItem[];
  teamId: string;
}) {
  return (
    <div className="w-card">
      <SectionHead label="Needs attention" meta={`${items.length} ITEMS`} />
      {items.length === 0 ? (
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
          Everyone is up to date. Nice work.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((p) => (
            <Link
              key={p.playerId}
              href={p.action.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--uff-surface-2)",
                border: "1px solid var(--uff-line-soft)",
                borderLeft: `3px solid ${FLAG_COLOR[p.flag]}`,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: p.color,
                  color: "#0a0a0d",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {p.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--uff-text)" }}>
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--uff-text-mute)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  {p.note}
                </div>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "var(--uff-accent, #D48A30)",
                  whiteSpace: "nowrap",
                }}
              >
                {p.action.label}
                <Icon.chevR size={12} />
              </span>
            </Link>
          ))}
        </div>
      )}
      <Link
        href={`/dashboard/team/${teamId}/roster`}
        className="wbtn ghost"
        style={{ width: "100%", marginTop: 12, justifyContent: "center" }}
      >
        Open roster health
      </Link>
    </div>
  );
}
