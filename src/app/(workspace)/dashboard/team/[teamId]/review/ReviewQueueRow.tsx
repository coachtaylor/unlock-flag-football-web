"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { clearNeedsReview } from "./actions";

type Props = {
  teamId: string;
  resultId: string;
  drillId: string;
  drillName: string;
  playerName: string;
  benchmarkType: string;
  value: string;
  assessmentDate: string;
  capturedOn: string;
  entryMode: string;
  assessorName?: string | null;
  tags: string[];
  notes: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  benchmark: "Benchmark",
  practice_quick: "Mid-practice",
  self_report: "Self report",
};

export default function ReviewQueueRow({
  teamId,
  resultId,
  drillId,
  drillName,
  playerName,
  benchmarkType,
  value,
  assessmentDate,
  capturedOn,
  entryMode,
  assessorName,
  tags,
  notes,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  function handleClear() {
    setError(null);
    startTransition(async () => {
      const result = await clearNeedsReview({ resultId, teamId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCleared(true);
    });
  }

  if (cleared) return null;

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid var(--uff-line)",
        background: "var(--uff-surface-raised, rgba(255,255,255,0.02))",
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 15,
              color: "var(--uff-text)",
              fontWeight: 500,
              lineHeight: 1.3,
            }}
          >
            {playerName}{" "}
            <span style={{ color: "var(--uff-text-dim)", fontWeight: 400 }}>
              on{" "}
            </span>
            <Link
              href={`/drills/${drillId}`}
              style={{
                color: "var(--color-orange-400, #F0B870)",
                textDecoration: "none",
              }}
            >
              {drillName}
            </Link>
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--uff-text-mute)",
              marginTop: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {SOURCE_LABEL[entryMode] ?? entryMode} · {capturedOn} ·{" "}
            {assessmentDate}
            {assessorName ? ` · by ${assessorName}` : ""}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--uff-text-mute)",
              marginBottom: 2,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {benchmarkType}
          </p>
          <p
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "var(--uff-text)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </p>
        </div>
      </div>

      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 12,
                padding: "3px 10px",
                borderRadius: 9999,
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.65)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {notes && (
        <p
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "var(--uff-text-dim)",
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
          }}
        >
          {notes}
        </p>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 14,
        }}
      >
        {error ? (
          <p style={{ fontSize: 12, color: "#FF6B6B" }}>{error}</p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleClear}
          disabled={isPending}
          className="wbtn"
          style={{ opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? "Clearing…" : "Clear flag"}
        </button>
      </div>
    </div>
  );
}
