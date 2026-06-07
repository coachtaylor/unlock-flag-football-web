// Chronological per-player observations feed (player_notes). One source of
// truth shared by the roster player-detail page and the Team Scouting Report
// side sheet. Takes raw player_notes rows (with the practice join) and maps
// them internally so both surfaces agree on date/title/link resolution.
//
// Extracted from roster/[playerId]/page.tsx (Build 8.7 Phase 3). The optional
// `footer` slot is where the sheet mounts its add-note form; the roster page
// passes nothing and keeps a pure read feed.

import Link from "next/link";

type PracticeJoin = {
  id: string;
  title: string | null;
  practice_date: string | null;
};

// Raw player_notes row shape (superset OK). Pass the rows straight from the
// `player_notes` select with `practice_plans(id, title, practice_date)`.
export type ObservationRowData = {
  id: string;
  note_text: string;
  created_at: string;
  practice_plan_id: string | null;
  practice_plans: PracticeJoin | PracticeJoin[] | null;
};

type Observation = {
  id: string;
  noteText: string;
  practiceId: string | null;
  practiceTitle: string | null;
  practiceDate: string | null;
  createdAt: string;
};

export function mapObservations(rows: ObservationRowData[]): Observation[] {
  return rows.map((o) => {
    const join = o.practice_plans;
    const practice = Array.isArray(join) ? join[0] : join;
    return {
      id: o.id,
      noteText: o.note_text,
      practiceId: practice?.id ?? o.practice_plan_id ?? null,
      practiceTitle: practice?.title ?? null,
      practiceDate: practice?.practice_date ?? null,
      createdAt: o.created_at,
    };
  });
}

export default function ObservationsFeed({
  rows,
  practiceBase = "/practice",
  footer,
  bare = false,
}: {
  rows: ObservationRowData[];
  // Base path for the practice deep-link. Roster uses the legacy "/practice";
  // the scouting sheet passes a team-scoped base.
  practiceBase?: string;
  footer?: React.ReactNode;
  // When true, render content only (no card / no header) — the caller (e.g.
  // CollapsibleSection on the player page) supplies the card chrome + count.
  bare?: boolean;
}) {
  const observations = mapObservations(rows);
  const empty = observations.length === 0;

  const body = (
    <>
      {empty ? (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "var(--uff-text-mute)",
            lineHeight: 1.5,
          }}
        >
          No observations yet. Captains can write per-player notes from the
          post-practice log — they&apos;ll show up here.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {observations.map((o) => (
            <ObservationRow key={o.id} obs={o} practiceBase={practiceBase} />
          ))}
        </div>
      )}

      {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
    </>
  );

  if (bare) return body;

  return (
    <div className="w-card" style={{ padding: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--uff-text-mute)",
          }}
        >
          Observations
        </div>
        {!empty && (
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 11,
              color: "var(--uff-text-mute)",
            }}
          >
            {observations.length}
          </span>
        )}
      </div>
      {body}
    </div>
  );
}

function ObservationRow({
  obs,
  practiceBase,
}: {
  obs: Observation;
  practiceBase: string;
}) {
  const dateLabel = (obs.practiceDate ?? obs.createdAt)
    ? new Date(obs.practiceDate ?? obs.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "2-digit",
      })
    : "";
  const title = obs.practiceTitle || "Practice";
  const href = obs.practiceId ? `${practiceBase}/${obs.practiceId}` : null;

  return (
    <div
      style={{
        padding: "8px 10px",
        background: "var(--uff-bg-1)",
        border: "1px solid var(--uff-line-soft, rgba(255,255,255,0.04))",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 4,
        }}
      >
        {href ? (
          <Link
            href={href}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--uff-orange)",
              textDecoration: "none",
              letterSpacing: "0.02em",
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </Link>
        ) : (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--uff-text)",
              opacity: 0.7,
              letterSpacing: "0.02em",
            }}
          >
            {title}
          </span>
        )}
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 10.5,
            color: "var(--uff-text-mute)",
            whiteSpace: "nowrap",
          }}
        >
          {dateLabel}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--uff-text)",
          opacity: 0.88,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {obs.noteText}
      </p>
    </div>
  );
}
