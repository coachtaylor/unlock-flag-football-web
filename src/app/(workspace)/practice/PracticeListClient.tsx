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
  teamName,
  plans,
  rosterSize,
  rosterByPlan,
  stats,
}: ListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (plans.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <PageHeader teamName={teamName} teamId={teamId} />
        <StatsStrip lastN={0} attendPct={0} fieldMin={0} avgDrills={0} />
        <EmptyListState teamId={teamId} />
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 720px) 320px",
        gap: 24,
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <PageHeader teamName={teamName} teamId={teamId} />
        <StatsStrip
          lastN={stats.practices}
          attendPct={stats.attendPct}
          fieldMin={stats.fieldMin}
          avgDrills={stats.avgDrills}
        />

        {next && (
          <div>
            <SectionEyebrow color="var(--uff-orange)" label="Up next" right={<RelativeWhen iso={next.practice_date} />} />
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
            <SectionEyebrow color="var(--uff-text)" label="This week" count={thisWeek.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {thisWeek.map((p) => (
                <PlanSummaryCard key={p.id} plan={p} />
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div>
            <SectionEyebrow color="var(--uff-blue, #6EA8FF)" label="Recent" count={completed.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {completed.map((p) => (
                <PlanSummaryCard key={p.id} plan={p} completed />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Side rail — Build 5.5 footnote (block library lives in the editor sheet, not here) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 80, paddingTop: 4 }}>
        <div
          style={{
            padding: "12px 14px",
            background: "rgba(255,106,26,0.06)",
            border: "1px solid rgba(255,106,26,0.20)",
            borderRadius: 12,
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--uff-text-dim)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".16em",
              color: "var(--uff-orange)",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            New in 5.5
          </div>
          Plans now compose from <b>reusable blocks</b>. Save any block from a plan to your library and drop it into the next one.
        </div>
      </div>
    </div>
  );
}

// ── Page header ────────────────────────────────────────────────────────
function PageHeader({ teamName, teamId }: { teamName: string; teamId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingTop: 4 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".18em",
            color: "var(--uff-orange)",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {teamName}
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "var(--uff-text)",
            lineHeight: 1,
          }}
        >
          Practice
        </div>
      </div>
      <form
        action={(fd) => {
          startTransition(() => newPlanAndRedirect(fd));
        }}
      >
        <input type="hidden" name="teamId" value={teamId} />
        <button
          type="submit"
          title="New practice plan"
          disabled={isPending}
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "var(--uff-orange)",
            border: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1a0f08",
            boxShadow: "0 8px 22px rgba(255,106,26,0.30)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <PIcon.plus size={22} />
        </button>
      </form>
    </div>
  );
}

// ── Stats strip ────────────────────────────────────────────────────────
function StatsStrip({
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
        background: "var(--uff-surface)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".16em",
            color: "var(--uff-text-mute)",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          LAST {lastN} PRACTICE{lastN === 1 ? "" : "S"}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 28, flexWrap: "wrap" }}>
          <BigStat n={attendPct} unit="%" label="ATTEND" valueColor="var(--uff-lime)" />
          <BigStat n={fieldMin} unit="m" label="ON FIELD" valueColor="var(--uff-text)" />
          <BigStat n={avgDrills} unit="" label="AVG DRILLS" valueColor="var(--uff-text)" precise />
        </div>
      </div>
      <div
        style={{
          width: 6,
          height: 64,
          borderRadius: 3,
          background: "linear-gradient(180deg, var(--uff-orange) 30%, rgba(255,106,26,0.30) 100%)",
          boxShadow: "0 4px 14px rgba(255,106,26,0.30)",
        }}
      />
    </div>
  );
}

function BigStat({
  n,
  unit,
  label,
  valueColor,
  precise,
}: {
  n: number;
  unit: string;
  label: string;
  valueColor: string;
  precise?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
      <span
        className="mono"
        style={{
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 30,
          fontWeight: 800,
          color: valueColor,
          letterSpacing: "-0.03em",
        }}
      >
        {precise ? n.toFixed(1) : n}
      </span>
      <span
        className="mono"
        style={{
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--uff-text-mute)",
          letterSpacing: "-0.02em",
        }}
      >
        {unit}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
          marginLeft: 6,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Section eyebrow ────────────────────────────────────────────────────
function SectionEyebrow({
  color,
  label,
  count,
  right,
}: {
  color: string;
  label: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{ width: 3, height: 14, background: color, borderRadius: 2 }} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: ".16em",
          color: "var(--uff-text)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {count != null && (
        <span
          className="mono"
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 12,
            color: "var(--uff-text-mute)",
          }}
        >
          {count}
        </span>
      )}
      <span style={{ flex: 1, height: 1, background: "var(--uff-line-soft)" }} />
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
  const legend = plan.blocks.map((b) => ({ id: b.id, name: b.name, mn: b.minutes, c: blockColor(b.name) }));
  return (
    <div
      style={{
        background: "#15110d",
        border: "2px solid var(--uff-orange)",
        borderRadius: 20,
        padding: 20,
        position: "relative",
        boxShadow: "0 14px 44px rgba(255,106,26,0.16), 0 0 0 1px rgba(255,106,26,0.10)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
        <DateTile iso={plan.practice_date} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <PracticeStatusPill status={plan.status} mini />
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="icon-btn"
              title="Duplicate plan"
              style={{ width: 36, height: 36 }}
              onClick={onDuplicate}
              disabled={isPending}
            >
              <PIcon.copy size={15} />
            </button>
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.018em",
              color: "var(--uff-text)",
              lineHeight: 1.1,
            }}
          >
            {plan.title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 10,
              fontSize: 13,
              color: "var(--uff-text-dim)",
            }}
          >
            {plan.start_time && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <PIcon.clock size={13} /> {formatTimeLabel(plan.start_time)}
              </span>
            )}
            <span style={{ color: "var(--uff-line)" }}>·</span>
            <span className="mono" style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>
              {durLabel(plan.total_minutes)}
            </span>
            <span style={{ color: "var(--uff-line)" }}>·</span>
            <span>{plan.drill_count} drills</span>
            <span style={{ color: "var(--uff-line)" }}>·</span>
            <span>{plan.block_count} blocks</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".18em",
              color: "var(--uff-text-mute)",
              textTransform: "uppercase",
            }}
          >
            MIX
          </span>
          <span style={{ fontSize: 12, color: "var(--uff-text-dim)" }}>
            <span className="mono" style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>
              {durLabel(plan.total_minutes)}
            </span>{" "}
            planned
          </span>
        </div>
        <SummaryMixBar blocks={plan.blocks} breakMinutes={plan.break_minutes} height={8} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
          {legend.map((L) => (
            <div key={L.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: L.c.accent }} />
              <span style={{ color: "var(--uff-text-dim)" }}>{L.name}</span>
              <span
                className="mono"
                style={{
                  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                  fontWeight: 700,
                  color: "var(--uff-text)",
                }}
              >
                {L.mn}m
              </span>
            </div>
          ))}
        </div>
      </div>

      {plan.rsvp_in > 0 && avatars.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 12px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--uff-line-soft)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <AvatarStack items={avatars} size={24} max={6} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--uff-text)" }}>{plan.rsvp_in} confirmed</div>
            <div
              className="mono"
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: 10.5,
                color: "var(--uff-text-mute)",
                marginTop: 1,
                letterSpacing: ".04em",
              }}
            >
              of {rosterSize} on roster
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Link
          href={`/practice/${plan.id}`}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 14,
            border: 0,
            background: "var(--uff-orange)",
            color: "#1a0f08",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.005em",
            cursor: "pointer",
            boxShadow: "0 8px 22px rgba(255,106,26,0.28)",
            textDecoration: "none",
          }}
        >
          <PIcon.whistle size={16} /> Open plan
        </Link>
        <Link
          href={`/practice/${plan.id}/edit`}
          style={{
            height: 52,
            padding: "0 22px",
            borderRadius: 14,
            background: "transparent",
            border: "1px solid var(--uff-line)",
            color: "var(--uff-text)",
            fontFamily: "inherit",
            fontSize: 14.5,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            textDecoration: "none",
          }}
        >
          Edit
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
        borderRadius: 14,
        padding: 14,
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        cursor: "pointer",
        textDecoration: "none",
      }}
    >
      <DateTile iso={plan.practice_date} size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "var(--uff-text)",
              letterSpacing: "-0.01em",
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
            gap: 8,
            flexWrap: "wrap",
            fontSize: 12.5,
            color: "var(--uff-text-dim)",
            marginBottom: 10,
          }}
        >
          {plan.start_time && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <PIcon.clock size={12} /> {formatTimeLabel(plan.start_time)}
            </span>
          )}
          <span style={{ color: "var(--uff-line)" }}>·</span>
          <span className="mono" style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}>
            {durLabel(plan.total_minutes)}
          </span>
          <span style={{ color: "var(--uff-line)" }}>·</span>
          <span>{plan.drill_count} drills</span>
          {plan.block_count > 0 && (
            <>
              <span style={{ color: "var(--uff-line)" }}>·</span>
              <span>{plan.block_count} blocks</span>
            </>
          )}
        </div>
        <SummaryMixBar blocks={plan.blocks} breakMinutes={plan.break_minutes} height={6} />

        {completed && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--uff-line-soft)",
              fontSize: 12,
              color: "var(--uff-text-dim)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <PIcon.people size={13} /> {plan.rsvp_in} attended
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ color: "var(--uff-text-mute)" }}>
              <PIcon.chevR size={12} />
            </span>
          </div>
        )}
      </div>
    </Link>
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
