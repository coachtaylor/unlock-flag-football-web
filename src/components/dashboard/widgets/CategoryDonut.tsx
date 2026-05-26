// Hand-rolled SVG donut for the drill-mix widget. Each segment is a
// stroke-dasharray slice of one circle.

type Entry = { key: string; label: string; count: number; color: string };

export default function CategoryDonut({
  entries,
  size = 120,
  stroke = 12,
}: {
  entries: Entry[];
  size?: number;
  stroke?: number;
}) {
  const total = Math.max(0, entries.reduce((s, e) => s + e.count, 0));
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--uff-line)"
          strokeWidth={stroke}
          fill="none"
        />
        {total > 0 &&
          entries.map((e) => {
            const frac = e.count / total;
            const len = C * frac;
            const off = -C * acc;
            acc += frac;
            return (
              <circle
                key={e.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={e.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={off}
                strokeLinecap="butt"
              />
            );
          })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1,
            color: "var(--uff-text)",
          }}
        >
          {total}
        </span>
        <span
          style={{
            fontSize: 9.5,
            color: "var(--uff-text-mute)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginTop: 4,
            fontWeight: 700,
          }}
        >
          drills
        </span>
      </div>
    </div>
  );
}
