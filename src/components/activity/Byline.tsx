import { formatActorTime } from "@/lib/time";

// Subtle attribution byline shown on detail cards (Build 14.5).
// Presentational only — the caller resolves the actor name. Renders nothing if
// there's no actor to credit, so it never shows a half-empty "·".
//
// Collaborative artifacts (drills, practice plans) pass the LAST editor with
// verb="Updated" (falling back to creator + "Created" when never edited).
// Point-in-time records (notes, benchmark results) pass the author with the
// verb that fits ("Logged", "Assessed", "Noted").
export default function Byline({
  who,
  verb = "Updated",
  at,
  className,
}: {
  who: string | null | undefined;
  verb?: string;
  at: string | null | undefined;
  className?: string;
}) {
  if (!who) return null;
  const when = formatActorTime(at);
  return (
    <span
      className={className}
      style={{
        fontSize: 12,
        color: "var(--uff-text-dim)",
        fontFamily: "var(--font-mono)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "var(--uff-text-mute)" }}>{verb} by</span>
      <span style={{ color: "var(--uff-text)" }}>{who}</span>
      {when && <span style={{ color: "var(--uff-text-mute)" }}>· {when}</span>}
    </span>
  );
}
