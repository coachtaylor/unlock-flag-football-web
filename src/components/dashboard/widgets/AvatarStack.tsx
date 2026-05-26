type P = { initials: string; color: string };

export default function AvatarStack({
  players,
  size = 22,
  max = 6,
}: {
  players: P[];
  size?: number;
  max?: number;
}) {
  const show = players.slice(0, max);
  const rest = players.length - show.length;
  return (
    <div style={{ display: "flex" }}>
      {show.map((p, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: p.color,
            color: "#0a0a0d",
            fontSize: size * 0.42,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: i ? -size * 0.3 : 0,
            border: "2px solid var(--uff-ink)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {p.initials}
        </div>
      ))}
      {rest > 0 && (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: "var(--uff-surface-2)",
            color: "var(--uff-text-dim)",
            fontSize: size * 0.36,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: -size * 0.3,
            border: "2px solid var(--uff-ink)",
          }}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}
