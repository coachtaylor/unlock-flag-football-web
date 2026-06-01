// Shared uppercase section label for the roster's two tables ("Coaching
// staff" and "Players"), so both headers read identically.

export default function SectionLabel({
  label,
  note,
}: {
  label: string;
  note?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--uff-text-mute)",
        }}
      >
        {label}
      </h2>
      {note && (
        <span style={{ fontSize: 11.5, color: "var(--uff-text-mute)" }}>{note}</span>
      )}
    </div>
  );
}
