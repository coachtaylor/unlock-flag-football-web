export default function SectionEyebrow({
  index,
  label,
}: {
  index: string;
  label: string;
}) {
  return (
    <div className="eyebrow" style={{ marginBottom: 16 }}>
      <span className="mono" style={{ color: "var(--text-muted)" }}>{index}</span>
      <span className="tick" />
      <span>{label}</span>
    </div>
  );
}
