"use client";

import { useRef, useState } from "react";
import type {
  BallPath,
  Cone,
  DiagramData,
  Path,
  Route,
  RouteSegment,
  RouteWaypoint,
} from "@/types/diagram";
import {
  lastSegmentArrowDirection,
  renderRouteSegment,
  renderRouteHitTarget,
} from "@/lib/route-geometry";

interface DiagramEditorProps {
  value: DiagramData | null;
  onChange: (data: DiagramData) => void;
}

const YARD = 10; // SVG units per yard
const FIELD_YARDS_X = 20; // sideline-to-sideline width
const FIELD_YARDS_Y = 25; // depth (line of scrimmage to downfield)
const FIELD_W = FIELD_YARDS_X * YARD; // 200
const FIELD_H = FIELD_YARDS_Y * YARD; // 250
const PAD_LEFT = 14;
const PAD_RIGHT = 4;
const PAD_Y = 4;
const VIEW_W = FIELD_W + PAD_LEFT + PAD_RIGHT;
const VIEW_H = FIELD_H + PAD_Y * 2;
const VIEWBOX = `${-PAD_LEFT} ${-PAD_Y} ${VIEW_W} ${VIEW_H}`;
const SNAP_STEP = YARD / 2;
const CONE_R = 4;
const HIT_R = 18;
const CONE_HIT_R = 10;
const PATH_HIT_STROKE = 16;
const ROUTE_HIT_STROKE = 16;
const ROUTE_COLOR = "#8B5CF6";
const CONE_COLOR = "#D48A30";
const QB_COLOR = "#EAB308";
const FOOTBALL_COLOR = "#5C3A1E";
const FOOTBALL_LACES = "#FFFFFF";
const BALL_PATH_COLOR = "#5C3A1E";
const BALL_PATH_HIT_STROKE = 16;
const FINISH_TAP_R = HIT_R;
const MIN_X = 0;
const MAX_X = FIELD_W;
const MIN_Y = 0;
const MAX_Y = FIELD_H;
const ADD_OFFSET_DEPTH = 5 * YARD;
const ADD_OFFSET_LATERAL = 5 * YARD;
const DRAG_THRESHOLD = 2;
const ALIGN_THRESHOLD = 0.5 * YARD; // 0.5 yards — snap to another cone's row/column

const FIELD_BG = "#FFFFFF";
const LINE_10 = "#C8C8C8";
const LINE_5 = "#DCDCDC";
const LINE_1 = "#EEEEEE";
const HASH_COLOR = "#E8E8E8";
const NUMBER_COLOR = "rgba(255,255,255,0.45)";
const SIDELINE = "#D0D0D0";
const PATH_LABEL_COLOR = "#555555";

const MOVEMENTS: Path["movement"][] = ["sprint", "backpedal", "shuffle", "jog"];

const SEGMENT_TYPES: { value: RouteSegment["type"]; label: string }[] = [
  { value: "straight", label: "Straight" },
  { value: "zigzag", label: "Cut" },
  { value: "curve", label: "Curve" },
];

const MOVEMENT_STYLES: Record<
  Path["movement"],
  { color: string; strokeWidth: number; dasharray?: string; label: string }
> = {
  sprint: {
    color: "#D48A30",
    strokeWidth: 4,
    label: "Sprint",
  },
  backpedal: {
    color: "#2563EB",
    strokeWidth: 4,
    dasharray: "10 6",
    label: "Backpedal",
  },
  shuffle: {
    color: "#16A34A",
    strokeWidth: 4,
    dasharray: "1 5",
    label: "Shuffle",
  },
  jog: {
    color: "#9CA3AF",
    strokeWidth: 2.5,
    label: "Jog",
  },
};

function emptyDiagram(): DiagramData {
  return { cones: [], paths: [], routes: [], ballPaths: [], gridScale: 1 };
}

