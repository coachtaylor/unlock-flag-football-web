type Cone = { x: number; y: number; n: number; color: string };

const CONES: Cone[] = [
  { x: 100, y: 220, n: 1, color: "#FF6A1A" },
  { x: 100, y: 140, n: 2, color: "#FF6A1A" },
  { x: 100, y: 60, n: 3, color: "#FF6A1A" },
  { x: 220, y: 140, n: 4, color: "#6EA8FF" },
  { x: 360, y: 60, n: 5, color: "#C2FF3D" },
  { x: 360, y: 220, n: 6, color: "#C2FF3D" },
];

export default function DiagramPreview({
  width = 480,
  height = 280,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        <pattern id="grass" width="32" height="32" patternUnits="userSpaceOnUse">
          <rect width="32" height="32" fill="#0E1815" />
          <rect width="16" height="32" fill="#11201C" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#grass)" />
      {[0.2, 0.4, 0.6, 0.8].map((p) => (
        <line
          key={p}
          x1={width * p}
          y1={0}
          x2={width * p}
          y2={height}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
      ))}
      {[10, 20, 30, 40].map((n, i) => (
        <text
          key={n}
          x={width * (0.2 + i * 0.2)}
          y={height - 8}
          fill="rgba(255,255,255,0.35)"
          fontSize="9"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          {n}
        </text>
      ))}
      {Array.from({ length: 20 }).map((_, i) => (
        <line
          key={i}
          x1={i * 24}
          y1={height / 2 - 4}
          x2={i * 24}
          y2={height / 2 + 4}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
      ))}
      <path
        d={`M ${CONES[0].x} ${CONES[0].y} L ${CONES[3].x} ${CONES[3].y} L ${CONES[4].x} ${CONES[4].y}`}
        stroke="#FF6A1A"
        strokeWidth="2.5"
        fill="none"
        strokeDasharray="6 4"
      />
      <path
        d={`M ${CONES[2].x} ${CONES[2].y} Q ${CONES[2].x + 60} ${CONES[2].y + 40} ${CONES[3].x} ${CONES[3].y} T ${CONES[5].x} ${CONES[5].y}`}
        stroke="#C2FF3D"
        strokeWidth="2.5"
        fill="none"
      />
      <polygon
        points={`${CONES[4].x - 8},${CONES[4].y - 4} ${CONES[4].x},${CONES[4].y} ${CONES[4].x - 8},${CONES[4].y + 4}`}
        fill="#FF6A1A"
      />
      {CONES.map((c) => (
        <g key={c.n}>
          <circle cx={c.x} cy={c.y} r="14" fill="rgba(0,0,0,0.6)" />
          <circle cx={c.x} cy={c.y} r="12" fill={c.color} />
          <text
            x={c.x}
            y={c.y + 3.5}
            fill="#000"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            textAnchor="middle"
          >
            {c.n}
          </text>
        </g>
      ))}
      <circle
        cx={CONES[3].x}
        cy={CONES[3].y}
        r="20"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
    </svg>
  );
}
