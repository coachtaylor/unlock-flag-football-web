// Read-only block card for the practice detail page. Renders drills with
// parallel groups bracketed and shared slot length surfaced.

import type { PlanBlock, PlanDrill } from "@/lib/practice/plan-data";
import { blockMinutes } from "@/lib/practice/plan-data";
import { blockColor } from "@/lib/practice/block-colors";
import { PIcon } from "./atoms";

export function BlockReadCard({ block, index }: { block: PlanBlock; index: number }) {
  const c = blockColor(block.name);

  // Group drills by parallel_group, preserving order
  type Group = { kind: "solo"; drills: PlanDrill[] } | { kind: "parallel"; drills: PlanDrill[] };
  const groups: Group[] = [];
  const seen = new Set<number>();
  for (const d of block.drills) {
    if (d.parallel_group == null) {
      groups.push({ kind: "solo", drills: [d] });
      continue;
    }
    if (seen.has(d.parallel_group)) continue;
    seen.add(d.parallel_group);
    const siblings = block.drills.filter((x) => x.parallel_group === d.parallel_group);
    groups.push({ kind: "parallel", drills: siblings });
  }

  const blockMin = blockMinutes(block);
  const target = block.target_minutes ?? 0;
  const delta = blockMin - target;

  return (
    <div
      style={{
        background: c.tint,
        border: `1px solid ${c.border}`,
        borderLeft: `4px solid ${c.accent}`,
        borderRadius: 14,
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: c.accent,
            color: "#1a0f08",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--uff-text)",
              letterSpacing: "-0.005em",
            }}
          >
            {block.name}
          </div>
          <div
            className="mono"
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10.5,
              color: "var(--uff-text-mute)",
              letterSpacing: ".06em",
              marginTop: 2,
              textTransform: "uppercase",
            }}
          >
            {block.drills.length} DRILL{block.drills.length === 1 ? "" : "S"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            className="mono"
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 15,
              fontWeight: 700,
              color: c.accent,
            }}
          >
            {blockMin}m
          </div>
          {target > 0 && (
            <div
              className="mono"
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: 10,
                color: "var(--uff-text-mute)",
                letterSpacing: ".06em",
              }}
            >
              TARGET {target}m{delta !== 0 ? ` · ${delta > 0 ? "+" : ""}${delta}` : ""}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          background: "var(--uff-surface)",
          borderRadius: 10,
          padding: "4px 14px",
        }}
      >
        {block.drills.length === 0 && (
          <div
            style={{
              padding: "16px 8px",
              color: "var(--uff-text-mute)",
              fontSize: 12.5,
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            No drills in this block.
          </div>
        )}
        {groups.map((g, gi) => {
          if (g.kind === "solo") {
            return <DrillReadRow key={g.drills[0].id} d={g.drills[0]} accent={c.accent} />;
          }
          const maxMin = Math.max(...g.drills.map((d) => d.duration_minutes));
          return (
            <div
              key={gi}
              style={{
                padding: "8px 0 6px",
                borderTop: "1px solid var(--uff-line-soft)",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                  marginLeft: 14,
                }}
              >
                <span style={{ color: "#B89BFF", display: "flex" }}>
                  <PIcon.split size={11} />
                </span>
                <span
                  className="mono"
                  style={{
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: ".14em",
                    color: "#B89BFF",
                  }}
                >
                  PARALLEL · counts once · {maxMin}m
                </span>
              </div>
              <div
                style={{
                  position: "relative",
                  paddingLeft: 14,
                  borderLeft: "2px solid rgba(184,155,255,0.40)",
                  marginLeft: 6,
                }}
              >
                {g.drills.map((d) => (
                  <DrillReadRow key={d.id} d={d} accent={c.accent} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DrillReadRow({ d, accent }: { d: PlanDrill; accent: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 0",
        borderTop: "1px solid var(--uff-line-soft)",
      }}
    >
      <div
        style={{
          width: 3,
          alignSelf: "stretch",
          minHeight: 30,
          background: accent,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--uff-text)" }}>
            {d.drill_name ?? "Unknown drill"}
          </span>
          {d.category_name && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--uff-text-mute)",
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.04)",
              }}
            >
              {d.category_name}
            </span>
          )}
          {d.benchmark_types.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--uff-orange)" }}>
              <PIcon.bench size={9} />
              <span
                className="mono"
                style={{
                  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: ".12em",
                }}
              >
                BENCH
              </span>
            </span>
          )}
        </div>
        {d.notes && (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--uff-text-dim)",
              marginTop: 4,
              fontStyle: "italic",
              lineHeight: 1.5,
            }}
          >
            &ldquo;{d.notes}&rdquo;
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <span
          className="mono"
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--uff-text)",
          }}
        >
          {d.duration_minutes}m
        </span>
        {d.reps_count != null && d.reps_count > 0 && (
          <span
            className="mono"
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10.5,
              color: "var(--uff-text-mute)",
              letterSpacing: ".04em",
            }}
          >
            {d.reps_count} reps
          </span>
        )}
      </div>
    </div>
  );
}

export function BreakReadRow({ minutes }: { minutes: number }) {
  return (
    <div
      style={{
        background: "rgba(110,168,255,0.05)",
        border: "1px dashed rgba(110,168,255,0.30)",
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginLeft: 32,
      }}
    >
      <div style={{ color: "#6EA8FF", display: "flex" }}>
        <PIcon.water size={14} />
      </div>
      <div style={{ flex: 1, fontSize: 12.5, color: "var(--uff-text-dim)" }}>Water break</div>
      <span
        className="mono"
        style={{
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 11.5,
          fontWeight: 700,
          color: "#6EA8FF",
        }}
      >
        {minutes}m
      </span>
    </div>
  );
}
