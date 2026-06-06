// /drills/[id] — Drill detail (UFF Web design).
// Two-column desktop layout: diagram + cues + setup + recent logs on the left;
// metadata, benchmark snapshot, and activity on the right.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { resolveActorNames } from "@/lib/activity";
import EntityHistory from "@/components/activity/EntityHistory";
import { getAccessibleTeams, canManageTeam } from "@/lib/access/teams";
import { teamColorHex } from "@/components/uff/team-colors";
import DiagramRenderer from "@/components/DiagramRenderer";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import {
  BENCH_BY_ID,
  BenchChip,
  CatPillWeb,
  // Skill-group color map duplicated from PresetCard for the read-only chips
  // below — extract a shared SkillChip component when there's a third consumer.
  DrillBadge,
  Spark,
  StatusPill,
  TrendChip,
  WEB_CAT_DEFS,
  categoryToSlug,
  pickPhaseCat,
  type BenchKind,
  type CatSlug,
  type DrillStatus,
} from "@/components/uff-web/drills/atoms";
import type { DiagramData } from "@/types/diagram";
import { archiveDrill, unarchiveDrill, removeDrill, duplicateDrill } from "./actions";
import PinButton from "@/components/dashboard/widgets/PinButton";

export const dynamic = "force-dynamic";

const ALLOWED_BENCH: BenchKind[] = [
  "timed",
  "rated",
  "reps",
  "pct",
  "flags",
  "drops",
];

type Props = {
  params: Promise<{ teamId: string; id: string }>;
  searchParams: Promise<{ from?: string }>;
};

type RecentLog = {
  playerId: string | null;
  playerName: string;
  initials: string;
  assessmentDate: string;
  benchmarkType: BenchKind | null;
  display: string;
  raw: number | null;
};

type SnapshotRow = {
  type: BenchKind;
  current: string;
  pb: string;
  trend: number | null;
  sparkData: number[];
};

