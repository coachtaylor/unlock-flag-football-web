"use client";

// Practice list (Build 5.5) — mirrors the mobile Practice tab pattern:
// stats strip → "Up next" featured card → "This week" + "Recent" sections.
// All cards share the same colored block-mix bar so the shape of a plan
// reads at a glance.

import Link from "next/link";
import { useState, useTransition } from "react";
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
import {
  duplicatePlanAndRedirect,
  newPlanAndRedirect,
  deletePlan,
  archivePlan,
  unarchivePlan,
} from "@/lib/practice/actions";
import { PastDueChip, isPlanPastDue } from "@/components/practice/PastDueBanner";
import DeletePlanModal from "@/components/practice/DeletePlanModal";

// Pencil icon used by the hero card's edit affordance. PIcon doesn't ship
// an edit glyph yet, so inline a minimal one here rather than touching the
// shared atoms set.
function EditIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="M14 6l4 4" />
    </svg>
  );
}

type ManageAction = "archive" | "unarchive" | "delete";

// Small square icon button used inside the manage control.
function ManageGlyphButton({
  action,
  danger,
  onClick,
}: {
  action: ManageAction;
  danger?: boolean;
  onClick: () => void;
}) {
  const title =
    action === "delete"
      ? "Delete"
      : action === "archive"
      ? "Archive"
      : "Unarchive";
  return (
    <button
      type="button"
      data-stop-card-nav
      className="icon-btn"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      style={{
        width: 26,
        height: 26,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: danger ? "var(--uff-red, #ff4d4d)" : "var(--uff-text-mute)",
      }}
    >
      <svg
        width={13}
        height={13}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {action === "delete" ? (
          <>
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M6 6l1 14h10l1-14" />
          </>
        ) : action === "archive" ? (
          <>
            <path d="M3 4h18v4H3z" />
            <path d="M5 8v12h14V8" />
            <path d="M10 12h4" />
          </>
        ) : (
          <>
            <path d="M3 4h18v4H3z" />
            <path d="M5 8v12h14V8" />
            <path d="M12 18v-6" />
            <path d="M9 15l3-3 3 3" />
          </>
        )}
      </svg>
    </button>
  );
}

// Status-aware manage control for list cards. Lifecycle policy: every active
// practice can only be Archived (data is always kept). An archived practice
// can be Unarchived or permanently Deleted (delete goes through a type-the-
// name confirm in the parent). data-stop-card-nav so clicks don't also fire
// the card's navigation.
function ManageIconButton({
  plan,
  onManage,
}: {
  plan: PlanSummary;
  onManage: (action: ManageAction) => void;
}) {
  if (plan.archived) {
    return (
      <>
        <ManageGlyphButton action="unarchive" onClick={() => onManage("unarchive")} />
        <ManageGlyphButton action="delete" danger onClick={() => onManage("delete")} />
      </>
    );
  }
  return <ManageGlyphButton action="archive" onClick={() => onManage("archive")} />;
}

type ConfirmedAvatar = { initials: string; color: string };
type RsvpBreakdown = { qb: number; off: number; def: number };

export type ListProps = {
  teamId: string;
  teamName: string;
  plans: PlanSummary[];
  rosterSize: number;
  rosterByPlan: Record<string, ConfirmedAvatar[]>;
  breakdownByPlan: Record<string, RsvpBreakdown>;
  stats: {
    practices: number;
    totalCompleted: number;
    lastPracticeAttendPct: number;
    overallAttendPct: number;
    fieldMin: number;
    avgDrills: number;
  };
};

