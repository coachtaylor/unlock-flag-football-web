// Mini football-field glyph used in the format segmented control.
// `dots` controls the number of cone marks (5 for 5v5, 7 for 7v7, etc.).

type Props = { w?: number; dots?: number };

export default function FieldIcon({ w = 18, dots = 5 }: Props) {
  // Avoid division by zero when dots <= 1.
  const safeDivisor = Math.max(dots - 1, 1);
  return (
    <svg width={w} height={w * 0.62} viewBox="0 0 18 11" fill="none">
      <rect
        x="0.5"
        y="0.5"
        width="17"
        height="10"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.6"
      />
      {Array.from({ length: dots }).map((_, i) => (
        <line
          key={i}
          x1={3 + (i * 12) / safeDivisor}
          y1="1.5"
          x2={3 + (i * 12) / safeDivisor}
          y2="9.5"
          stroke="currentColor"
          strokeWidth="0.6"
          opacity="0.4"
        />
      ))}
    </svg>
  );
}
