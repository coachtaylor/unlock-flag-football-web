"use client";

// Practice list (Build 5.5) — mirrors the mobile Practice tab pattern:
// stats strip → "Up next" featured card → "This week" + "Recent" sections.
// All cards share the same colored block-mix bar so the shape of a plan
// reads at a glance.

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlanSummary, PlanStatus } from "@/lib/practice/plan-data";
import { blockColor } from "@/lib/practice/block-colors";
import {
  PracticeStatusPill,
  DateTile,
  AvatarStack,
  SummaryMixBar,
  PIcon,
  formatDateLabel,
  formatTimeLabel,
  durLabel,
} from "@/components/practice/atoms";
import { duplicatePlanAndRedirect, newPlanAndRedirect } from "@/lib/practice/actions";

type ConfirmedAvatar = { initials: string; color: string };

export type ListProps = {
  teamId: string;
  teamName: string;
  plans: PlanSummary[];
  rosterSize: number;
  rosterByPlan: Record<string, ConfirmedAvatar[]>;
  stats: { practices: number; attendPct: number; fieldMin: number; avgDrills: number };
};

export default function PracticeListClient({
  teamId,
  plans,
  rosterSize,
  rosterByPlan,
  stats,
}: ListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (plans.length === 0) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <EmptyListState teamId={teamId} />
        </div>
      </div>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const completed = plans
    .filter((p) => p.status === "completed")
    .sort((a, b) => (a.practice_date < b.practice_date ? 1 : -1));
  const upcoming = plans
    .filter((p) => p.status === "scheduled" || p.status === "live" || p.status === "draft" || p.practice_date >= todayIso)
    .filter((p) => p.status !== "completed")
    .sort((a, b) => (a.practice_date > b.practice_date ? 1 : -1));
  const next = upcoming[0];
  const thisWeek = upcoming.slice(1);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <StatsRow
          lastN={stats.practices}
          attendPct={stats.attendPct}
          fieldMin={stats.fieldMin}
          avgDrills={stats.avgDrills}
        />

        {next && (
          <div>
            <SectionLabel label="Up next" right={<RelativeWhen iso={next.practice_date} />} />
            <FeaturedPlanCard
              plan={next}
              avatars={rosterByPlan[next.id] ?? []}
              rosterSize={rosterSize}
              isPending={isPending}
              onDuplicate={() => {
                const fd = new FormData();
                fd.set("planId", next.id);
                startTransition(() => duplicatePlanAndRedirect(fd));
              }}
            />
          </div>
        )}

        {thisWeek.length > 0 && (
          <div>
            <SectionLabel label="This week" count={thisWeek.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {thisWeek.map((p) => (
                <PlanSummaryCard key={p.id} plan={p} />
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div>
            <SectionLabel label="Recent" count={completed.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {completed.map((p) => (
                <PlanSummaryCard key={p.id} plan={p} completed />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stats row (single inline line, no card chrome) ─────────────────────
function StatsRow({
  lastN,
  attendPct,
  fieldMin,
  avgDrills,
}: {
  lastN: number;
  attendPct: number;
  fieldMin: number;
  avgDrills: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 14,
        flexWrap: "wrap",
        padding: "8px 0",
        borderBottom: "1px solid var(--uff-line-soft)",
        fontSize: 12.5,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
          textTransform: "uppercase",
        }}
      >
        Last {lastN}
      </span>
      <InlineStat value={`${attendPct}%`} label="attend" valueColor="var(--uff-lime)" />
      <InlineStat value={`${fieldMin}m`} label="on field" />
      <InlineStat value={avgDrills.toFixed(1)} label="avg drills" />
    </div>
  );
}

function InlineStat({ value, label, valueColor }: { value: string; label: string; valueColor?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
      <span
        className="mono"
        style={{
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 14,
          fontWeight: 700,
          color: valueColor ?? "var(--uff-text)",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </span>
      <span style={{ color: "var(--uff-text-mute)", fontSize: 11.5 }}>{label}</span>
    </span>
  );
}

// ── Section label (tiny uppercase signpost, no decorative rule) ────────
function SectionLabel({
  label,
  count,
  right,
}: {
  label: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
          textTransform: "uppercase",
        }}
      >
        {label}
        {count != null && (
          <span style={{ marginLeft: 6, opacity: 0.7 }}>{count}</span>
        )}
      </span>
      <span style={{ flex: 1 }} />
      {right}
    </div>
  );
}

function RelativeWhen({ iso }: { iso: string }) {
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const ms = d.getTime() - now.getTime();
  const day = 24 * 60 * 60 * 1000;
  let label = "";
  if (ms < 0) label = "past";
  else if (ms < day) label = "Today";
  else {
    const diff = Math.round(ms / day);
    label =
      diff === 1
        ? "Tomorrow"
        : diff < 7
        ? `in ${diff}d`
        : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return (
    <span
      className="mono"
      style={{
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: 11.5,
        color: "var(--uff-text-dim)",
        letterSpacing: ".04em",
      }}
    >
      {label}
    </span>
  );
}

// ── Featured "Up next" card ────────────────────────────────────────────
function FeaturedPlanCard({
  plan,
  avatars,
  rosterSize,
  isPending,
  onDuplicate,
}: {
  plan: PlanSummary;
  avatars: ConfirmedAvatar[];
  rosterSize: number;
  isPending: boolean;
  onDuplicate: () => void;
}) {
  return (
    <div
      style={{
        background: "#15110d",
        border: "1px solid var(--uff-orange)",
        borderRadius: 12,
        padding: 12,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <DateTile iso={plan.practice_date} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <PracticeStatusPill status={plan.status} mini />
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="icon-btn"
              title="Duplicate plan"
              style={{ width: 26, height: 26 }}
              onClick={onDuplicate}
              disabled={isPending}
            >
              <PIcon.copy size={12} />
            </button>
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--uff-text)",
              lineHeight: 1.2,
            }}
          >
            {plan.title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 4,
              fontSize: 11.5,
              color: "var(--uff-text-dim)",
            }}
          >
            {plan.start_time && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <PIcon.clock size={11} /> {formatTimeLabel(plan.start_time)}
              </span>
            )}
            <span style={{ color: "var(--uff-line)" }}>·</span>
            <span className="mono" style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>
              {durLabel(plan.total_minutes)}
            </span>
            <span style={{ color: "var(--uff-line)" }}>·</span>
            <span>
              {plan.drill_count}d · {plan.block_count}b
            </span>
            {plan.rsvp_in > 0 && (
              <>
                <span style={{ color: "var(--uff-line)" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <PIcon.people size={11} /> {plan.rsvp_in}/{rosterSize}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
        {avatars.length > 0 && <AvatarStack items={avatars} size={20} max={5} />}
        {/* Mix bar takes the available space between avatars and action buttons.
            Capped at maxWidth so it doesn't sprawl across the whole row. */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: 280, marginRight: 4 }}>
          <SummaryMixBar blocks={plan.blocks} breakMinutes={plan.break_minutes} height={6} />
        </div>
        <Link
          href={`/practice/${plan.id}/edit`}
          style={{
            height: 30,
            padding: "0 12px",
            display: "inline-flex",
            alignItems: "center",
            color: "var(--uff-text-dim)",
            fontSize: 12.5,
            fontWeight: 600,
            textDecoration: "none",
            background: "transparent",
            border: 0,
          }}
        >
          Edit
        </Link>
        <Link
          href={`/practice/${plan.id}`}
          className="wbtn primary"
          style={{ height: 30, padding: "0 14px", fontSize: 12.5, gap: 5, textDecoration: "none" }}
        >
          Open plan
        </Link>
      </div>
    </div>
  );
}

// ── Plan summary card (This week + Recent rows) ────────────────────────
function PlanSummaryCard({ plan, completed }: { plan: PlanSummary; completed?: boolean }) {
  return (
    <Link
      href={`/practice/${plan.id}`}
      style={{
        background: "var(--uff-surface)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        textDecoration: "none",
      }}
    >
      <CompactDate iso={plan.practice_date} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--uff-text)",
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {plan.title}
          </div>
          <PracticeStatusPill status={plan.status} mini />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 11.5,
            color: "var(--uff-text-dim)",
          }}
        >
          {/* Drill info — left-aligned, doesn't grow */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            {plan.start_time && (
              <>
                <span className="mono" style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>
                  {formatTimeLabel(plan.start_time)}
                </span>
                <span style={{ color: "var(--uff-line)" }}>·</span>
              </>
            )}
            <span className="mono" style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>
              {durLabel(plan.total_minutes)}
            </span>
            <span style={{ color: "var(--uff-line)" }}>·</span>
            <span>
              {plan.drill_count}d · {plan.block_count}b
            </span>
            {completed && plan.rsvp_in > 0 && (
              <>
                <span style={{ color: "var(--uff-line)" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <PIcon.people size={11} /> {plan.rsvp_in}
                </span>
              </>
            )}
          </div>
          {/* Mix bar — right-aligned, fills remaining space, capped so it stays readable */}
          {plan.blocks.length > 0 && (
            <div style={{ flex: 1, minWidth: 60, maxWidth: 220, marginLeft: "auto" }}>
              <SummaryMixBar blocks={plan.blocks} breakMinutes={plan.break_minutes} height={5} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// Tighter inline date stamp for summary rows — replaces the 60×60 DateTile.
function CompactDate({ iso }: { iso: string }) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  const mon = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = String(d.getDate());
  return (
    <div
      style={{
        width: 40,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".14em", color: "var(--uff-text-mute)" }}>
        {mon}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: "var(--uff-text)",
          marginTop: 2,
          letterSpacing: "-0.02em",
        }}
      >
        {day}
      </span>
    </div>
  );
}

function EmptyListState({ teamId }: { teamId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div
      style={{
        padding: "40px 32px",
        border: "1px dashed var(--uff-line)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.015)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "rgba(255,106,26,0.10)",
          border: "1px solid rgba(255,106,26,0.30)",
          color: "var(--uff-orange)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <PIcon.cal size={24} />
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>No practice plans yet.</div>
        <div style={{ fontSize: 13, color: "var(--uff-text-dim)", marginTop: 6, maxWidth: 420 }}>
          Build your first plan from blocks — warm-up, install, scrimmage — and reuse them across the season.
        </div>
      </div>
      <form
        action={(fd) => {
          startTransition(() => newPlanAndRedirect(fd));
        }}
      >
        <input type="hidden" name="teamId" value={teamId} />
        <button type="submit" className="wbtn primary" disabled={isPending}>
          <PIcon.plus size={14} /> New practice plan
        </button>
      </form>
    </div>
  );
}