function nextBallPathId(items: BallPath[]): string {
  let n = items.length + 1;
  const ids = new Set(items.map((b) => b.id));
  while (ids.has(`bp${n}`)) n++;
  return `bp${n}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function snap(v: number) {
  return Math.round(v / SNAP_STEP) * SNAP_STEP;
}

function calcYards(from: Cone, to: Cone): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const yards = Math.sqrt(dx * dx + dy * dy) / YARD;
  return Math.round(yards * 2) / 2;
}

function nextConeId(cones: Cone[]): string {
  let n = cones.length + 1;
  const ids = new Set(cones.map((c) => c.id));
  while (ids.has(`c${n}`)) n++;
  return `c${n}`;
}

function nextQBId(cones: Cone[]): string {
  let n = 1;
  const ids = new Set(cones.map((c) => c.id));
  while (ids.has(`qb${n}`)) n++;
  return `qb${n}`;
}

function nextFootballId(cones: Cone[]): string {
  let n = 1;
  const ids = new Set(cones.map((c) => c.id));
  while (ids.has(`fb${n}`)) n++;
  return `fb${n}`;
}

function nextRouteId(routes: Route[]): string {
  let n = routes.length + 1;
  const ids = new Set(routes.map((r) => r.id));
  while (ids.has(`r${n}`)) n++;
  return `r${n}`;
}

function nextWaypointId(waypoints: RouteWaypoint[]): string {
  let n = waypoints.length + 1;
  const ids = new Set(waypoints.map((w) => w.id));
  while (ids.has(`w${n}`)) n++;
  return `w${n}`;
}

function nextConePosition(cones: Cone[]): { x: number; y: number } {
  const placed = cones.filter((c) => (c.kind ?? "cone") === "cone");
  if (placed.length === 0) {
    // Start near the line of scrimmage (bottom), centered laterally
    return { x: FIELD_W / 2, y: FIELD_H - 5 * YARD };
  }
  const last = placed[placed.length - 1];
  // Each new cone steps 5 yards downfield (up in SVG y)
  let y = last.y - ADD_OFFSET_DEPTH;
  let x = last.x;
  if (y < MIN_Y) {
    y = FIELD_H - 5 * YARD;
    x = last.x + ADD_OFFSET_LATERAL;
    if (x > MAX_X) x = 5 * YARD;
  }
  return { x: clamp(snap(x), MIN_X, MAX_X), y: clamp(snap(y), MIN_Y, MAX_Y) };
}

function nextFootballPosition(cones: Cone[]): { x: number; y: number } {
  const balls = cones.filter((c) => c.kind === "football");
  if (balls.length === 0) {
    return { x: FIELD_W / 2 + ADD_OFFSET_LATERAL, y: FIELD_H / 2 };
  }
  const last = balls[balls.length - 1];
  let y = last.y + ADD_OFFSET_DEPTH;
  let x = last.x;
  if (y > MAX_Y) {
    y = 5 * YARD;
    x = last.x + ADD_OFFSET_LATERAL;
    if (x > MAX_X) x = 5 * YARD;
  }
  return {
    x: clamp(snap(x), MIN_X, MAX_X),
    y: clamp(snap(y), MIN_Y, MAX_Y),
  };
}

function nextQBPosition(cones: Cone[]): { x: number; y: number } {
  const qbs = cones.filter((c) => c.kind === "qb");
  if (qbs.length === 0) {
    // Place at line of scrimmage, centered
    return { x: FIELD_W / 2, y: FIELD_H - YARD };
  }
  const last = qbs[qbs.length - 1];
  let x = last.x + ADD_OFFSET_LATERAL;
  if (x > MAX_X) x = 5 * YARD;
  return {
    x: clamp(snap(x), MIN_X, MAX_X),
    y: clamp(snap(last.y), MIN_Y, MAX_Y),
  };
}

type Mode = "normal" | "drawing" | "route" | "ballpath";

export default function DiagramEditor({ value, onChange }: DiagramEditorProps) {
  const data: DiagramData = value
    ? {
        ...value,
        routes: value.routes ?? [],
        ballPaths: value.ballPaths ?? [],
      }
    : emptyDiagram();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const [mode, setMode] = useState<Mode>("normal");
  const [pathFromId, setPathFromId] = useState<string | null>(null);
  const [pathToId, setPathToId] = useState<string | null>(null);
  const [pendingMovement, setPendingMovement] =
    useState<Path["movement"]>("sprint");
  const [pendingYards, setPendingYards] = useState<string>("");
  const [pathFormError, setPathFormError] = useState<string | null>(null);

  const [editingPathIdx, setEditingPathIdx] = useState<number | null>(null);

  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(
    null
  );
  const [routeSnapshot, setRouteSnapshot] = useState<{
    waypoints: RouteWaypoint[];
    segments: RouteSegment[];
  } | null>(null);
  const [pendingSegmentType, setPendingSegmentType] =
    useState<RouteSegment["type"]>("straight");
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [insertMode, setInsertMode] = useState<"after" | "before">("after");
  const insertedWaypointIdsRef = useRef<string[]>([]);

  const [pendingBallFromId, setPendingBallFromId] = useState<string | null>(
    null
  );
  const [selectedBallPathId, setSelectedBallPathId] = useState<string | null>(
    null
  );

  const [alignGuides, setAlignGuides] = useState<{
    x: number | null;
    y: number | null;
  }>({ x: null, y: null });

  const dragRef = useRef<{
    coneId: string;
    moved: boolean;
    pointerId?: number;
  } | null>(null);

  const waypointDragRef = useRef<{
    routeId: string;
    waypointId: string;
    moved: boolean;
    pointerId?: number;
  } | null>(null);

  const update = (next: DiagramData) => onChange(next);

  const screenToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VIEW_W - PAD_LEFT;
    const y = ((clientY - rect.top) / rect.height) * VIEW_H - PAD_Y;
    return { x, y };
  };

  const resetPathDrawingState = () => {
    setPathFromId(null);
    setPathToId(null);
    setPendingMovement("sprint");
    setPendingYards("");
    setPathFormError(null);
  };

  const exitDrawingMode = () => {
    setMode("normal");
    resetPathDrawingState();
  };

  const exitEditingPath = () => {
    setEditingPathIdx(null);
    resetPathDrawingState();
  };

  const handleAddCone = () => {
    if (mode !== "normal") return;
    const id = nextConeId(data.cones);
    const { x, y } = nextConePosition(data.cones);
    const cones = data.cones.filter((c) => (c.kind ?? "cone") === "cone");
    const label = cones.length === 0 ? "Start" : "";
    const newCone: Cone = { id, x, y, label, kind: "cone" };
    update({ ...data, cones: [...data.cones, newCone] });
    setSelectedId(id);
  };

  const handleAddQB = () => {
    if (mode !== "normal") return;
    const id = nextQBId(data.cones);
    const { x, y } = nextQBPosition(data.cones);
    const newQB: Cone = { id, x, y, label: "QB", kind: "qb" };
    update({ ...data, cones: [...data.cones, newQB] });
    setSelectedId(id);
  };

  const handleAddFootball = () => {
    if (mode !== "normal") return;
    const id = nextFootballId(data.cones);
    const { x, y } = nextFootballPosition(data.cones);
    const newBall: Cone = { id, x, y, label: "Ball", kind: "football" };
    update({ ...data, cones: [...data.cones, newBall] });
    setSelectedId(id);
  };

  const handleStartRouteDrawing = () => {
    if (mode === "route") {
      finishActiveRoute();
      return;
    }
    if (mode === "drawing") return;
    const id = nextRouteId(data.routes);
    const newRoute: Route = { id, waypoints: [], segments: [] };
    update({ ...data, routes: [...data.routes, newRoute] });
    setActiveRouteId(id);
    setSelectedId(null);
    setSelectedRouteId(null);
    setSelectedWaypointId(null);
    setEditingPathIdx(null);
    resetPathDrawingState();
    setPendingSegmentType("straight");
    setInsertAfterIndex(null);
    setInsertMode("after");
    insertedWaypointIdsRef.current = [];
    setMode("route");
  };

  const finishActiveRoute = () => {
    if (!activeRouteId) {
      setMode("normal");
      return;
    }
    const route = data.routes.find((r) => r.id === activeRouteId);
    if (!route || route.waypoints.length < 2) {
      const routes = data.routes.filter((r) => r.id !== activeRouteId);
      update({ ...data, routes });
    }
    setActiveRouteId(null);
    setRouteSnapshot(null);
    setInsertAfterIndex(null);
    setInsertMode("after");
    insertedWaypointIdsRef.current = [];
    setMode("normal");
  };

  const handleCancelRoute = () => {
    if (routeSnapshot && activeRouteId) {
      const routes = data.routes.map((r) =>
        r.id === activeRouteId
          ? {
              ...r,
              waypoints: routeSnapshot.waypoints,
              segments: routeSnapshot.segments,
            }
          : r
      );
      update({ ...data, routes });
    } else if (activeRouteId) {
      const routes = data.routes.filter((r) => r.id !== activeRouteId);
      update({ ...data, routes });
    }
    setActiveRouteId(null);
    setRouteSnapshot(null);
    setInsertAfterIndex(null);
    setInsertMode("after");
    insertedWaypointIdsRef.current = [];
    setMode("normal");
  };

  const handleContinueRoute = () => {
    if (!selectedRouteId) return;
    const route = data.routes.find((r) => r.id === selectedRouteId);
    if (!route) return;
    let idx = route.waypoints.length - 1;
    let mode: "after" | "before" = "after";
    if (selectedWaypointId) {
      const i = route.waypoints.findIndex((w) => w.id === selectedWaypointId);
      if (i === 0 && route.waypoints.length > 1) {
        idx = 0;
        mode = "before";
      } else if (i >= 0) {
        idx = i;
      }
    }
    setRouteSnapshot({
      waypoints: route.waypoints.map((w) => ({ ...w })),
      segments: route.segments.map((s) => ({ ...s })),
    });
    setActiveRouteId(selectedRouteId);
    setSelectedRouteId(null);
    setSelectedWaypointId(null);
    setSelectedId(null);
    setEditingPathIdx(null);
    resetPathDrawingState();
    setPendingSegmentType("straight");
    setInsertAfterIndex(idx);
    setInsertMode(mode);
    insertedWaypointIdsRef.current = [];
    setMode("route");
  };

  const handleDeleteWaypoint = () => {
    if (!selectedRouteId || !selectedWaypointId) return;
    const route = data.routes.find((r) => r.id === selectedRouteId);
    if (!route) return;
    const idx = route.waypoints.findIndex((w) => w.id === selectedWaypointId);
    if (idx < 0) return;

    const waypoints = route.waypoints.filter((_, i) => i !== idx);
    const segments =
      idx === 0
        ? route.segments.slice(1)
        : route.segments.filter((_, i) => i !== idx - 1);

    if (waypoints.length < 2) {
      const routes = data.routes.filter((r) => r.id !== selectedRouteId);
      update({ ...data, routes });
      setSelectedRouteId(null);
      setSelectedWaypointId(null);
      return;
    }

    const routes = data.routes.map((r) =>
      r.id === selectedRouteId ? { ...r, waypoints, segments } : r
    );
    update({ ...data, routes });
    setSelectedWaypointId(null);
  };

  const moveWaypointTo = (
    routeId: string,
    waypointId: string,
    clientX: number,
    clientY: number
  ) => {
    const { x, y } = screenToSvg(clientX, clientY);
    const sx = clamp(snap(x), MIN_X, MAX_X);
    const sy = clamp(snap(y), MIN_Y, MAX_Y);
    const routes = data.routes.map((r) =>
      r.id === routeId
        ? {
            ...r,
            waypoints: r.waypoints.map((w) =>
              w.id === waypointId ? { ...w, x: sx, y: sy } : w
            ),
          }
        : r
    );
    update({ ...data, routes });
  };

  const onWaypointPointerDown = (
    e: React.PointerEvent<SVGCircleElement>,
    routeId: string,
    waypointId: string
  ) => {
    e.stopPropagation();
    if (mode !== "normal") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    waypointDragRef.current = {
      routeId,
      waypointId,
      moved: false,
      pointerId: e.pointerId,
    };
  };

  const onWaypointPointerUp = (
    e: React.PointerEvent<SVGCircleElement>,
    waypointId: string
  ) => {
    e.stopPropagation();
    if (mode !== "normal") return;
    const drag = waypointDragRef.current;
    if (drag && !drag.moved) {
      setSelectedWaypointId(waypointId);
    }
    waypointDragRef.current = null;
  };

  const addRouteWaypoint = (clientX: number, clientY: number) => {
    if (!activeRouteId) return;
    const route = data.routes.find((r) => r.id === activeRouteId);
    if (!route) return;
    const { x, y } = screenToSvg(clientX, clientY);
    const sx = clamp(snap(x), MIN_X, MAX_X);
    const sy = clamp(snap(y), MIN_Y, MAX_Y);
    const wpId = nextWaypointId(route.waypoints);
    const newWaypoint: RouteWaypoint = { id: wpId, x: sx, y: sy };

    let waypoints: RouteWaypoint[];
    let segments: RouteSegment[];
    const idx = insertAfterIndex;
    if (route.waypoints.length === 0) {
      waypoints = [newWaypoint];
      segments = [];
    } else if (insertMode === "before" && idx !== null) {
      waypoints = [
        ...route.waypoints.slice(0, idx),
        newWaypoint,
        ...route.waypoints.slice(idx),
      ];
      segments = [
        ...route.segments.slice(0, idx),
        { type: pendingSegmentType },
        ...route.segments.slice(idx),
      ];
    } else if (idx === null || idx >= route.waypoints.length - 1) {
      waypoints = [...route.waypoints, newWaypoint];
      segments = [...route.segments, { type: pendingSegmentType }];
    } else {
      waypoints = [
        ...route.waypoints.slice(0, idx + 1),
        newWaypoint,
        ...route.waypoints.slice(idx + 1),
      ];
      const outbound = route.segments[idx];
      segments = [
        ...route.segments.slice(0, idx),
        { type: pendingSegmentType },
        outbound,
        ...route.segments.slice(idx + 1),
      ];
    }

    const routes = data.routes.map((r) =>
      r.id === activeRouteId ? { ...r, waypoints, segments } : r
    );
    update({ ...data, routes });

    insertedWaypointIdsRef.current.push(wpId);
    if (insertMode === "before" && idx !== null) {
      setInsertAfterIndex(idx);
    } else if (idx === null) {
      setInsertAfterIndex(waypoints.length - 1);
    } else {
      setInsertAfterIndex(idx + 1);
    }
  };

  const handleUndoLastWaypoint = () => {
    if (!activeRouteId) return;
    const route = data.routes.find((r) => r.id === activeRouteId);
    if (!route || route.waypoints.length === 0) return;

    const stack = insertedWaypointIdsRef.current;
    let i: number;
    if (stack.length > 0) {
      const lastId = stack[stack.length - 1];
      const found = route.waypoints.findIndex((w) => w.id === lastId);
      if (found < 0) {
        stack.pop();
        return;
      }
      i = found;
    } else {
      i = route.waypoints.length - 1;
    }

    const waypoints = route.waypoints.filter((_, k) => k !== i);
    let segments: RouteSegment[];
    if (waypoints.length === 0) {
      segments = [];
    } else if (i === 0) {
      segments = route.segments.slice(1);
    } else {
      segments = [
        ...route.segments.slice(0, i - 1),
        ...route.segments.slice(i),
      ];
    }

    if (waypoints.length === 0) {
      const routes = data.routes.filter((r) => r.id !== activeRouteId);
      update({ ...data, routes });
    } else {
      const routes = data.routes.map((r) =>
        r.id === activeRouteId ? { ...r, waypoints, segments } : r
      );
      update({ ...data, routes });
    }

    if (stack.length > 0) stack.pop();
    if (
      insertAfterIndex !== null &&
      i <= insertAfterIndex &&
      insertAfterIndex > 0
    ) {
      setInsertAfterIndex(insertAfterIndex - 1);
    }
  };

  const handleDeleteRoute = () => {
    if (!selectedRouteId) return;
    const routes = data.routes.filter((r) => r.id !== selectedRouteId);
    update({ ...data, routes });
    setSelectedRouteId(null);
    setSelectedWaypointId(null);
  };

  const handleClearAll = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    update({ ...data, cones: [], paths: [], routes: [], ballPaths: [] });
    setSelectedId(null);
    setSelectedRouteId(null);
    setSelectedWaypointId(null);
    setActiveRouteId(null);
    setRouteSnapshot(null);
    exitDrawingMode();
    setEditingPathIdx(null);
    setConfirmingClear(false);
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    const cones = data.cones.filter((c) => c.id !== selectedId);
    const paths = data.paths.filter(
      (p) => p.from !== selectedId && p.to !== selectedId
    );
    const ballPaths = (data.ballPaths ?? []).filter(
      (b) => b.fromConeId !== selectedId && b.toConeId !== selectedId
    );
    update({ ...data, cones, paths, ballPaths });
    setSelectedId(null);
  };

  const handleStartBallPath = () => {
    if (!selectedId) return;
    const cone = data.cones.find((c) => c.id === selectedId);
    if (!cone || cone.kind !== "football") return;
    setPendingBallFromId(cone.id);
    setSelectedId(null);
    setSelectedRouteId(null);
    setSelectedWaypointId(null);
    setEditingPathIdx(null);
    setSelectedBallPathId(null);
    resetPathDrawingState();
    setMode("ballpath");
  };

  const handleCancelBallPath = () => {
    setPendingBallFromId(null);
    setMode("normal");
  };

  const placeBallPathTarget = (clientX: number, clientY: number) => {
    if (!pendingBallFromId) return;
    const { x, y } = screenToSvg(clientX, clientY);
    let nearest: Cone | null = null;
    let nearestDist = CONE_HIT_R;
    for (const c of data.cones) {
      if (c.id === pendingBallFromId) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d <= nearestDist) {
        nearestDist = d;
        nearest = c;
      }
    }
    const existing = data.ballPaths ?? [];
    const id = nextBallPathId(existing);
    const newBp: BallPath = nearest
      ? { id, fromConeId: pendingBallFromId, toConeId: nearest.id }
      : {
          id,
          fromConeId: pendingBallFromId,
          toX: clamp(snap(x), MIN_X, MAX_X),
          toY: clamp(snap(y), MIN_Y, MAX_Y),
        };
    update({ ...data, ballPaths: [...existing, newBp] });
    setPendingBallFromId(null);
    setMode("normal");
  };

  const handleDeleteBallPath = () => {
    if (!selectedBallPathId) return;
    const ballPaths = (data.ballPaths ?? []).filter(
      (b) => b.id !== selectedBallPathId
    );
    update({ ...data, ballPaths });
    setSelectedBallPathId(null);
  };

  const handleLabelChange = (label: string) => {
    if (!selectedId) return;
    const cones = data.cones.map((c) =>
      c.id === selectedId ? { ...c, label } : c
    );
    update({ ...data, cones });
  };

  const moveConeTo = (coneId: string, clientX: number, clientY: number) => {
    const { x, y } = screenToSvg(clientX, clientY);
    const baseX = clamp(snap(x), MIN_X, MAX_X);
    const baseY = clamp(snap(y), MIN_Y, MAX_Y);
    let sx = baseX;
    let sy = baseY;

    const others = data.cones.filter((c) => c.id !== coneId);
    let alignX: number | null = null;
    let alignY: number | null = null;
    let bestDx = ALIGN_THRESHOLD + 1;
    let bestDy = ALIGN_THRESHOLD + 1;
    for (const o of others) {
      const dx = Math.abs(sx - o.x);
      if (dx <= ALIGN_THRESHOLD && dx < bestDx) {
        bestDx = dx;
        alignX = o.x;
      }
      const dy = Math.abs(sy - o.y);
      if (dy <= ALIGN_THRESHOLD && dy < bestDy) {
        bestDy = dy;
        alignY = o.y;
      }
    }
    if (alignX !== null) sx = alignX;
    if (alignY !== null) sy = alignY;

    // If alignment snap stacks us onto another cone, drop snaps until we're clear
    // so users can drop a cone in the gap between two close-aligned cones.
    if (others.some((o) => o.x === sx && o.y === sy)) {
      if (alignX !== null) {
        sx = baseX;
        alignX = null;
      }
      if (others.some((o) => o.x === sx && o.y === sy) && alignY !== null) {
        sy = baseY;
        alignY = null;
      }
    }

    setAlignGuides({ x: alignX, y: alignY });

    const cones = data.cones.map((c) =>
      c.id === coneId ? { ...c, x: sx, y: sy } : c
    );
    update({ ...data, cones });
  };

  const onConePointerDown = (
    e: React.PointerEvent<SVGCircleElement>,
    coneId: string
  ) => {
    e.stopPropagation();
    if (mode === "drawing" || mode === "route") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { coneId, moved: false, pointerId: e.pointerId };
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode === "drawing" || mode === "route") return;

    const wpDrag = waypointDragRef.current;
    if (wpDrag) {
      if (wpDrag.pointerId !== undefined && e.pointerId !== wpDrag.pointerId)
        return;
      const route = data.routes.find((r) => r.id === wpDrag.routeId);
      const wp = route?.waypoints.find((w) => w.id === wpDrag.waypointId);
      if (!route || !wp) return;
      const { x, y } = screenToSvg(e.clientX, e.clientY);
      if (
        !wpDrag.moved &&
        Math.abs(x - wp.x) < DRAG_THRESHOLD &&
        Math.abs(y - wp.y) < DRAG_THRESHOLD
      ) {
        return;
      }
      wpDrag.moved = true;
      moveWaypointTo(wpDrag.routeId, wpDrag.waypointId, e.clientX, e.clientY);
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    if (drag.pointerId !== undefined && e.pointerId !== drag.pointerId) return;
    const cone = data.cones.find((c) => c.id === drag.coneId);
    if (!cone) return;
    const { x, y } = screenToSvg(e.clientX, e.clientY);
    if (
      !drag.moved &&
      Math.abs(x - cone.x) < DRAG_THRESHOLD &&
      Math.abs(y - cone.y) < DRAG_THRESHOLD
    ) {
      return;
    }
    drag.moved = true;
    moveConeTo(drag.coneId, e.clientX, e.clientY);
  };

  const onConeTapInDrawing = (coneId: string) => {
    if (!pathFromId) {
      setPathFromId(coneId);
      return;
    }
    if (coneId === pathFromId) {
      setPathFromId(null);
      return;
    }
    setPathToId(coneId);
    const fromCone = data.cones.find((c) => c.id === pathFromId);
    const toCone = data.cones.find((c) => c.id === coneId);
    if (fromCone && toCone) {
      setPendingYards(String(calcYards(fromCone, toCone)));
    }
  };

  const onConePointerUp = (
    e: React.PointerEvent<SVGCircleElement>,
    coneId: string
  ) => {
    e.stopPropagation();
    if (mode === "drawing") {
      if (pathToId) return;
      onConeTapInDrawing(coneId);
      return;
    }
    if (mode === "route") return;
    const drag = dragRef.current;
    if (drag && !drag.moved) {
      setSelectedId(coneId);
      setSelectedRouteId(null);
      setSelectedWaypointId(null);
      setEditingPathIdx(null);
    }
    dragRef.current = null;
    setAlignGuides({ x: null, y: null });
  };

  const onSvgPointerUp = () => {
    dragRef.current = null;
    waypointDragRef.current = null;
    setAlignGuides({ x: null, y: null });
  };

  const onSvgBackgroundClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (mode === "drawing") return;
    if (mode === "route") {
      addRouteWaypoint(e.clientX, e.clientY);
      return;
    }
    if (mode === "ballpath") {
      placeBallPathTarget(e.clientX, e.clientY);
      return;
    }
    setSelectedId(null);
    setSelectedRouteId(null);
    setSelectedWaypointId(null);
    setSelectedBallPathId(null);
    setEditingPathIdx(null);
  };

  const onPathTap = (idx: number) => {
    if (mode !== "normal") return;
    const path = data.paths[idx];
    if (!path) return;
    setSelectedId(null);
    setSelectedRouteId(null);
    setSelectedWaypointId(null);
    setEditingPathIdx(idx);
    setPathFromId(path.from);
    setPathToId(path.to);
    setPendingMovement(path.movement);
    setPendingYards(String(path.yards));
    setPathFormError(null);
  };

  const onRouteTap = (routeId: string) => {
    if (mode !== "normal") return;
    setSelectedId(null);
    setEditingPathIdx(null);
    if (selectedRouteId !== routeId) {
      setSelectedWaypointId(null);
    }
    setSelectedRouteId(routeId);
  };

  const onActiveRouteEndpointTap = (e: React.MouseEvent) => {
    if (mode !== "route") return;
    e.stopPropagation();
    finishActiveRoute();
  };

  const handleConfirmPath = () => {
    if (!pathFromId || !pathToId) return;
    const yards = Number(pendingYards);
    if (!pendingYards.trim() || !Number.isFinite(yards) || yards <= 0) {
      setPathFormError("Enter a yard distance.");
      return;
    }
    const newPath: Path = {
      from: pathFromId,
      to: pathToId,
      movement: pendingMovement,
      yards,
    };
    if (editingPathIdx !== null) {
      const paths = data.paths.map((p, i) => (i === editingPathIdx ? newPath : p));
      update({ ...data, paths });
      exitEditingPath();
    } else {
      update({ ...data, paths: [...data.paths, newPath] });
      exitDrawingMode();
    }
  };

  const handleDeletePath = () => {
    if (editingPathIdx === null) return;
    const paths = data.paths.filter((_, i) => i !== editingPathIdx);
    update({ ...data, paths });
    exitEditingPath();
  };

  const coneById = new Map(data.cones.map((c) => [c.id, c]));
  const selectedCone = selectedId
    ? data.cones.find((c) => c.id === selectedId) ?? null
    : null;
  const selectedRoute = selectedRouteId
    ? data.routes.find((r) => r.id === selectedRouteId) ?? null
    : null;
  const activeRoute = activeRouteId
    ? data.routes.find((r) => r.id === activeRouteId) ?? null
    : null;
  const canFinishRoute = !!activeRoute && activeRoute.waypoints.length >= 2;

  const showPathForm = editingPathIdx !== null;

  return (
    <div className="w-full">
      <div
        className="w-full rounded-lg overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface-base)",
          border: "1px solid var(--color-border-default)",
          aspectRatio: `${VIEW_W} / ${VIEW_H}`,
          touchAction: "none",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full block"
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerCancel={onSvgPointerUp}
          onClick={onSvgBackgroundClick}
        >
          <FootballField />

          {alignGuides.x !== null && (
            <line
              x1={alignGuides.x}
              y1={0}
              x2={alignGuides.x}
              y2={FIELD_H}
              stroke="#D48A30"
              strokeWidth={0.8}
              strokeDasharray="3 3"
              pointerEvents="none"
              opacity={0.7}
            />
          )}
          {alignGuides.y !== null && (
            <line
              x1={0}
              y1={alignGuides.y}
              x2={FIELD_W}
              y2={alignGuides.y}
              stroke="#D48A30"
              strokeWidth={0.8}
              strokeDasharray="3 3"
              pointerEvents="none"
              opacity={0.7}
            />
          )}

          {data.paths.map((path, idx) => {
            const from = coneById.get(path.from);
            const to = coneById.get(path.to);
            if (!from || !to) return null;
            const style = MOVEMENT_STYLES[path.movement];
            const isSelected = editingPathIdx === idx;
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
                  strokeWidth={isSelected ? style.strokeWidth + 2 : style.strokeWidth}
                  strokeDasharray={style.dasharray}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
                <text
                  x={labelX}
                  y={labelY}
                  fontSize={9}
                  fill={PATH_LABEL_COLOR}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {path.yards}yd
                </text>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="transparent"
                  strokeWidth={PATH_HIT_STROKE}
                  strokeLinecap="round"
                  style={{ cursor: mode === "drawing" ? "default" : "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPathTap(idx);
                  }}
                />
              </g>
            );
          })}

          {(data.ballPaths ?? []).map((bp) => {
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
            const isSelected = selectedBallPathId === bp.id;
            return (
              <g key={`bp-${bp.id}`}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={tx}
                  y2={ty}
                  stroke={BALL_PATH_COLOR}
                  strokeWidth={isSelected ? 3 : 2}
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={tx}
                  y2={ty}
                  stroke="transparent"
                  strokeWidth={BALL_PATH_HIT_STROKE}
                  strokeLinecap="round"
                  style={{ cursor: mode === "normal" ? "pointer" : "default" }}
                  onClick={(e) => {
                    if (mode !== "normal") return;
                    e.stopPropagation();
                    setSelectedBallPathId(bp.id);
                    setSelectedId(null);
                    setSelectedRouteId(null);
                    setSelectedWaypointId(null);
                    setEditingPathIdx(null);
                  }}
                />
              </g>
            );
          })}

          {data.routes.map((route) => {
            const isSelected = route.id === selectedRouteId;
            const isActive = route.id === activeRouteId;
            const wps = route.waypoints;
            const last = wps[wps.length - 1];
            const prev = wps[wps.length - 2];
            const lastSeg = route.segments[route.segments.length - 1];
            const arrowPoints = (() => {
              if (wps.length < 2 || !last || !prev) return null;
              const { dx, dy } = lastSegmentArrowDirection(prev, last, lastSeg);
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const arrowSize = 6;
              const p1x = last.x - ux * arrowSize + uy * (arrowSize / 2);
              const p1y = last.y - uy * arrowSize - ux * (arrowSize / 2);
              const p2x = last.x - ux * arrowSize - uy * (arrowSize / 2);
              const p2y = last.y - uy * arrowSize + ux * (arrowSize / 2);
              return `${last.x},${last.y} ${p1x},${p1y} ${p2x},${p2y}`;
            })();
            const segStrokeWidth = isSelected ? 4 : 3;
            return (
              <g key={route.id}>
                {route.segments.map((seg, i) => {
                  const from = wps[i];
                  const to = wps[i + 1];
                  if (!from || !to) return null;
                  return renderRouteSegment(from, to, seg, i, segStrokeWidth);
                })}

                {arrowPoints && (
                  <polygon
                    points={arrowPoints}
                    fill={ROUTE_COLOR}
                    pointerEvents="none"
                  />
                )}

                {wps.length > 0 && (
                  <circle
                    cx={wps[0].x}
                    cy={wps[0].y}
                    r={5}
                    fill="none"
                    stroke={ROUTE_COLOR}
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                )}

                {isActive &&
                  wps.map((wp, i) =>
                    i > 0 && i < wps.length - 1 ? (
                      <circle
                        key={wp.id}
                        cx={wp.x}
                        cy={wp.y}
                        r={2}
                        fill={ROUTE_COLOR}
                        opacity={0.6}
                        pointerEvents="none"
                      />
                    ) : null
                  )}

                {isActive &&
                  insertAfterIndex !== null &&
                  (insertMode === "before" ||
                    insertAfterIndex < wps.length - 1) &&
                  wps[insertAfterIndex] && (
                    <circle
                      cx={wps[insertAfterIndex].x}
                      cy={wps[insertAfterIndex].y}
                      r={7}
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      pointerEvents="none"
                    />
                  )}

                {!isActive &&
                  route.segments.map((seg, i) => {
                    const from = wps[i];
                    const to = wps[i + 1];
                    if (!from || !to) return null;
                    return renderRouteHitTarget(
                      from,
                      to,
                      seg,
                      i,
                      ROUTE_HIT_STROKE,
                      mode === "normal" ? "pointer" : "default",
                      (e) => {
                        e.stopPropagation();
                        onRouteTap(route.id);
                      }
                    );
                  })}

                {isActive && last && (
                  <circle
                    cx={last.x}
                    cy={last.y}
                    r={FINISH_TAP_R}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onClick={onActiveRouteEndpointTap}
                  />
                )}

                {isSelected &&
                  wps.map((wp) => {
                    const isWpSelected = wp.id === selectedWaypointId;
                    return (
                      <g key={`wph-${wp.id}`}>
                        <circle
                          cx={wp.x}
                          cy={wp.y}
                          r={HIT_R}
                          fill="transparent"
                          style={{
                            cursor: "grab",
                            touchAction: "none",
                          }}
                          onPointerDown={(e) =>
                            onWaypointPointerDown(e, route.id, wp.id)
                          }
                          onPointerUp={(e) => onWaypointPointerUp(e, wp.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <circle
                          cx={wp.x}
                          cy={wp.y}
                          r={4}
                          fill={isWpSelected ? "#2563EB" : CONE_COLOR}
                          stroke="#FFFFFF"
                          strokeWidth={1.5}
                          pointerEvents="none"
                        />
                      </g>
                    );
                  })}
              </g>
            );
          })}

          {data.cones.map((cone) => {
            const isSelected = cone.id === selectedId;
            const isPathFrom = mode === "drawing" && pathFromId === cone.id;
            const isQB = cone.kind === "qb";
            const isFootball = cone.kind === "football";
            const baseColor = isQB
              ? QB_COLOR
              : isFootball
                ? FOOTBALL_COLOR
                : CONE_COLOR;
            const ringColor = isPathFrom || isSelected ? "#2563EB" : baseColor;
            const fillColor = isPathFrom || isSelected ? "#2563EB" : baseColor;
            const radius = isQB ? CONE_R + 1 : CONE_R;
            return (
              <g key={cone.id}>
                <circle
                  cx={cone.x}
                  cy={cone.y}
                  r={CONE_HIT_R}
                  fill="transparent"
                  style={{
                    cursor:
                      mode === "drawing"
                        ? "pointer"
                        : mode === "route"
                          ? "default"
                          : mode === "ballpath"
                            ? "crosshair"
                            : "grab",
                    touchAction: "none",
                    pointerEvents:
                      mode === "route" || mode === "ballpath" ? "none" : "auto",
                  }}
                  onPointerDown={(e) => onConePointerDown(e, cone.id)}
                  onPointerUp={(e) => onConePointerUp(e, cone.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                {isFootball ? (
                  <g pointerEvents="none">
                    <ellipse
                      cx={cone.x}
                      cy={cone.y}
                      rx={6}
                      ry={3.5}
                      fill={fillColor}
                      stroke={ringColor}
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
                ) : (
                  <circle
                    cx={cone.x}
                    cy={cone.y}
                    r={radius}
                    fill={fillColor}
                    stroke={ringColor}
                    strokeWidth={1.5}
                    pointerEvents="none"
                  />
                )}
                {isQB && (
                  <text
                    x={cone.x}
                    y={cone.y}
                    fontSize={5}
                    fontWeight={500}
                    fill="#1F1A05"
                    textAnchor="middle"
                    dominantBaseline="central"
                    pointerEvents="none"
                  >
                    QB
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between mt-md gap-md flex-wrap">
        <div className="flex items-center gap-sm flex-wrap">
          <button
            type="button"
            onClick={handleAddCone}
            disabled={mode !== "normal"}
            className="px-lg py-sm rounded-md text-caption font-medium"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
              opacity: mode !== "normal" ? 0.5 : 1,
            }}
          >
            + Add Cone
          </button>
          <button
            type="button"
            onClick={handleAddQB}
            disabled={mode !== "normal"}
            className="px-lg py-sm rounded-md text-caption font-medium"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
              opacity: mode !== "normal" ? 0.5 : 1,
            }}
          >
            + Add QB
          </button>
          <button
            type="button"
            onClick={handleAddFootball}
            disabled={mode !== "normal"}
            className="px-lg py-sm rounded-md text-caption font-medium"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
              opacity: mode !== "normal" ? 0.5 : 1,
            }}
          >
            + Add Football
          </button>
          <button
            type="button"
            onClick={handleStartRouteDrawing}
            aria-pressed={mode === "route"}
            className="px-lg py-sm rounded-md text-caption font-medium"
            style={{
              backgroundColor:
                mode === "route"
                  ? "rgba(212,138,48,0.12)"
                  : "var(--color-surface-raised)",
              color:
                mode === "route"
                  ? "var(--color-orange-400)"
                  : "var(--color-text-primary)",
              border:
                mode === "route"
                  ? "1px solid var(--color-orange-500)"
                  : "1px solid var(--color-border-default)",
            }}
          >
            + Draw Route
          </button>
          {mode === "route" && (
            <span
              className="text-caption"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {activeRoute && insertMode === "before"
                ? "Tap to extend before the highlighted point"
                : activeRoute &&
                    insertAfterIndex !== null &&
                    insertAfterIndex < activeRoute.waypoints.length - 1
                  ? "Tap to insert after the highlighted point"
                  : "Tap the field to place route points"}
            </span>
          )}
        </div>

        {data.cones.length > 0 && (
          <div className="flex items-center gap-sm">
            {confirmingClear && (
              <span
                className="text-caption"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Are you sure?
              </span>
            )}
            <button
              type="button"
              onClick={handleClearAll}
              className="text-caption font-medium"
              style={{
                color: confirmingClear
                  ? "var(--color-error)"
                  : "var(--color-text-muted)",
                background: "transparent",
                padding: "8px 4px",
              }}
            >
              {confirmingClear ? "Clear" : "Clear All"}
            </button>
            {confirmingClear && (
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="text-caption"
                style={{
                  color: "var(--color-text-secondary)",
                  background: "transparent",
                  padding: "8px 4px",
                }}
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {mode === "route" && activeRoute && activeRoute.waypoints.length >= 1 && (
        <div className="mt-md">
          <p
            className="label-micro mb-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Next Segment
          </p>
          <div className="flex gap-sm flex-wrap">
            {SEGMENT_TYPES.map((t) => {
              const selected = pendingSegmentType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setPendingSegmentType(t.value)}
                  aria-pressed={selected}
                  className="rounded-pill text-caption font-medium transition-all"
                  style={{
                    padding: "8px 14px",
                    minHeight: "44px",
                    backgroundColor: selected
                      ? "#5C3308"
                      : "rgba(255,255,255,0.04)",
                    color: selected ? "#F0B870" : "rgba(255,255,255,0.45)",
                    border: selected
                      ? "1px solid #D48A30"
                      : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === "route" && (
        <div className="flex items-center gap-sm mt-md">
          <button
            type="button"
            onClick={finishActiveRoute}
            disabled={!canFinishRoute}
            className="px-lg py-sm rounded-md text-caption font-medium"
            style={{
              backgroundColor: "var(--color-orange-500)",
              color: "#FFFFFF",
              opacity: canFinishRoute ? 1 : 0.5,
            }}
          >
            Done
          </button>
          <button
            type="button"
            onClick={handleUndoLastWaypoint}
            disabled={!activeRoute || activeRoute.waypoints.length === 0}
            className="px-lg py-sm rounded-md text-caption font-medium"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
              opacity:
                !activeRoute || activeRoute.waypoints.length === 0 ? 0.5 : 1,
            }}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleCancelRoute}
            className="text-caption"
            style={{
              color: "var(--color-text-secondary)",
              background: "transparent",
              padding: "8px 4px",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {mode === "ballpath" && (
        <div
          className="mt-md rounded-lg p-lg flex items-center justify-between gap-sm"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          <span
            className="text-caption"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Tap a player or any point to draw the pass line
          </span>
          <button
            type="button"
            onClick={handleCancelBallPath}
            className="text-caption"
            style={{
              color: "var(--color-text-secondary)",
              background: "transparent",
              padding: "8px 4px",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {selectedBallPathId && mode === "normal" && (
        <div
          className="mt-md rounded-lg p-lg flex items-center justify-between gap-sm"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          <p
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Selected Pass Line
          </p>
          <div className="flex items-center gap-md">
            <button
              type="button"
              onClick={handleDeleteBallPath}
              className="text-caption font-medium"
              style={{
                color: "var(--color-error)",
                background: "transparent",
                padding: "8px 4px",
              }}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedBallPathId(null)}
              className="text-caption font-medium"
              style={{
                color: "var(--color-text-secondary)",
                background: "transparent",
                padding: "8px 4px",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {selectedRoute && mode === "normal" && (
        <div
          className="mt-md rounded-lg p-lg flex flex-col gap-sm"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          <p
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Selected Route
          </p>
          <div className="flex items-center justify-between flex-wrap gap-sm">
            <div className="flex items-center gap-sm flex-wrap">
              <button
                type="button"
                onClick={handleContinueRoute}
                className="px-lg py-sm rounded-md text-caption font-medium"
                style={{
                  backgroundColor: "var(--color-orange-500)",
                  color: "#FFFFFF",
                }}
              >
                Continue
              </button>
              {selectedWaypointId && (
                <button
                  type="button"
                  onClick={handleDeleteWaypoint}
                  className="px-lg py-sm rounded-md text-caption font-medium"
                  style={{
                    backgroundColor: "var(--color-surface-base)",
                    color: "var(--color-error)",
                    border: "1px solid var(--color-border-default)",
                  }}
                >
                  Delete Point
                </button>
              )}
              <button
                type="button"
                onClick={handleDeleteRoute}
                className="text-caption font-medium"
                style={{
                  color: "var(--color-error)",
                  background: "transparent",
                  padding: "8px 4px",
                }}
              >
                Delete Route
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedRouteId(null);
                setSelectedWaypointId(null);
              }}
              className="text-caption font-medium"
              style={{
                color: "var(--color-text-secondary)",
                background: "transparent",
                padding: "8px 4px",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {showPathForm && (
        <div
          className="mt-md rounded-lg p-lg flex flex-col gap-sm"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          <p
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {editingPathIdx !== null ? "Edit Path" : "New Path"}
          </p>

          <div className="flex gap-sm flex-wrap">
            {MOVEMENTS.map((m) => {
              const selected = pendingMovement === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPendingMovement(m)}
                  aria-pressed={selected}
                  className="rounded-pill text-caption font-medium transition-all capitalize"
                  style={{
                    padding: "8px 14px",
                    minHeight: "44px",
                    backgroundColor: selected
                      ? "#5C3308"
                      : "rgba(255,255,255,0.04)",
                    color: selected ? "#F0B870" : "rgba(255,255,255,0.45)",
                    border: selected
                      ? "1px solid #D48A30"
                      : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {MOVEMENT_STYLES[m].label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-sm">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={pendingYards}
              onChange={(e) => setPendingYards(e.target.value)}
              placeholder="0"
              className="rounded-md px-md text-body outline-none"
              style={{
                width: "72px",
                height: "44px",
                backgroundColor: "var(--color-surface-base)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
              }}
            />
            <span
              className="text-caption"
              style={{ color: "var(--color-text-secondary)" }}
            >
              yards
            </span>
          </div>

          {pathFormError && (
            <p
              className="text-caption"
              style={{ color: "var(--color-error-light)" }}
            >
              {pathFormError}
            </p>
          )}

          <div className="flex items-center justify-between mt-xs">
            <button
              type="button"
              onClick={handleConfirmPath}
              className="px-lg py-sm rounded-md text-caption font-medium"
              style={{
                backgroundColor: "var(--color-orange-500)",
                color: "#FFFFFF",
              }}
            >
              {editingPathIdx !== null ? "Update" : "Add Path"}
            </button>

            <div className="flex items-center gap-md">
              {editingPathIdx !== null && (
                <button
                  type="button"
                  onClick={handleDeletePath}
                  className="text-caption font-medium"
                  style={{
                    color: "var(--color-error)",
                    background: "transparent",
                    padding: "8px 4px",
                  }}
                >
                  Delete Path
                </button>
              )}
              <button
                type="button"
                onClick={
                  editingPathIdx !== null ? exitEditingPath : exitDrawingMode
                }
                className="text-caption"
                style={{
                  color: "var(--color-text-secondary)",
                  background: "transparent",
                  padding: "8px 4px",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCone && !showPathForm && mode !== "drawing" && (
        <div
          className="mt-md rounded-lg p-lg flex flex-col gap-sm"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          <p
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Selected Cone
          </p>
          <input
            type="text"
            value={selectedCone.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="e.g., Start, Finish"
            className="w-full rounded-md px-md py-sm text-body"
            style={{
              backgroundColor: "var(--color-surface-base)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-default)",
            }}
          />
          {selectedCone.kind === "football" && (
            <button
              type="button"
              onClick={handleStartBallPath}
              className="px-lg py-sm rounded-md text-caption font-medium self-start"
              style={{
                backgroundColor: "var(--color-surface-base)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
              }}
            >
              + Add Pass Line
            </button>
          )}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="text-caption font-medium"
              style={{
                color: "var(--color-error)",
                background: "transparent",
                padding: "8px 4px",
              }}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-caption font-medium"
              style={{
                color: "var(--color-text-secondary)",
                background: "transparent",
                padding: "8px 4px",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FootballField() {
  // Yard lines run horizontally; depth grows from bottom (0) to top (25).
  const lines: React.ReactNode[] = [];
  for (let depth = 0; depth <= FIELD_YARDS_Y; depth++) {
    const y = FIELD_H - depth * YARD;
    const isTen = depth % 10 === 0;
    const isFive = depth % 5 === 0;
    const stroke = isTen ? LINE_10 : isFive ? LINE_5 : LINE_1;
    const strokeWidth = isTen ? 1 : isFive ? 0.8 : 0.4;
    lines.push(
      <line
        key={`yl-${depth}`}
        x1={0}
        y1={y}
        x2={FIELD_W}
        y2={y}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }

  // Hash marks at 1/3 and 2/3 of field width
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

  // Yard numbers in the left margin (outside the field) at every 5 yards
  const numbers: React.ReactNode[] = [];
  for (let depth = 0; depth <= FIELD_YARDS_Y; depth += 5) {
    const y = FIELD_H - depth * YARD;
    numbers.push(
      <text
        key={`nl-${depth}`}
        x={-4}
        y={y}
        fontSize={7}
        fill={NUMBER_COLOR}
        textAnchor="end"
        dominantBaseline="middle"
      >
        {depth}
      </text>
    );
  }

  return (
    <g pointerEvents="none">
      <rect x={0} y={0} width={FIELD_W} height={FIELD_H} fill={FIELD_BG} />
      {lines}
      {hashes}
      {/* Sidelines */}
      <line x1={0} y1={0} x2={0} y2={FIELD_H} stroke={SIDELINE} strokeWidth={1} />
      <line
        x1={FIELD_W}
        y1={0}
        x2={FIELD_W}
        y2={FIELD_H}
        stroke={SIDELINE}
        strokeWidth={1}
      />
      {numbers}
    </g>
  );
}
