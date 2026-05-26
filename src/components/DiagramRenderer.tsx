"use client";

import type { DiagramData, Path } from "@/types/diagram";
import {
  lastSegmentArrowDirection,
  renderRouteSegment,
  ROUTE_COLOR,
} from "@/lib/route-geometry";

interface DiagramRendererProps {
  data: DiagramData;
}

const MOVEMENT_STYLES: Record<
  Path["movement"],
  { color: string; strokeWidth: number; dasharray?: string; label: string }
> = {
  sprint: { color: "#FF8A4A", strokeWidth: 2.2, label: "Sprint" },
  backpedal: {
    color: "#6EA8FF",
    strokeWidth: 2.2,
    dasharray: "5 4",
    label: "Backpedal",
  },
  shuffle: {
    color: "#C2FF3D",
    strokeWidth: 2.2,
    dasharray: "1 4",
    label: "Shuffle",
  },
  jog: { color: "rgba(255,255,255,0.55)", strokeWidth: 1.6, label: "Jog" },
};

const YARD = 10;
const FIELD_YARDS_X = 20;
const FIELD_YARDS_Y = 20;
const FIELD_W = FIELD_YARDS_X * YARD;
const FIELD_H = FIELD_YARDS_Y * YARD;
const PAD_LEFT = 14;
const PAD_RIGHT = 4;
const PAD_Y = 4;
const VIEW_W = FIELD_W + PAD_LEFT + PAD_RIGHT;
const VIEW_H = FIELD_H + PAD_Y * 2;
const VIEWBOX = `${-PAD_LEFT} ${-PAD_Y} ${VIEW_W} ${VIEW_H}`;
const CONE_R = 4;

// Dark-theme palette (Build 5 redesign) — keep in sync with DiagramEditor.
const FIELD_BG = "#0F1115";
const LINE_10 = "rgba(255,255,255,0.10)";
const LINE_5 = "rgba(255,255,255,0.06)";
const LINE_1 = "rgba(255,255,255,0.04)";
const HASH_COLOR = "rgba(255,255,255,0.18)";
const NUMBER_COLOR = "rgba(255,255,255,0.40)";
const SIDELINE = "rgba(255,255,255,0.18)";
const PATH_LABEL_COLOR = "rgba(255,255,255,0.55)";
const LOS_COLOR = "rgba(255,106,26,0.45)";
const CONE_COLOR = "#FF6A1A";
const QB_COLOR = "#FF6A1A";
const FOOTBALL_COLOR = "#8B5A2B";
const FOOTBALL_LACES = "#FFFFFF";
const BALL_PATH_COLOR = "rgba(255,255,255,0.45)";
const CONE_LABEL_COLOR = "rgba(255,255,255,0.85)";
const CONE_RING_OPACITY = 0.4;