export default function PracticeListClient({
  teamId,
  plans,
  rosterSize,
  rosterByPlan,
  breakdownByPlan,
  stats,
}: ListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Collapsed section keys (view-only state, not persisted).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleSection = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // The archived plan a coach is confirming a permanent delete on. Delete is
  // only reachable from the archive, behind a type-the-name confirm modal.
  const [deleteTarget, setDeleteTarget] = useState<PlanSummary | null>(null);

  // Manage a plan from its card. Lifecycle policy: every active practice can
  // only be archived (data is always kept). Once archived it can be
  // unarchived, or permanently deleted via the type-the-name modal.
  const managePlan = (plan: PlanSummary, action: ManageAction) => {
    if (action === "delete") {
      setDeleteTarget(plan);
      return;
    }
    if (action === "unarchive") {
      startTransition(async () => {
        await unarchivePlan(plan.id);
        router.refresh();
      });
      return;
    }
    if (
      !confirm(
        "Archive this practice? It moves to your Archived list — all data is kept, and you can unarchive it later.",
      )
    )
      return;
    startTransition(async () => {
      await archivePlan(plan.id);
      router.refresh();
    });
  };

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
  // Archived (soft-deleted) plans get their own bottom section and are
  // excluded from every active group.
  const activePlans = plans.filter((p) => !p.archived);
  const archived = plans
    .filter((p) => p.archived)
    .sort((a, b) => (a.practice_date < b.practice_date ? 1 : -1));
  const completed = activePlans
    .filter((p) => p.status === "completed")
    .sort((a, b) => (a.practice_date < b.practice_date ? 1 : -1));
  const upcoming = activePlans
    .filter((p) => p.status === "scheduled" || p.status === "live" || p.status === "draft" || p.practice_date >= todayIso)
    .filter((p) => p.status !== "completed")
    .sort((a, b) => (a.practice_date > b.practice_date ? 1 : -1));

  // Stale scheduled/live practices (>6h past start) get pulled out of the
  // upcoming groups into their own "Needs Attention" section.
  const needsAttention = upcoming
    .filter(
      (p) =>
        (p.status === "scheduled" || p.status === "live") &&
        isPlanPastDue(p.practice_date, p.start_time, p.status),
    )
    .sort((a, b) => (a.practice_date < b.practice_date ? 1 : -1));
  const naIds = new Set(needsAttention.map((p) => p.id));
  const remaining = upcoming.filter((p) => !naIds.has(p.id));
  const next = remaining[0];
  const thisWeek = remaining.slice(1);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <StatsRow
          lastN={stats.practices}
          totalCompleted={stats.totalCompleted}
          lastPracticeAttendPct={stats.lastPracticeAttendPct}
          overallAttendPct={stats.overallAttendPct}
          fieldMin={stats.fieldMin}
          avgDrills={stats.avgDrills}
        />

        {next && (
          <div>
            <SectionLabel
              label="Up next"
              right={<RelativeWhen iso={next.practice_date} />}
              collapsible
              collapsed={collapsed.has("upNext")}
              onToggle={() => toggleSection("upNext")}
            />
            {!collapsed.has("upNext") && (
              <FeaturedPlanCard
                plan={next}
                avatars={rosterByPlan[next.id] ?? []}
                breakdown={breakdownByPlan[next.id] ?? { qb: 0, off: 0, def: 0 }}
                rosterSize={rosterSize}
                isPending={isPending}
                onDuplicate={() => {
                  const fd = new FormData();
                  fd.set("planId", next.id);
                  startTransition(() => duplicatePlanAndRedirect(fd));
                }}
                onManage={(a) => managePlan(next, a)}
              />
            )}
          </div>
        )}

        {thisWeek.length > 0 && (
          <div>
            <SectionLabel
              label="This week"
              count={thisWeek.length}
              collapsible
              collapsed={collapsed.has("thisWeek")}
              onToggle={() => toggleSection("thisWeek")}
            />
            {!collapsed.has("thisWeek") && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {thisWeek.map((p) => (
                  <PlanSummaryCard
                    key={p.id}
                    plan={p}
                    avatars={rosterByPlan[p.id] ?? []}
                    breakdown={breakdownByPlan[p.id] ?? { qb: 0, off: 0, def: 0 }}
                    rosterSize={rosterSize}
                    onManage={(a) => managePlan(p, a)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {needsAttention.length > 0 && (
          <div>
            <SectionLabel
              label="Needs Attention!"
              count={needsAttention.length}
              tone="alert"
              collapsible
              collapsed={collapsed.has("needsAttention")}
              onToggle={() => toggleSection("needsAttention")}
            />
            {!collapsed.has("needsAttention") && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {needsAttention.map((p) => (
                  <PlanSummaryCard
                    key={p.id}
                    plan={p}
                    avatars={rosterByPlan[p.id] ?? []}
                    breakdown={breakdownByPlan[p.id] ?? { qb: 0, off: 0, def: 0 }}
                    rosterSize={rosterSize}
                    onManage={(a) => managePlan(p, a)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {completed.length > 0 && (
          <div>
            <SectionLabel
              label="Recent"
              count={completed.length}
              collapsible
              collapsed={collapsed.has("recent")}
              onToggle={() => toggleSection("recent")}
            />
            {!collapsed.has("recent") && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {completed.map((p) => (
                  <PlanSummaryCard
                    key={p.id}
                    plan={p}
                    completed
                    avatars={rosterByPlan[p.id] ?? []}
                    breakdown={breakdownByPlan[p.id] ?? { qb: 0, off: 0, def: 0 }}
                    rosterSize={rosterSize}
                    onManage={(a) => managePlan(p, a)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {archived.length > 0 && (
          <div>
            <SectionLabel
              label="Archived"
              count={archived.length}
              collapsible
              collapsed={collapsed.has("archived")}
              onToggle={() => toggleSection("archived")}
            />
            {!collapsed.has("archived") && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {archived.map((p) => (
                  <PlanSummaryCard
                    key={p.id}
                    plan={p}
                    completed
                    avatars={rosterByPlan[p.id] ?? []}
                    breakdown={breakdownByPlan[p.id] ?? { qb: 0, off: 0, def: 0 }}
                    rosterSize={rosterSize}
                    onManage={(a) => managePlan(p, a)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DeletePlanModal
        open={!!deleteTarget}
        title={deleteTarget?.title || "Untitled practice"}
        busy={isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget;
          if (!target) return;
          startTransition(async () => {
            await deletePlan(target.id);
            setDeleteTarget(null);
            router.refresh();
          });
        }}
      />
    </div>
  );
}

// ── Stats row ──────────────────────────────────────────────────────────
// 4-column grid of practice KPIs. Numbers are the focus; labels sit below
// in a tiny uppercase eyebrow. Vertical hairlines separate columns.
function StatsRow({
  lastN,
  totalCompleted,
  lastPracticeAttendPct,
  overallAttendPct,
  fieldMin,
  avgDrills,
}: {
  lastN: number;
  totalCompleted: number;
  lastPracticeAttendPct: number;
  overallAttendPct: number;
  fieldMin: number;
  avgDrills: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 0,
        background: "var(--uff-surface)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <StatCell
        label="Last practice"
        value={`${lastPracticeAttendPct}%`}
        sub="attendance"
        valueColor="var(--uff-lime)"
      />
      <StatCell
        label={`Overall · ${totalCompleted}`}
        value={`${overallAttendPct}%`}
        sub="attendance"
        valueColor="var(--uff-lime)"
        leftDivider
      />
      <StatCell label={`Avg · ${lastN}`} value={`${fieldMin}m`} sub="on field" leftDivider />
      <StatCell label={`Avg · ${lastN}`} value={avgDrills.toFixed(1)} sub="drills" leftDivider />
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
  valueColor,
  leftDivider,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
  leftDivider?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderLeft: leftDivider ? "1px solid var(--uff-line-soft)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        className="mono"
        style={{
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 24,
          fontWeight: 800,
          color: valueColor ?? "var(--uff-text)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 10.5, color: "var(--uff-text-mute)", letterSpacing: ".02em" }}>
        {sub}
      </span>
    </div>
  );
}

// ── Section label (tiny uppercase signpost, no decorative rule) ────────
function SectionLabel({
  label,
  count,
  right,
  tone,
  collapsible,
  collapsed,
  onToggle,
}: {
  label: string;
  count?: number;
  right?: React.ReactNode;
  tone?: "alert";
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      onClick={collapsible ? onToggle : undefined}
      role={collapsible ? "button" : undefined}
      aria-expanded={collapsible ? !collapsed : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
        cursor: collapsible ? "pointer" : undefined,
        userSelect: "none",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: tone === "alert" ? "var(--uff-red, #ff4d4d)" : "var(--uff-text-mute)",
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
      {collapsible && (
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--uff-text-mute)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform .15s",
          }}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      )}
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
  breakdown,
  rosterSize,
  isPending,
  onDuplicate,
  onManage,
}: {
  plan: PlanSummary;
  avatars: ConfirmedAvatar[];
  breakdown: RsvpBreakdown;
  rosterSize: number;
  isPending: boolean;
  onDuplicate: () => void;
  onManage: (action: ManageAction) => void;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={(e) => {
        // Ignore clicks that originated on a nested interactive element
        // (edit/duplicate icon buttons). Those handle their own navigation.
        if ((e.target as HTMLElement).closest("[data-stop-card-nav]")) return;
        router.push(`/practice/${plan.id}`);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/practice/${plan.id}`);
      }}
      style={{
        background: hovered ? "#1a140e" : "#15110d",
        border: "1px solid var(--uff-orange)",
        borderRadius: 12,
        padding: 12,
        position: "relative",
        cursor: "pointer",
        boxShadow: hovered
          ? "0 0 0 1px var(--uff-orange), 0 8px 24px rgba(255,106,26,0.18)"
          : "none",
        transition: "background .12s, box-shadow .12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <DateTile iso={plan.practice_date} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <PracticeStatusPill status={plan.status} mini />
            {isPlanPastDue(plan.practice_date, plan.start_time, plan.status) && <PastDueChip />}
            <span style={{ flex: 1 }} />
            <Link
              href={`/practice/${plan.id}/edit`}
              data-stop-card-nav
              className="icon-btn"
              title="Edit plan"
              style={{
                width: 26,
                height: 26,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <EditIcon size={12} />
            </Link>
            <button
              type="button"
              data-stop-card-nav
              className="icon-btn"
              title="Duplicate plan"
              style={{ width: 26, height: 26 }}
              onClick={onDuplicate}
              disabled={isPending}
            >
              <PIcon.copy size={12} />
            </button>
            <ManageIconButton plan={plan} onManage={onManage} />
          </div>
          {/* Title row: title fills, attendance inline on a single line —
              [avatars] 8/9 · QB 1 · OFF 5 · DEF 3. Right-padded to clear
              the edit/duplicate icon column above. Vertically centered so
              the avatar baseline lines up with the title cap-height. */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--uff-text)",
                lineHeight: 1.2,
              }}
            >
              {plan.title}
            </div>
            {(avatars.length > 0 || breakdown.qb + breakdown.off + breakdown.def > 0) && (
              <div
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 14,
                  // Clear the edit/duplicate icon column above (2× 26px
                  // buttons + 8px gap ≈ 60px) plus breathing room, so the
                  // attendance row sits visibly left of those icons.
                  paddingRight: 84,
                }}
              >
                {avatars.length > 0 && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <AvatarStack items={avatars} size={28} max={avatars.length} />
                    <span
                      className="mono"
                      style={{
                        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--uff-text)",
                      }}
                    >
                      {plan.rsvp_in}
                      <span style={{ color: "var(--uff-text-mute)", fontWeight: 500 }}>
                        /{rosterSize}
                      </span>
                    </span>
                  </div>
                )}
                {avatars.length > 0 &&
                  breakdown.qb + breakdown.off + breakdown.def > 0 && (
                    <span style={{ color: "var(--uff-line)", fontSize: 12 }}>·</span>
                  )}
                <RsvpBreakdownChips breakdown={breakdown} />
              </div>
            )}
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
          </div>
        </div>
      </div>

      {/* Bottom row: mix bar + legend only. Attendance moved up into the
          title row to balance the card and free vertical space. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        <SummaryMixBar blocks={plan.blocks} breakMinutes={plan.break_minutes} height={6} />
        <MixBarLegend blocks={plan.blocks} breakMinutes={plan.break_minutes} />
      </div>
    </div>
  );
}

// ── Plan summary card (This week + Recent rows) ────────────────────────
function PlanSummaryCard({
  plan,
  completed,
  avatars,
  breakdown,
  rosterSize,
  onManage,
}: {
  plan: PlanSummary;
  completed?: boolean;
  avatars: ConfirmedAvatar[];
  breakdown: RsvpBreakdown;
  rosterSize: number;
  onManage: (action: ManageAction) => void;
}) {
  const router = useRouter();
  const hasAttendance =
    avatars.length > 0 || breakdown.qb + breakdown.off + breakdown.def > 0;
  const pastDue = isPlanPastDue(plan.practice_date, plan.start_time, plan.status);
  const open = () => router.push(`/practice/${plan.id}`);
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-stop-card-nav]")) return;
        open();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") open();
      }}
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
      <CompactDate iso={plan.practice_date} pastDue={pastDue} />
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
          {pastDue && <PastDueChip />}
          <PracticeStatusPill status={plan.status} mini />
          <ManageIconButton plan={plan} onManage={onManage} />
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
          </div>
          {/* Mix bar — fills the space between the stats (left) and the
              attendance (right). When attendance isn't present, marginLeft
              auto still pushes it right of the stats. */}
          {plan.blocks.length > 0 && (
            <div
              style={{
                flex: 1,
                minWidth: 60,
                marginLeft: hasAttendance ? 0 : "auto",
              }}
            >
              <SummaryMixBar blocks={plan.blocks} breakMinutes={plan.break_minutes} height={5} />
            </div>
          )}
          {/* Compact attendance — small avatar stack + count + breakdown
              chips, right-aligned so the same RSVP story shows up on every
              card, not just the hero. */}
          {hasAttendance && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              {avatars.length > 0 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <AvatarStack items={avatars} size={18} max={5} />
                  <span
                    className="mono"
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--uff-text)",
                    }}
                  >
                    {plan.rsvp_in}
                    <span style={{ color: "var(--uff-text-mute)", fontWeight: 500 }}>
                      /{rosterSize}
                    </span>
                  </span>
                </div>
              )}
              {avatars.length > 0 &&
                breakdown.qb + breakdown.off + breakdown.def > 0 && (
                  <span style={{ color: "var(--uff-line)" }}>·</span>
                )}
              <RsvpBreakdownChips breakdown={breakdown} compact />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Position breakdown for confirmed RSVPs. Three tiny chips: QB (orange),
// Offense (lime), Defense (red-ish). QB is a subset of offense — kept
// separate because it's the limiting position for any offense rep, so the
// captain needs to see it at a glance. `compact` shrinks for use on the
// summary cards where the meta row is dense.
function RsvpBreakdownChips({
  breakdown,
  compact,
}: {
  breakdown: RsvpBreakdown;
  compact?: boolean;
}) {
  const items: { label: string; count: number; color: string }[] = [
    { label: "QB", count: breakdown.qb, color: "#FF6A1A" },
    { label: "OFF", count: breakdown.off, color: "#A6E36A" },
    { label: "DEF", count: breakdown.def, color: "#FF6A8B" },
  ];
  const total = items.reduce((a, i) => a + i.count, 0);
  if (total === 0) return null;
  const dot = compact ? 5 : 6;
  const labelSize = compact ? 10.5 : 12;
  const countSize = compact ? 11.5 : 13;
  const itemGap = compact ? 4 : 6;
  const rowGap = compact ? 8 : 12;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: rowGap,
        flexWrap: "wrap",
        lineHeight: 1,
      }}
    >
      {items.map((i) => (
        <span
          key={i.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: itemGap,
            fontSize: labelSize,
            color: "var(--uff-text-dim)",
            letterSpacing: ".02em",
          }}
        >
          <span
            style={{
              width: dot,
              height: dot,
              borderRadius: "50%",
              background: i.color,
              opacity: i.count > 0 ? 1 : 0.35,
            }}
          />
          <span style={{ fontWeight: 700, letterSpacing: ".12em", color: "var(--uff-text-mute)" }}>
            {i.label}
          </span>
          <span
            className="mono"
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: countSize,
              fontWeight: 700,
              color: i.count > 0 ? "var(--uff-text)" : "var(--uff-text-mute)",
            }}
          >
            {i.count}
          </span>
        </span>
      ))}
    </div>
  );
}

// Compact legend for the hero mix bar: colored dot + block name + share %.
// Water break (if any) renders as a single blue entry at the end.
function MixBarLegend({
  blocks,
  breakMinutes,
}: {
  blocks: { id: string; name: string; minutes: number }[];
  breakMinutes: number;
}) {
  const total = blocks.reduce((a, b) => a + b.minutes, 0) + breakMinutes;
  if (total === 0) return null;
  const pct = (n: number) => Math.round((n / total) * 100);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "4px 26px",
        fontSize: 11.5,
        color: "var(--uff-text-mute)",
        lineHeight: 1.3,
      }}
    >
      {blocks.map((b) => {
        if (b.minutes === 0) return null;
        const c = blockColor(b.name);
        return (
          <span key={b.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.accent }} />
            <span style={{ color: "var(--uff-text-dim)" }}>{b.name}</span>
            <span
              className="mono"
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontWeight: 700,
                color: "var(--uff-text)",
              }}
            >
              {pct(b.minutes)}%
            </span>
          </span>
        );
      })}
      {breakMinutes > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6EA8FF", opacity: 0.7 }} />
          <span style={{ color: "var(--uff-text-dim)" }}>Water</span>
          <span
            className="mono"
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontWeight: 700,
              color: "var(--uff-text)",
            }}
          >
            {pct(breakMinutes)}%
          </span>
        </span>
      )}
    </div>
  );
}

// Tighter inline date stamp for summary rows — replaces the 60×60 DateTile.
function CompactDate({ iso, pastDue }: { iso: string; pastDue?: boolean }) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  const mon = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = String(d.getDate());
  const red = "var(--uff-red, #ff4d4d)";
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
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: pastDue ? red : "var(--uff-text-mute)",
        }}
      >
        {mon}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: pastDue ? red : "var(--uff-text)",
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
