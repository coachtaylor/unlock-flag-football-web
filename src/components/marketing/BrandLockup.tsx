type Size = "default" | "large" | "small";

const SIZES: Record<Size, { mark: number; gap: number; label: number; sub: number }> = {
  default: { mark: 28, gap: 10, label: 13, sub: 10 },
  large: { mark: 36, gap: 12, label: 15, sub: 11 },
  small: { mark: 24, gap: 8, label: 12, sub: 9 },
};

export default function BrandLockup({ size = "default" }: { size?: Size }) {
  const s = SIZES[size];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: s.gap }}>
      <div
        className="brand-mark"
        style={{ width: s.mark, height: s.mark, fontSize: s.mark * 0.5 }}
      >
        U
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, lineHeight: 1 }}>
        <span
          style={{
            fontSize: s.label,
            fontWeight: 500,
            letterSpacing: -0.1,
            color: "var(--text-primary)",
          }}
        >
          Unlock<span style={{ color: "var(--accent)" }}>.</span>
        </span>
        <span
          className="mono"
          style={{
            fontSize: s.sub,
            color: "var(--text-muted)",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Flag football
        </span>
      </div>
    </div>
  );
}
