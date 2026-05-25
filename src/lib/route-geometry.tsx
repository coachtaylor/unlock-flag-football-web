import type React from "react";
import type { RouteSegment, RouteWaypoint } from "@/types/diagram";

export const ROUTE_COLOR = "#8B5CF6";

export function zigzagPoints(
  from: RouteWaypoint,
  to: RouteWaypoint
): { cx: number; cy: number } {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const offset = 8;
  return { cx: mx + px * offset, cy: my + py * offset };
}

export function curveControlPoint(
  from: RouteWaypoint,
  to: RouteWaypoint
): { cx: number; cy: number } {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const offset = 16;
  return { cx: mx + px * offset, cy: my + py * offset };
}

export function lastSegmentArrowDirection(
  prevWp: RouteWaypoint,
  lastWp: RouteWaypoint,
  lastSeg: RouteSegment | undefined
): { dx: number; dy: number } {
  if (lastSeg?.type === "curve") {
    const { cx, cy } = curveControlPoint(prevWp, lastWp);
    return { dx: lastWp.x - cx, dy: lastWp.y - cy };
  }
  if (lastSeg?.type === "zigzag") {
    const { cx, cy } = zigzagPoints(prevWp, lastWp);
    return { dx: lastWp.x - cx, dy: lastWp.y - cy };
  }
  return { dx: lastWp.x - prevWp.x, dy: lastWp.y - prevWp.y };
}

export function renderRouteSegment(
  from: RouteWaypoint,
  to: RouteWaypoint,
  segment: RouteSegment,
  index: number,
  strokeWidth: number = 3
): React.ReactNode {
  switch (segment.type) {
    case "zigzag": {
      const { cx, cy } = zigzagPoints(from, to);
      return (
        <polyline
          key={`rs-${index}`}
          points={`${from.x},${from.y} ${cx},${cy} ${to.x},${to.y}`}
          fill="none"
          stroke={ROUTE_COLOR}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      );
    }
    case "curve": {
      const { cx, cy } = curveControlPoint(from, to);
      return (
        <path
          key={`rs-${index}`}
          d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
          fill="none"
          stroke={ROUTE_COLOR}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pointerEvents="none"
        />
      );
    }
    default:
      return (
        <line
          key={`rs-${index}`}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={ROUTE_COLOR}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pointerEvents="none"
        />
      );
  }
}

export function renderRouteHitTarget(
  from: RouteWaypoint,
  to: RouteWaypoint,
  segment: RouteSegment,
  index: number,
  hitStroke: number,
  cursor: "pointer" | "default",
  onClick: (e: React.MouseEvent) => void
): React.ReactNode {
  switch (segment.type) {
    case "zigzag": {
      const { cx, cy } = zigzagPoints(from, to);
      return (
        <polyline
          key={`rh-${index}`}
          points={`${from.x},${from.y} ${cx},${cy} ${to.x},${to.y}`}
          fill="none"
          stroke="transparent"
          strokeWidth={hitStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ cursor }}
          onClick={onClick}
        />
      );
    }
    case "curve": {
      const { cx, cy } = curveControlPoint(from, to);
      return (
        <path
          key={`rh-${index}`}
          d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
          fill="none"
          stroke="transparent"
          strokeWidth={hitStroke}
          strokeLinecap="round"
          style={{ cursor }}
          onClick={onClick}
        />
      );
    }
    default:
      return (
        <line
          key={`rh-${index}`}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="transparent"
          strokeWidth={hitStroke}
          strokeLinecap="round"
          style={{ cursor }}
          onClick={onClick}
        />
      );
  }
}