export default function DiagramRenderer({ data }: DiagramRendererProps) {
  const coneById = new Map(data.cones.map((c) => [c.id, c]));
  const routes = data.routes ?? [];
  const ballPaths = data.ballPaths ?? [];

  const usedMovements = Array.from(
    new Set(data.paths.map((p) => p.movement))
  ) as Path["movement"][];

  return (
    <div className="w-full">
      <div
        className="w-full rounded-lg overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface-base)",
          border: "1px solid var(--color-border-default)",
        }}
      >
        <svg
          viewBox={VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto block"
          role="img"
          aria-label="Drill setup diagram"
        >
          <FootballField />

          {data.losY !== undefined && (
            <g>
              <line
                x1={0}
                y1={data.losY}
                x2={FIELD_W}
                y2={data.losY}
                stroke={LOS_COLOR}
                strokeWidth={0.7}
                strokeDasharray="3 2.5"
              />
              <text
                x={3}
                y={data.losY - 1.5}
                fontSize={3.6}
                fill={LOS_COLOR}
                fontFamily="var(--font-mono), 'JetBrains Mono', monospace"
                letterSpacing="0.18em"
              >
                LOS
              </text>
            </g>
          )}

          {data.paths.map((path, idx) => {
            const from = coneById.get(path.from);
            const to = coneById.get(path.to);
            if (!from || !to) return null;
            const style = MOVEMENT_STYLES[path.movement];
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const offset = 9;
            const nx = -dy / len;
            const ny = dx / len;
            const labelX = mx + nx * offset;
            const labelY = my + ny * offset;

            return (
              <g key={`p-${idx}`}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={style.color}
                  strokeWidth={style.strokeWidth}
                  strokeDasharray={style.dasharray}
                  strokeLinecap="round"
                />
                <text
                  x={labelX}
                  y={labelY}
                  fontSize={9}
                  fill={PATH_LABEL_COLOR}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {path.yards}yd {path.movement}
                </text>
              </g>
            );
          })}

          {ballPaths.map((bp) => {
            const from = coneById.get(bp.fromConeId);
            if (!from) return null;
            let tx: number | undefined;
            let ty: number | undefined;
            if (bp.toConeId) {
              const to = coneById.get(bp.toConeId);
              if (!to) return null;
              tx = to.x;
              ty = to.y;
            } else if (bp.toX !== undefined && bp.toY !== undefined) {
              tx = bp.toX;
              ty = bp.toY;
            }
            if (tx === undefined || ty === undefined) return null;
            return (
              <line
                key={`bp-${bp.id}`}
                x1={from.x}
                y1={from.y}
                x2={tx}
                y2={ty}
                stroke="#5C3A1E"
                strokeWidth={2}
                strokeDasharray="4 3"
                strokeLinecap="round"
              />
            );
          })}

          {routes.map((route) => {
            const wps = route.waypoints;
            const last = wps[wps.length - 1];
            const prev = wps[wps.length - 2];
            const lastSeg = route.segments[route.segments.length - 1];
            const routeColor = route.color ?? ROUTE_COLOR;
            const arrowPoints = (() => {
              if (wps.length < 2 || !last || !prev) return null;
              const { dx, dy } = lastSegmentArrowDirection(prev, last, lastSeg);
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              // Chevron-style arrowhead: long, narrow, with a notched back.
              const arrowLen = 6;
              const arrowHalfW = 2.2;
              const notchInset = 2;
              const wingLx = last.x - ux * arrowLen + uy * arrowHalfW;
              const wingLy = last.y - uy * arrowLen - ux * arrowHalfW;
              const wingRx = last.x - ux * arrowLen - uy * arrowHalfW;
              const wingRy = last.y - uy * arrowLen + ux * arrowHalfW;
              const notchX = last.x - ux * (arrowLen - notchInset);
              const notchY = last.y - uy * (arrowLen - notchInset);
              return `${last.x},${last.y} ${wingLx},${wingLy} ${notchX},${notchY} ${wingRx},${wingRy}`;
            })();
            return (
              <g key={route.id}>
                {route.segments.map((seg, i) => {
                  const from = wps[i];
                  const to = wps[i + 1];
                  if (!from || !to) return null;
                  return renderRouteSegment(from, to, seg, i, 1.6, routeColor);
                })}
                {arrowPoints && (
                  <polygon points={arrowPoints} fill={routeColor} />
                )}
              </g>
            );
          })}

          {data.cones.map((cone) => {
            const isQB = cone.kind === "qb";
            const isFootball = cone.kind === "football";
            if (isFootball) {
              return (
                <g key={cone.id}>
                  <ellipse
                    cx={cone.x}
                    cy={cone.y}
                    rx={6}
                    ry={3.5}
                    fill={FOOTBALL_COLOR}
                    stroke={FOOTBALL_COLOR}
                    strokeWidth={1.2}
                  />
                  <line
                    x1={cone.x - 2.5}
                    y1={cone.y}
                    x2={cone.x + 2.5}
                    y2={cone.y}
                    stroke={FOOTBALL_LACES}
                    strokeWidth={0.8}
                  />
                  <line
                    x1={cone.x - 1.5}
                    y1={cone.y - 1}
                    x2={cone.x - 1.5}
                    y2={cone.y + 1}
                    stroke={FOOTBALL_LACES}
                    strokeWidth={0.6}
                  />
                  <line
                    x1={cone.x}
                    y1={cone.y - 1}
                    x2={cone.x}
                    y2={cone.y + 1}
                    stroke={FOOTBALL_LACES}
                    strokeWidth={0.6}
                  />
                  <line
                    x1={cone.x + 1.5}
                    y1={cone.y - 1}
                    x2={cone.x + 1.5}
                    y2={cone.y + 1}
                    stroke={FOOTBALL_LACES}
                    strokeWidth={0.6}
                  />
                </g>
              );
            }
            const isPlayer = cone.kind === "player";
            const color = cone.color ?? (isQB ? QB_COLOR : CONE_COLOR);
            const r = isQB ? CONE_R + 2 : CONE_R;
            const halo = isQB ? CONE_R + 5 : CONE_R + 3;
            const label = cone.label ?? "";
            const showLabelOutside =
              !isQB && label.trim().length > 0;
            return (
              <g key={cone.id}>
                {isQB ? (
                  <>
                    <circle cx={cone.x} cy={cone.y} r={r} fill={color} />
                    <text
                      x={cone.x}
                      y={cone.y}
                      fontSize={5.5}
                      fontWeight={700}
                      fill="#0A0A0D"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontFamily="var(--font-mono), 'JetBrains Mono', monospace"
                    >
                      QB
                    </text>
                  </>
                ) : isPlayer ? (
                  <circle cx={cone.x} cy={cone.y} r={r} fill={color} />
                ) : (
                  <>
                    <ellipse
                      cx={cone.x}
                      cy={cone.y + CONE_R}
                      rx={CONE_R * 0.95}
                      ry={CONE_R * 0.28}
                      fill={color}
                      opacity={0.55}
                    />
                    <polygon
                      points={`${cone.x},${cone.y - CONE_R - 1} ${cone.x - CONE_R * 0.9},${cone.y + CONE_R - 0.5} ${cone.x + CONE_R * 0.9},${cone.y + CONE_R - 0.5}`}
                      fill={color}
                    />
                    <line
                      x1={cone.x - CONE_R * 0.55}
                      y1={cone.y - 0.2}
                      x2={cone.x + CONE_R * 0.55}
                      y2={cone.y - 0.2}
                      stroke="rgba(255,255,255,0.85)"
                      strokeWidth={0.7}
                      strokeLinecap="round"
                    />
                  </>
                )}
                {showLabelOutside && (
                  <text
                    x={cone.x + r + 3}
                    y={cone.y + 1}
                    fontSize={5}
                    fontWeight={700}
                    fill={CONE_LABEL_COLOR}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fontFamily="var(--font-mono), 'JetBrains Mono', monospace"
                    letterSpacing="0.08em"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {(usedMovements.length > 0 ||
        routes.length > 0 ||
        ballPaths.length > 0) && (
        <div className="flex items-center gap-md mt-md flex-wrap">
          {usedMovements.map((m) => {
            const style = MOVEMENT_STYLES[m];
            return (
              <div key={m} className="flex items-center gap-xs">
                <svg width={20} height={6} aria-hidden="true">
                  <line
                    x1={0}
                    y1={3}
                    x2={20}
                    y2={3}
                    stroke={style.color}
                    strokeWidth={style.strokeWidth}
                    strokeDasharray={style.dasharray}
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  className="text-micro"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {style.label}
                </span>
              </div>
            );
          })}
          {routes.length > 0 && (
            <div className="flex items-center gap-xs">
              <svg width={20} height={6} aria-hidden="true">
                <line
                  x1={0}
                  y1={3}
                  x2={20}
                  y2={3}
                  stroke={ROUTE_COLOR}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              </svg>
              <span
                className="text-micro"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Route
              </span>
            </div>
          )}
          {ballPaths.length > 0 && (
            <div className="flex items-center gap-xs">
              <svg width={20} height={6} aria-hidden="true">
                <line
                  x1={0}
                  y1={3}
                  x2={20}
                  y2={3}
                  stroke={BALL_PATH_COLOR}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                />
              </svg>
              <span
                className="text-micro"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Pass
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FootballField() {
  const lines: React.ReactNode[] = [];
  for (let depth = 1; depth <= FIELD_YARDS_Y; depth++) {
    const y = FIELD_H - depth * YARD;
    const isTen = depth % 10 === 0;
    const isFive = depth % 5 === 0;
    const stroke = isTen ? LINE_10 : isFive ? LINE_5 : LINE_1;
    const strokeWidth = isTen ? 0.8 : isFive ? 0.6 : 0.4;
    lines.push(
      <line
        key={`yl-${depth}`}
        x1={0}
        y1={y}
        x2={FIELD_W}
        y2={y}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={isFive ? undefined : "1.5 2"}
      />
    );
  }

  const hashLeft = FIELD_W / 3;
  const hashRight = (2 * FIELD_W) / 3;
  const hashes: React.ReactNode[] = [];
  for (let depth = 1; depth < FIELD_YARDS_Y; depth++) {
    if (depth % 5 === 0) continue;
    const y = FIELD_H - depth * YARD;
    hashes.push(
      <line
        key={`hl-${depth}`}
        x1={hashLeft - 1.5}
        y1={y}
        x2={hashLeft + 1.5}
        y2={y}
        stroke={HASH_COLOR}
        strokeWidth={0.5}
      />,
      <line
        key={`hr-${depth}`}
        x1={hashRight - 1.5}
        y1={y}
        x2={hashRight + 1.5}
        y2={y}
        stroke={HASH_COLOR}
        strokeWidth={0.5}
      />
    );
  }

  const numbers: React.ReactNode[] = [];
  for (let depth = 0; depth <= FIELD_YARDS_Y; depth += 5) {
    const y = FIELD_H - depth * YARD;
    numbers.push(
      <text
        key={`nl-${depth}`}
        x={-3}
        y={y}
        fontSize={5.5}
        fill={NUMBER_COLOR}
        textAnchor="end"
        dominantBaseline="middle"
        fontFamily="var(--font-mono), 'JetBrains Mono', monospace"
        letterSpacing="0.1em"
      >
        {depth}
      </text>
    );
  }

  return (
    <g>
      <rect x={0} y={0} width={FIELD_W} height={FIELD_H} fill={FIELD_BG} />
      {lines}
      {hashes}
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={FIELD_H}
        stroke={SIDELINE}
        strokeWidth={0.8}
      />
      <line
        x1={FIELD_W}
        y1={0}
        x2={FIELD_W}
        y2={FIELD_H}
        stroke={SIDELINE}
        strokeWidth={0.8}
      />
      {numbers}
    </g>
  );
}
