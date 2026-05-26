// Hand-rolled SVG sparkline. Build 7 plan explicitly defers Recharts to
// Build 8 for the dashboard pulses — this is two paths and no JS, so it
// stays in this file.

type Props = {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
  fill?: boolean;
};

export default function Spark({
  data,
  color = "var(--uff-orange)",
  w = 84,
  h = 36,
  fill = true,
}: Props) {
  if (!data.length || data.every((v) => v === 0)) {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
        <line
          x1={0}
          y1={h - 1}
          x2={w}
          y2={h - 1}
          stroke="var(--uff-line-soft)"
          strokeDasharray="2 3"
        />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(0.0001, max - min);
  const pts = data.map((v, i) => [
    (i / Math.max(1, data.length - 1)) * w,
    h - ((v - min) / span) * (h - 4) - 2,
  ]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const fillPath = `${d} L${w} ${h} L0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {fill && <path d={fillPath} fill={color} opacity="0.16" />}
      <path
        d={d}
        stroke={color}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
