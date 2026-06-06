import Link from "next/link";
import { Icon } from "@/components/uff/icons";
import AvatarStack from "./AvatarStack";
import SectionHead from "./SectionHead";
import type { NextPractice } from "@/lib/dashboard/team-home-data";

function formatDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(t: string | null) {
  if (!t) return null;
  // t is HH:MM:SS
  const [hh, mm] = t.split(":").map(Number);
  const am = hh < 12;
  const h = hh % 12 || 12;
  return `${h}:${String(mm).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

export default function NextPracticeCard({
  practice,
  teamId,
}: {
  practice: NextPractice | null;
  teamId: string;
}) {
  const practiceBase = `/dashboard/team/${teamId}/practice`;
  if (!practice) {
    return (
      <div className="w-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionHead label="Next practice" meta="LOCKED" />
        <div
          style={{
            border: "1px dashed var(--uff-line)",
            borderRadius: 10,
            padding: 24,
            textAlign: "center",
            color: "var(--uff-text-dim)",
            fontSize: 13,
          }}
        >
          No practice scheduled yet.
          <br />
          <Link
            href={`${practiceBase}/new`}
            className="wbtn"
            style={{ marginTop: 12, display: "inline-flex" }}
          >
            <Icon.plus size={12} /> Plan a practice
          </Link>
        </div>
      </div>
    );
  }
  const totalStripe = practice.blockStripe.reduce((s, b) => s + b.dur, 0) || 1;
  const time = formatTime(practice.startTime);
  return (
    <div className="w-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHead
        label="Next practice"
        meta={`${practice.status.toUpperCase()} · ${practice.durationMin || 60} MIN`}
      />
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--uff-text)" }}>
          {practice.title || "Untitled practice"}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--uff-text-dim)", marginTop: 4 }}>
          {formatDate(practice.practiceDate)}
          {time ? ` · ${time}` : ""}
          {practice.blockCount ? ` · ${practice.blockCount} blocks` : ""}
        </div>
      </div>
      <div>
        <div
          style={{
            height: 8,
            display: "flex",
            borderRadius: 999,
            overflow: "hidden",
            background: "var(--uff-line-soft)",
          }}
        >
          {practice.blockStripe.map((p, i) => (
            <div
              key={i}
              style={{
                flex: p.dur / totalStripe,
                background: p.color,
                opacity: 0.9,
                borderRight:
                  i < practice.blockStripe.length - 1 ? "1px solid var(--uff-ink)" : "none",
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--uff-text-mute)",
            letterSpacing: "0.06em",
          }}
        >
          <span>{time ?? "—"}</span>
          <span>{practice.durationMin || 60} MIN PLANNED</span>
          <span>{practice.blockCount} BLOCKS</span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 4,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AvatarStack players={practice.attendees} size={22} max={6} />
          <span style={{ fontSize: 11.5, color: "var(--uff-text-dim)" }}>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--uff-lime)" }}>
              {practice.rsvpYes}
            </span>{" "}
            attending
            {practice.rsvpUnknown > 0 ? ` · ${practice.rsvpUnknown} unknown` : ""}
          </span>
        </div>
        <Link
          href={
            practice.blockCount > 0
              ? `${practiceBase}/${practice.id}`
              : `${practiceBase}/${practice.id}/edit`
          }
          className="wbtn"
          style={{ height: 32, padding: "0 12px", fontSize: 12 }}
        >
          {practice.blockCount > 0 ? "Open practice" : "Finish setting up"}{" "}
          <Icon.chevR size={12} />
        </Link>
      </div>
    </div>
  );
}