export default async function DrillDetailPage({ params, searchParams }: Props) {
  const { teamId, id } = await params;
  const { from } = await searchParams;
  const cameFromPresetLibrary = from === "library";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  // Source of truth for "can this user see this drill" is the drill's own
  // team_id checked against the user's accessible team set (direct member +
  // league admin), NOT the first row of team_members.
  const accessibleTeams = await getAccessibleTeams(supabase, user.id);
  if (accessibleTeams.length === 0) redirect("/onboarding/scope");
  const accessibleTeamIds = accessibleTeams.map((t) => t.id);

  const { data: drill } = await supabase
    .from("team_drills")
    .select(
      "id, team_id, drill_name, description, source_url, benchmark_type, benchmark_types, benchmark_config, default_duration_min, default_reps, status, preset_drill_id, setup_diagram, setup_instructions, equipment, notes, category_id, additional_category_ids, is_dashboard_pinned, created_at, updated_at, created_by, updated_by"
    )
    .eq("id", id)
    .maybeSingle();

  if (!drill || !accessibleTeamIds.includes(drill.team_id as string)) {
    notFound();
  }
  // The URL's team must match the drill's owning team.
  if ((drill.team_id as string) !== teamId) notFound();
  const base = `/dashboard/team/${teamId}/drills`;
  const canManage = canManageTeam(
    accessibleTeams.find((t) => t.id === teamId),
  );

  const [
    { data: team },
    { data: junction },
    { count: memberCount },
    { data: pinsForDrill },
    { count: totalTeamPins },
    { data: rosterRows },
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, team_name, team_color, league_id")
      .eq("id", teamId)
      .maybeSingle(),
    supabase
      .from("team_drill_categories")
      .select("category_id")
      .eq("drill_id", id),
    supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId),
    // Pins on THIS drill (any type / position / breakdown).
    supabase
      .from("team_dashboard_pins")
      .select("id, benchmark_type, position, breakdown_positions")
      .eq("drill_id", id)
      .eq("team_id", teamId),
    // Team-wide pin count for the popover's slot counter.
    supabase
      .from("team_dashboard_pins")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId),
    // Active positions actually on the roster — drives the position dropdown.
    supabase
      .from("team_players")
      .select("positions")
      .eq("team_id", teamId)
      .eq("status", "active"),
  ]);

  // Tagged skills for this drill (build-10). Renders as chips in the
  // left column. Empty → friendly empty state nudging the user toward
  // the editor.
  const { loadDrillSkills } = await import("@/lib/drills/skills-data");
  const drillSkillsMap = await loadDrillSkills(supabase, [id]);
  const taggedSkills = drillSkillsMap[id] ?? [];

  if (!team) redirect("/dashboard");

  // Categories
  const junctionIds = (junction ?? [])
    .map((j) => j.category_id as string | null)
    .filter((x): x is string => !!x);
  let allCategoryIds = junctionIds;
  if (allCategoryIds.length === 0) {
    const set = new Set<string>();
    if (drill.category_id) set.add(drill.category_id as string);
    for (const x of (drill.additional_category_ids as string[] | null) ?? []) {
      set.add(x);
    }
    allCategoryIds = Array.from(set);
  }
  const { data: categoryRows } = allCategoryIds.length
    ? await supabase
        .from("drill_categories")
        .select("id, category_name, category_type")
        .in("id", allCategoryIds)
    : { data: [] as { id: string; category_name: string; category_type: string }[] };
  const cats: CatSlug[] = (categoryRows ?? []).map((c) =>
    categoryToSlug(c.category_name as string),
  );
  const primarySlug: CatSlug = pickPhaseCat(cats);
  const catColor = WEB_CAT_DEFS[primarySlug]?.color ?? "var(--uff-orange)";

  // Attribution: creator + last editor (Build 14.5). Shared resolver keeps the
  // display-name rule identical across the app; editor falls back to creator
  // when the drill has never been edited.
  const createdById = drill.created_by as string | null;
  const updatedById = drill.updated_by as string | null;
  const actorNames = await resolveActorNames(supabase, [createdById, updatedById]);
  const creatorName = createdById ? actorNames.get(createdById) ?? "Coach" : "—";
  const editorName = updatedById ? actorNames.get(updatedById) ?? "Coach" : creatorName;

  // Recent benchmark results — last 5 for the recent-logs feed; plus a
  // wider 24-row window for the snapshot stats.
  const [{ data: recentRows }, { data: snapshotRows }] = await Promise.all([
    supabase
      .from("benchmark_results")
      .select(
        "id, assessment_date, benchmark_type, time_seconds, rating, made_count, attempts_count, created_at, team_players(id, player_name, color_index)"
      )
      .eq("drill_id", id)
      .order("assessment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("benchmark_results")
      .select(
        "assessment_date, benchmark_type, time_seconds, rating, made_count, attempts_count"
      )
      .eq("drill_id", id)
      .order("assessment_date", { ascending: true })
      .limit(60),
  ]);

  const recentLogs: RecentLog[] = (recentRows ?? []).map((r) => {
    const players = r.team_players as
      | { id: string; player_name: string; color_index: number | null }
      | { id: string; player_name: string; color_index: number | null }[]
      | null;
    const p = Array.isArray(players) ? players[0] ?? null : players;
    const bench = normalizeBench(r.benchmark_type as string | null);
    const { display, raw } = formatBenchValue(bench, r);
    return {
      playerId: p?.id ?? null,
      playerName: p?.player_name ?? "Unknown player",
      initials: initialsFrom(p?.player_name ?? "—"),
      assessmentDate: r.assessment_date as string,
      benchmarkType: bench,
      display,
      raw,
    };
  });

  // Per-type stats for snapshot card
  const types: BenchKind[] = ((drill.benchmark_types as string[] | null) ?? [])
    .filter((t): t is BenchKind => (ALLOWED_BENCH as string[]).includes(t));
  if (types.length === 0) {
    const legacy = drill.benchmark_type as string | null;
    if (legacy && (ALLOWED_BENCH as string[]).includes(legacy)) {
      types.push(legacy as BenchKind);
    }
  }
  const snapshot: SnapshotRow[] = types.map((t) =>
    buildSnapshot(t, snapshotRows ?? []),
  );

  // Diagram + equipment derivations
  const rawDiagram = drill.setup_diagram as DiagramData | null;
  const diagram =
    rawDiagram && Array.isArray(rawDiagram.cones) && rawDiagram.cones.length > 0
      ? rawDiagram
      : null;
  const equipment = drill.equipment as { cones?: number; other?: unknown } | null;
  const equipmentCones = typeof equipment?.cones === "number" ? equipment.cones : 0;
  const equipmentOther = Array.isArray(equipment?.other)
    ? (equipment!.other as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const equipmentSummary = (() => {
    const parts: string[] = [];
    if (equipmentCones > 0) parts.push(`${equipmentCones} cone${equipmentCones === 1 ? "" : "s"}`);
    for (const item of equipmentOther) parts.push(item);
    return parts.length > 0 ? parts.join(" · ") : "No equipment";
  })();

  const notes = Array.isArray(drill.notes)
    ? (drill.notes as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];

  const totalRuns = (snapshotRows ?? []).length;
  const lastRunDate = (snapshotRows ?? [])
    .map((r) => r.assessment_date as string | null)
    .filter((x): x is string => !!x)
    .sort()
    .pop() ?? null;

  const status = ((drill.status as string | null) ?? "draft") as DrillStatus;
  const drillName = (drill.drill_name as string) ?? "Untitled drill";
  const description = (drill.description as string | null) ?? "";
  const sourceUrl = (drill.source_url as string | null) ?? "";
  const sourceHost = sourceUrl ? safeHost(sourceUrl) : "";
  // Pin state (Branch 2): backed by team_dashboard_pins. A drill is
  // "pinned" if any slice exists for it. Multi-type drills get richer
  // metadata for the PinButton popover.
  const currentPins = (
    (pinsForDrill ?? []) as {
      id: string;
      benchmark_type: string;
      position: string | null;
      breakdown_positions: string[] | null;
    }[]
  ).map((p) => ({
    id: p.id,
    benchmarkType: p.benchmark_type,
    position: p.position,
    breakdownPositions: p.breakdown_positions,
  }));
  const pinned = currentPins.length > 0;

  // Active positions on the team, intersected with the canonical list +
  // sorted to match POSITION_IDS order so the dropdown reads consistently.
  const rosterPositionsSet = new Set<string>();
  for (const r of (rosterRows ?? []) as { positions: string[] | null }[]) {
    for (const p of r.positions ?? []) rosterPositionsSet.add(p);
  }
  const { POSITION_IDS } = await import("@/lib/positions");
  const positionOptions = POSITION_IDS.filter((p) => rosterPositionsSet.has(p));

  const firstName = (profile?.first_name as string | null) ?? "";
  const lastName = (profile?.last_name as string | null) ?? "";
  const initials =
    `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  const canBenchmark = types.length > 0 && status === "published";

  const sidebarWorkspaces = await loadSidebarWorkspaces(
    team.id as string,
    (team.league_id as string | null) ?? null,
  );

  return (
    <div className="uff-web">
      <TeamSidebar
        active="drills"
        teamId={team.id as string}
        teamColor={teamColorHex(team.team_color as string | null)}
        teamName={team.team_name as string}
        leagueId={(team.league_id as string | null) ?? null}
        user={{ firstName, lastName }}
        workspaces={sidebarWorkspaces}
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          eyebrow={`DRILL · ${WEB_CAT_DEFS[primarySlug]?.label.toUpperCase() ?? "OTHER"}`}
          title={drillName}
          userInitials={initials}
          showSearch={false}
          actions={
            canManage ? (
              <>
                {canBenchmark && (
                  <Link
                    href={`/benchmarks?drill=${drill.id}`}
                    className="wbtn"
                  >
                    Run benchmark
                  </Link>
                )}
                <PinButton
                  drillId={drill.id as string}
                  teamId={team.id as string}
                  benchmarkTypes={types}
                  currentPins={currentPins}
                  positionOptions={positionOptions}
                  totalTeamPins={totalTeamPins ?? 0}
                />
                <Link href={`${base}/${drill.id}/edit`} className="wbtn">
                  Edit drill
                </Link>
              </>
            ) : undefined
          }
        />

        <div
          className="page"
          style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}
        >
          {/* Back to preset library — shown only when the user arrived by
              cloning a preset (?from=library), so they can keep adding drills. */}
          {cameFromPresetLibrary && (
            <Link
              href={`${base}/library`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--uff-orange)",
                textDecoration: "none",
                padding: "0 0 10px",
              }}
            >
              <span aria-hidden>←</span> Back to preset library
            </Link>
          )}

          {/* Crumbs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              color: "var(--uff-text)",
              padding: "0 0 4px",
            }}
          >
            <Link
              href={base}
              style={{ color: "var(--uff-text)", textDecoration: "none" }}
            >
              Drills
            </Link>
            <span style={{ color: "var(--uff-line)" }}>/</span>
            <span style={{ color: "var(--uff-text)" }}>
              {WEB_CAT_DEFS[primarySlug]?.label ?? "Other"}
            </span>
            <span style={{ color: "var(--uff-line)" }}>/</span>
            <span style={{ color: "var(--uff-text)" }}>{drillName}</span>
          </div>

          {/* Hero */}
          <Hero
            drillName={drillName}
            description={description}
            cats={cats}
            primarySlug={primarySlug}
            catColor={catColor}
            status={status}
            pinned={pinned}
            types={types}
            totalRuns={totalRuns}
            durationMin={(drill.default_duration_min as number | null) ?? 0}
            notesCount={notes.length}
            lastRunDate={lastRunDate}
          />

          {/* Body — two columns at desktop */}
          <div className="drilldetail-grid">
            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <DetailSection
                label="Skill tags"
                meta={
                  taggedSkills.length === 0
                    ? "No skills tagged"
                    : `${taggedSkills.filter((s) => s.weight === 1.0).length} primary · ${taggedSkills.filter((s) => s.weight === 0.5).length} secondary`
                }
              >
                {taggedSkills.length === 0 ? (
                  <EmptyHint>
                    No skills tagged. Open this drill in the editor to tag
                    the player skills it develops — they power the team
                    skill profile and player dashboard.
                  </EmptyHint>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {taggedSkills.map((s) => {
                      const color =
                        s.skill_group === "athletic"
                          ? "var(--uff-lime)"
                          : s.skill_group === "offense"
                            ? "var(--uff-orange)"
                            : s.skill_group === "qb"
                              ? "#6EA8FF"
                              : s.skill_group === "defense"
                                ? "#B89BFF"
                                : "#FFB347";
                      const isPrimary = s.weight === 1.0;
                      return (
                        <span
                          key={s.id}
                          title={`${s.skill_name} — ${isPrimary ? "primary (1.0)" : "secondary (0.5)"}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "3px 9px",
                            borderRadius: 5,
                            fontSize: 11.5,
                            fontWeight: isPrimary ? 600 : 500,
                            background: isPrimary
                              ? `color-mix(in srgb, ${color} 18%, transparent)`
                              : "rgba(255,255,255,0.02)",
                            border: isPrimary
                              ? `1px solid color-mix(in srgb, ${color} 45%, transparent)`
                              : "1px solid var(--uff-line-soft)",
                            color: isPrimary
                              ? "var(--uff-text)"
                              : "var(--uff-text-mute)",
                            lineHeight: 1.4,
                          }}
                        >
                          {isPrimary && (
                            <span style={{ color, fontSize: 10, lineHeight: 1 }}>
                              ★
                            </span>
                          )}
                          {s.skill_name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </DetailSection>

              <DetailSection
                label="Setup diagram"
                meta={
                  diagram
                    ? `${equipmentCones} cone${equipmentCones === 1 ? "" : "s"}`
                    : "No diagram yet"
                }
              >
                {diagram ? (
                  <div
                    style={{
                      borderRadius: 12,
                      overflow: "hidden",
                      border: "1px solid var(--uff-line-soft)",
                      marginInline: "auto",
                    }}
                  >
                    <DiagramRenderer data={diagram} />
                  </div>
                ) : (
                  <EmptyHint>
                    No setup diagram yet. Open the drill in the editor and drag
                    cones onto the field to add one.
                  </EmptyHint>
                )}
                {drill.setup_instructions && (
                  <div
                    style={{
                      padding: "12px 14px",
                      background: "var(--uff-surface-2)",
                      border: "1px solid var(--uff-line-soft)",
                      borderRadius: 10,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "var(--uff-text)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {drill.setup_instructions as string}
                  </div>
                )}
              </DetailSection>

              <DetailSection
                label="Coaching cues"
                meta={notes.length > 0 ? `${notes.length} cue${notes.length === 1 ? "" : "s"}` : "No cues yet"}
              >
                {notes.length === 0 ? (
                  <EmptyHint>
                    Add cues from the drill editor — keep them short, one
                    coaching idea per line.
                  </EmptyHint>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {notes.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: 14,
                          background: "var(--uff-surface-2)",
                          border: "1px solid var(--uff-line-soft)",
                          borderRadius: 12,
                        }}
                      >
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 7,
                            background: catColor,
                            color: "#0a0a0d",
                            display: "grid",
                            placeItems: "center",
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          {i + 1}
                        </span>
                        <span
                          style={{
                            fontSize: 13.5,
                            color: "var(--uff-text)",
                            lineHeight: 1.55,
                          }}
                        >
                          {c}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>

              <DetailSection label="Setup" meta={equipmentSummary}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 12,
                  }}
                >
                  <SetupCell k="Equipment" v={equipmentSummary} />
                  <SetupCell
                    k="Default block"
                    v={
                      (drill.default_duration_min as number | null)
                        ? `${drill.default_duration_min} min`
                        : "—"
                    }
                  />
                  <SetupCell
                    k="Default reps"
                    v={
                      (drill.default_reps as number | null)
                        ? `${drill.default_reps} rep${drill.default_reps === 1 ? "" : "s"}`
                        : "—"
                    }
                  />
                  <SetupCell
                    k="Source"
                    v={
                      sourceUrl ? (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "var(--uff-orange)",
                            textDecoration: "underline dotted",
                            textUnderlineOffset: 2,
                          }}
                        >
                          {sourceHost}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                </div>
              </DetailSection>

              <DetailSection
                label="Recent benchmark logs"
                meta={`${recentLogs.length} entr${recentLogs.length === 1 ? "y" : "ies"}`}
                cta={
                  recentLogs.length > 0 ? (
                    <Link
                      href={`/benchmarks?drill=${drill.id}`}
                      className="wbtn ghost"
                      style={{ height: 28, fontSize: 11.5, padding: "0 10px" }}
                    >
                      See all
                    </Link>
                  ) : undefined
                }
              >
                {recentLogs.length === 0 ? (
                  <EmptyHint>
                    No assessments yet. Run a benchmark to start tracking
                    player results.
                  </EmptyHint>
                ) : (
                  <div className="w-card" style={{ padding: 0 }}>
                    {recentLogs.map((l, i) => {
                      const t = l.benchmarkType
                        ? BENCH_BY_ID[l.benchmarkType]
                        : null;
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            padding: "12px 16px",
                            borderBottom:
                              i === recentLogs.length - 1
                                ? "none"
                                : "1px solid var(--uff-line-soft)",
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 9,
                              background: "var(--uff-surface-2)",
                              border: "1px solid var(--uff-line)",
                              color: "var(--uff-text)",
                              display: "grid",
                              placeItems: "center",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11.5,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {l.initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--uff-text)",
                              }}
                            >
                              {l.playerName}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--uff-text)",
                                marginTop: 2,
                              }}
                            >
                              {formatShortDate(l.assessmentDate)}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {l.benchmarkType && (
                              <BenchChip id={l.benchmarkType} mini />
                            )}
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 14,
                                fontWeight: 700,
                                color: t?.accent ?? "var(--uff-text)",
                                minWidth: 60,
                                textAlign: "right",
                              }}
                            >
                              {l.display}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </DetailSection>
            </div>

            {/* Right column */}
            <div className="drilldetail-rail">
              <MetaCard
                creatorName={creatorName}
                editorName={editorName}
                createdAt={drill.created_at as string}
                updatedAt={drill.updated_at as string}
                sourceHost={sourceHost}
                sourceUrl={sourceUrl}
                memberCount={memberCount ?? 0}
                totalRuns={totalRuns}
                drillId={drill.id as string}
                canManage={canManage}
                isPreset={(drill.preset_drill_id as string | null) != null}
                status={status}
              />
              <BenchmarkSnapshotCard
                types={types}
                snapshot={snapshot}
                drillId={drill.id as string}
                base={base}
                canManage={canManage}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .drilldetail-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        .drilldetail-rail {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        @media (min-width: 1180px) {
          .drilldetail-grid {
            grid-template-columns: minmax(0, 1.6fr) 360px;
          }
          .drilldetail-rail {
            position: sticky;
            top: 84px;
          }
        }
      `}</style>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────

function Hero({
  drillName,
  description,
  cats,
  primarySlug,
  catColor,
  status,
  pinned,
  types,
  totalRuns,
  durationMin,
  notesCount,
  lastRunDate,
}: {
  drillName: string;
  description: string;
  cats: CatSlug[];
  primarySlug: CatSlug;
  catColor: string;
  status: DrillStatus;
  pinned: boolean;
  types: BenchKind[];
  totalRuns: number;
  durationMin: number;
  notesCount: number;
  lastRunDate: string | null;
}) {
  return (
    <div
      className="w-card"
      style={{
        padding: 0,
        overflow: "hidden",
        background: `linear-gradient(180deg, ${catColor}14 0%, transparent 50%), var(--uff-surface)`,
        borderTop: `2px solid ${catColor}`,
      }}
    >
      <div
        style={{
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          gap: 22,
          flexWrap: "wrap",
        }}
      >
        <DrillBadge cat={primarySlug} name={drillName} size={84} />

        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            {/* Phase pills only — the skill-category axis was retired in
                favor of the skill taxonomy (rendered in the "Skill tags"
                section below). */}
            {cats
              .filter((c) => WEB_CAT_DEFS[c]?.group === "phase")
              .map((c) => (
                <CatPillWeb key={c} slug={c} />
              ))}
            <StatusPill status={status} />
            {pinned && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 9px",
                  borderRadius: 4,
                  background: "rgba(255,106,26,0.10)",
                  color: "var(--uff-orange)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".12em",
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M14 4l6 6-4 1-3 6-2-2-5 5-1-1 5-5-2-2 6-3z" />
                </svg>
                PINNED
              </span>
            )}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              color: "var(--uff-text)",
            }}
          >
            {drillName}
          </h1>
          {description && (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 14,
                color: "var(--uff-text)",
                lineHeight: 1.55,
                maxWidth: 640,
                whiteSpace: "pre-wrap",
              }}
            >
              {description}
            </p>
          )}
          {types.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 14,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: ".16em",
                  color: "var(--uff-text)",
                }}
              >
                BENCHMARKS
              </span>
              {types.map((t) => (
                <BenchChip key={t} id={t} />
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 22, alignItems: "stretch" }}>
          <HeroStat label="Runs" v={String(totalRuns)} />
          <HeroSep />
          <HeroStat label="Duration" v={durationMin > 0 ? `${durationMin}m` : "—"} />
          <HeroSep />
          <HeroStat label="Cues" v={String(notesCount)} />
          <HeroSep />
          <HeroStat
            label="Last run"
            v={lastRunDate ? formatShortDate(lastRunDate) : "—"}
            small
          />
        </div>
      </div>
    </div>
  );
}

function HeroStat({
  label,
  v,
  small,
}: {
  label: string;
  v: string;
  small?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: ".16em",
          color: "var(--uff-text)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: small ? 14 : 22,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: "var(--uff-text)",
        }}
      >
        {v}
      </span>
    </div>
  );
}

function HeroSep() {
  return (
    <div
      style={{
        width: 1,
        alignSelf: "stretch",
        background: "rgba(255,255,255,0.06)",
      }}
    />
  );
}

// ── Right-rail metadata card ──────────────────────────────────────────

function MetaCard({
  creatorName,
  editorName,
  createdAt,
  updatedAt,
  sourceHost,
  sourceUrl,
  memberCount,
  totalRuns,
  drillId,
  canManage,
  isPreset,
  status,
}: {
  creatorName: string;
  editorName: string;
  createdAt: string;
  updatedAt: string;
  sourceHost: string;
  sourceUrl: string;
  memberCount: number;
  totalRuns: number;
  drillId: string;
  canManage: boolean;
  isPreset: boolean;
  status: DrillStatus;
}) {
  return (
    <div
      className="w-card"
      style={{
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".18em",
          color: "var(--uff-text)",
        }}
      >
        METADATA
      </div>

      <KV k="Created by" v={creatorName} />
      <KV k="Created" v={formatShortDate(createdAt)} />
      <KV k="Updated by" v={editorName} />
      <KV k="Updated" v={formatShortDate(updatedAt)} mono />
      <KV k="" v={<EntityHistory entityType="drill" entityId={drillId} label="View full history" />} />
      <KV
        k="Source"
        v={
          sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--uff-orange)",
                textDecoration: "underline dotted",
                textUnderlineOffset: 2,
              }}
            >
              {sourceHost}
            </a>
          ) : (
            "—"
          )
        }
      />
      <KV
        k="Visibility"
        v={`Team · ${memberCount} member${memberCount === 1 ? "" : "s"}`}
      />
      <KV k="Times run" v={String(totalRuns)} mono />

      {canManage && (
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <form action={duplicateDrill} style={{ flex: 1 }}>
          <input type="hidden" name="drillId" value={drillId} />
          <button
            type="submit"
            className="wbtn"
            style={{ width: "100%", height: 34, fontSize: 12.5 }}
          >
            Duplicate
          </button>
        </form>
        {/* Lifecycle action mirrors the drill cards: preset clones are
            removed from the library; custom drills archive, then (once
            archived) unarchive. Permanent delete of a custom drill happens
            from the library archive behind a type-the-name confirm. */}
        {isPreset ? (
          <form action={removeDrill} style={{ flex: 1 }}>
            <input type="hidden" name="drillId" value={drillId} />
            <button
              type="submit"
              className="wbtn"
              style={{ width: "100%", height: 34, fontSize: 12.5, color: "#FF4D4D" }}
            >
              Remove
            </button>
          </form>
        ) : status === "archived" ? (
          <form action={unarchiveDrill} style={{ flex: 1 }}>
            <input type="hidden" name="drillId" value={drillId} />
            <button
              type="submit"
              className="wbtn"
              style={{ width: "100%", height: 34, fontSize: 12.5 }}
            >
              Unarchive
            </button>
          </form>
        ) : (
          <form action={archiveDrill} style={{ flex: 1 }}>
            <input type="hidden" name="drillId" value={drillId} />
            <button
              type="submit"
              className="wbtn"
              style={{ width: "100%", height: 34, fontSize: 12.5, color: "#FF4D4D" }}
            >
              Archive
            </button>
          </form>
        )}
      </div>
      )}
    </div>
  );
}

function KV({
  k,
  v,
  mono,
}: {
  k: string;
  v: ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".06em",
          color: "var(--uff-text)",
          textTransform: "uppercase",
        }}
      >
        {k}
      </span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          fontFamily: mono ? "var(--font-mono)" : "inherit",
          color: "var(--uff-text)",
          textAlign: "right",
        }}
      >
        {v}
      </span>
    </div>
  );
}

// ── Right-rail benchmark snapshot ────────────────────────────────────

function BenchmarkSnapshotCard({
  types,
  snapshot,
  drillId,
  base,
  canManage,
}: {
  types: BenchKind[];
  snapshot: SnapshotRow[];
  drillId: string;
  base: string;
  canManage: boolean;
}) {
  if (types.length === 0) {
    return (
      <div
        className="w-card"
        style={{
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          borderTop: "2px dashed var(--uff-line)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".18em",
            color: "var(--uff-text)",
          }}
        >
          BENCHMARKS
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--uff-text)",
            lineHeight: 1.5,
          }}
        >
          No benchmark types are set on this drill. Add one to start capturing
          player results during practice.
        </div>
        {canManage && (
          <Link
            href={`${base}/${drillId}/edit`}
            className="wbtn primary"
            style={{ alignSelf: "flex-start", height: 32, fontSize: 12.5 }}
          >
            Add benchmarks
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="w-card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--uff-line-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".18em",
            color: "var(--uff-text)",
          }}
        >
          BENCHMARK SNAPSHOT
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--uff-text)",
          }}
        >
          LAST {snapshot[0]?.sparkData.length ?? 0} RUNS
        </span>
      </div>
      {snapshot.map((row, i) => {
        const t = BENCH_BY_ID[row.type];
        return (
          <div
            key={row.type}
            style={{
              padding: "14px 18px",
              borderBottom:
                i === snapshot.length - 1
                  ? "none"
                  : "1px solid var(--uff-line-soft)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <BenchChip id={row.type} mini />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 16,
                fontWeight: 700,
                color: t.accent,
                minWidth: 56,
              }}
            >
              {row.current}
              <span
                style={{
                  fontSize: 10.5,
                  color: "var(--uff-text)",
                  marginLeft: 2,
                }}
              >
                {row.current === "—" ? "" : t.unit}
              </span>
            </span>
            <div style={{ flex: 1 }}>
              <Spark
                data={row.sparkData}
                color={t.accent}
                w={80}
                h={20}
              />
            </div>
            <div style={{ textAlign: "right" }}>
              <TrendChip delta={row.trend} better={t.better} mini />
              <div
                style={{
                  fontSize: 9.5,
                  color: "var(--uff-text)",
                  letterSpacing: ".06em",
                  marginTop: 2,
                  fontFamily: "var(--font-mono)",
                }}
              >
                PB {row.pb}
                {row.pb === "—" ? "" : t.unit}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Reusable bits ────────────────────────────────────────────────────

function DetailSection({
  label,
  meta,
  cta,
  children,
}: {
  label: string;
  meta?: string;
  cta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="w-card"
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 3,
            height: 14,
            background: "var(--uff-orange)",
            borderRadius: 2,
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--uff-text)",
          }}
        >
          {label}
        </span>
        {meta && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--uff-text)",
              letterSpacing: ".06em",
            }}
          >
            · {meta}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {cta}
      </div>
      {children}
    </div>
  );
}

function SetupCell({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line-soft)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: ".16em",
          color: "var(--uff-text)",
          textTransform: "uppercase",
        }}
      >
        {k}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--uff-text)",
          lineHeight: 1.4,
        }}
      >
        {v}
      </span>
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        background: "var(--uff-surface-2)",
        border: "1px dashed var(--uff-line)",
        borderRadius: 10,
        fontSize: 12.5,
        color: "var(--uff-text)",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────

function normalizeBench(t: string | null): BenchKind | null {
  if (!t) return null;
  return (ALLOWED_BENCH as string[]).includes(t) ? (t as BenchKind) : null;
}

function formatBenchValue(
  bench: BenchKind | null,
  row: {
    time_seconds: number | null;
    rating: number | null;
    made_count: number | null;
    attempts_count: number | null;
  },
): { display: string; raw: number | null } {
  if (!bench) return { display: "—", raw: null };
  switch (bench) {
    case "timed":
      return row.time_seconds != null
        ? { display: `${Number(row.time_seconds).toFixed(2)}s`, raw: Number(row.time_seconds) }
        : { display: "—", raw: null };
    case "rated":
      return row.rating != null
        ? { display: `${row.rating}/5`, raw: row.rating }
        : { display: "—", raw: null };
    case "reps":
      return row.made_count != null
        ? { display: `${row.made_count}`, raw: row.made_count }
        : { display: "—", raw: null };
    case "pct": {
      if (row.attempts_count != null && row.attempts_count > 0 && row.made_count != null) {
        const pct = Math.round((row.made_count / row.attempts_count) * 100);
        return { display: `${pct}%`, raw: pct };
      }
      return { display: "—", raw: null };
    }
    case "flags":
      return row.made_count != null
        ? { display: `${row.made_count}`, raw: row.made_count }
        : { display: "—", raw: null };
    case "drops":
      return row.made_count != null
        ? { display: `${row.made_count}`, raw: row.made_count }
        : { display: "—", raw: null };
  }
}

function buildSnapshot(
  type: BenchKind,
  rows: Array<{
    benchmark_type: string | null;
    time_seconds: number | null;
    rating: number | null;
    made_count: number | null;
    attempts_count: number | null;
  }>,
): SnapshotRow {
  const meta = BENCH_BY_ID[type];
  const series = rows
    .filter((r) => normalizeBench(r.benchmark_type) === type)
    .map((r) => formatBenchValue(type, r).raw)
    .filter((v): v is number => v != null);
  if (series.length === 0) {
    return {
      type,
      current: "—",
      pb: "—",
      trend: null,
      sparkData: [],
    };
  }
  const last = series[series.length - 1];
  const prev = series.length >= 2 ? series[series.length - 2] : null;
  const trend = prev == null ? null : Number((last - prev).toFixed(2));
  const pb =
    meta.better === "lower" ? Math.min(...series) : Math.max(...series);
  const fmt = (v: number) =>
    type === "timed"
      ? v.toFixed(2)
      : type === "rated"
        ? v.toFixed(1)
        : String(Math.round(v));
  return {
    type,
    current: fmt(last),
    pb: fmt(pb),
    trend,
    sparkData: series.slice(-12),
  };
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === "—") return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
