// /dashboard/team/[teamId]/drills — Drill library, team-scoped (Build 8).
//
// Reads teamId from the route (not the user's "first" team) so each team's
// library is isolated. Access mirrors the roster page: a direct full-access
// member OR a league admin of the team's league. Renders the .uff-web shell
// with the team-context sidebar.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { memberCanManage } from "@/lib/team/staff-roles";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import { Icon } from "@/components/uff/icons";
import { teamColorHex } from "@/components/uff/team-colors";
import { loadSidebarWorkspaces } from "@/lib/dashboard/sidebar-workspaces";
import {
  categoryToSlug,
  type BenchKind,
  type CatSlug,
  type DrillStatus,
} from "@/components/uff-web/drills/atoms";
import { loadDrillSkills } from "@/lib/drills/skills-data";
import { SKILL_GROUP_META } from "@/lib/drills/skill-groups";
import type { SkillGroup, TaggedSkill } from "@/lib/types/skills";
import DrillsLibraryClient, {
  type DrillRow,
} from "./DrillsLibraryClient";

export const dynamic = "force-dynamic";

const ALLOWED_BENCH: BenchKind[] = ["timed", "rated", "reps", "pct", "flags", "drops"];

export default async function DrillsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: team }, { data: membership }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("teams")
        .select("id, team_name, format, team_color, league_id, plan")
        .eq("id", teamId)
        .maybeSingle(),
      supabase
        .from("team_members")
        .select("role, captain_view_only")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .maybeSingle(),
    ]);

  if (!team) notFound();

  // Access: direct member OR league_admin of the team's league.
  let canView = !!membership;
  let isLeagueAdmin = false;
  if (!canView && team.league_id) {
    const { data: leagueMember } = await supabase
      .from("league_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("league_id", team.league_id)
      .eq("role", "league_admin")
      .maybeSingle();
    isLeagueAdmin = !!leagueMember;
    canView = isLeagueAdmin;
  }
  if (!canView) notFound();

  const canManage =
    memberCanManage(
      membership?.role as string | null,
      membership?.captain_view_only as boolean | null
    ) || isLeagueAdmin;

  const base = `/dashboard/team/${teamId}/drills`;
  // AI Drill Drafter (build-11) is a Pro feature. The "Paste a link" entry is
  // shown to everyone but disabled with a "Pro" hint off-plan.
  const isPro = (team.plan as string | null) === "pro";

  const [{ data: categories }, { data: drills }] = await Promise.all([
    supabase
      .from("drill_categories")
      .select("id, category_name, category_type, display_order")
      .or(`team_id.is.null,team_id.eq.${teamId}`)
      .order("display_order", { ascending: true })
      .order("category_name", { ascending: true }),
    supabase
      .from("team_drills")
      .select(
        "id, team_id, drill_name, description, status, preset_drill_id, benchmark_type, benchmark_types, default_duration_min, default_reps, is_dashboard_pinned, updated_at"
      )
      .eq("team_id", teamId)
      // Archived drills are loaded too so the "Archived" status filter can
      // surface them for unarchive/delete; they're hidden by default in the
      // client (DEFAULT_STATUSES excludes archived).
      .in("status", ["draft", "published", "archived"])
      .order("updated_at", { ascending: false }),
  ]);

  const drillIds = (drills ?? []).map((d) => d.id as string);
  const [{ data: drillCatLinks }, { data: results }, skillsByDrill] =
    drillIds.length
      ? await Promise.all([
          supabase
            .from("team_drill_categories")
            .select("drill_id, category_id")
            .in("drill_id", drillIds),
          supabase
            .from("benchmark_results")
            .select(
              "drill_id, benchmark_type, time_seconds, rating, made_count, attempts_count, created_at"
            )
            .in("drill_id", drillIds)
            .order("created_at", { ascending: true }),
          // Skill taxonomy links per drill — powers the skill-group filter
          // (replacing the retired skill-category chips). Returns
          // Record<drillId, TaggedSkill[]> with skill_group already joined.
          loadDrillSkills(supabase, drillIds),
        ])
      : [
          { data: [] as { drill_id: string; category_id: string }[] },
          {
            data: [] as Array<{
              drill_id: string;
              benchmark_type: string | null;
              time_seconds: number | null;
              rating: number | null;
              made_count: number | null;
              attempts_count: number | null;
              created_at: string;
            }>,
          },
          {} as Record<string, never[]>,
        ];

  const categoryById = new Map<string, { slug: CatSlug; name: string }>();
  (categories ?? []).forEach((c) => {
    const name = c.category_name as string;
    categoryById.set(c.id as string, {
      slug: categoryToSlug(name),
      name,
    });
  });

  // Group category ids by drill — preserves category display_order via the
  // order categories were fetched in.
  const catsByDrill = new Map<string, string[]>();
  (drillCatLinks ?? []).forEach((link) => {
    const arr = catsByDrill.get(link.drill_id as string) ?? [];
    arr.push(link.category_id as string);
    catsByDrill.set(link.drill_id as string, arr);
  });

  // Group benchmark results by drill (already sorted oldest → newest).
  const resultsByDrill = new Map<string, typeof results>();
  (results ?? []).forEach((r) => {
    const arr = resultsByDrill.get(r.drill_id) ?? [];
    arr.push(r);
    resultsByDrill.set(r.drill_id, arr);
  });

  // Resolve a single numeric value for a result row based on its type.
  function resultValue(r: NonNullable<typeof results>[number]): number | null {
    switch (r.benchmark_type) {
      case "timed":
        return r.time_seconds != null ? Number(r.time_seconds) : null;
      case "rated":
      case "reps":
      case "flags":
      case "drops":
        return r.rating != null ? Number(r.rating) : null;
      case "pct": {
        const m = r.made_count ?? 0;
        const a = r.attempts_count ?? 0;
        return a > 0 ? Math.round((m / a) * 100) : null;
      }
      default:
        return null;
    }
  }

  const teamColor = teamColorHex(team.team_color);

  const drillRows: DrillRow[] = (drills ?? []).map((d) => {
    const drillId = d.id as string;
    const ids = catsByDrill.get(drillId) ?? [];
    const cats: CatSlug[] = ids
      .map((id) => categoryById.get(id)?.slug)
      .filter((s): s is CatSlug => !!s);

    // Skill groups the drill develops, derived from its taxonomy links and
    // ordered canonically (radar order). Drives the skill-group filter.
    const tagged = skillsByDrill[drillId] ?? [];
    const skillGroups: SkillGroup[] = SKILL_GROUP_META.filter((m) =>
      tagged.some((t) => t.skill_group === m.id)
    ).map((m) => m.id);
    // Skills for the card chips — primaries first, then by canonical group
    // order so the chip row reads the same as the preset cards.
    const groupOrder = new Map(SKILL_GROUP_META.map((m, i) => [m.id, i]));
    const skills: TaggedSkill[] = [...tagged].sort((a, b) => {
      if (a.weight !== b.weight) return b.weight - a.weight; // primary (1.0) first
      return (
        (groupOrder.get(a.skill_group) ?? 99) -
        (groupOrder.get(b.skill_group) ?? 99)
      );
    });

    // Coalesce legacy single benchmark_type into the new array shape. The
    // form is being upgraded in a follow-up; the read path bridges either.
    const rawTypes = (d.benchmark_types as string[] | null) ?? [];
    const legacy = d.benchmark_type as string | null;
    const merged = new Set<string>(rawTypes);
    if (legacy) merged.add(legacy);
    const types: BenchKind[] = Array.from(merged).filter((t): t is BenchKind =>
      (ALLOWED_BENCH as string[]).includes(t)
    );

    // Aggregate stats for the primary type (first in types[]).
    const primaryType = types[0] ?? null;
    const all = resultsByDrill.get(drillId) ?? [];
    const matching = primaryType
      ? all.filter((r) => r.benchmark_type === primaryType)
      : all;
    const runs = matching.length;
    const lastRunAt = runs > 0 ? matching[runs - 1].created_at : null;
    const samples = matching
      .slice(-5)
      .map(resultValue)
      .filter((v): v is number => v != null);
    const lastResult = samples.length > 0 ? samples[samples.length - 1] : null;
    const trend =
      samples.length >= 2
        ? Number((samples[samples.length - 1] - samples[0]).toFixed(2))
        : null;

    return {
      id: drillId,
      name: d.drill_name as string,
      description: (d.description as string | null) ?? null,
      status: d.status as DrillStatus,
      // preset_drill_id set => this is a clone of a global preset (remove
      // from library); null => a custom drill (archive, then delete).
      isPreset: (d.preset_drill_id as string | null) != null,
      cats,
      skillGroups,
      skills,
      types,
      primaryType,
      duration: (d.default_duration_min as number | null) ?? null,
      reps: (d.default_reps as number | null) ?? null,
      pinned: !!d.is_dashboard_pinned,
      updatedAt: d.updated_at as string,
      runs,
      lastRunAt,
      lastResult,
      samples,
      trend,
      team: {
        id: teamId,
        name: team.team_name as string,
        color: teamColor,
      },
    };
  });

  const sidebarWorkspaces = await loadSidebarWorkspaces(teamId, team.league_id);
  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  const publishedCount = drillRows.filter((d) => d.status === "published").length;
  const draftCount = drillRows.filter((d) => d.status === "draft").length;
  const kickerParts: string[] = [];
  if (publishedCount) kickerParts.push(`${publishedCount} published`);
  if (draftCount) kickerParts.push(`${draftCount} draft`);
  const kicker = kickerParts.join(" · ") || "Empty library";

  return (
    <div className="uff-web">
      <TeamSidebar
        active="drills"
        teamId={teamId}
        teamColor={teamColor}
        teamName={team.team_name}
        leagueId={team.league_id}
        user={{
          firstName: profile?.first_name ?? user.email ?? "",
          lastName: profile?.last_name ?? "",
        }}
        workspaces={sidebarWorkspaces}
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={[
            {
              label: team.team_name,
              href: `/dashboard/team/${teamId}`,
            },
          ]}
          title="Drill library"
          kicker={kicker}
          userInitials={initials}
          showSearch={false}
          actions={
            <>
              <Link href={`${base}/library`} className="wbtn">
                <Icon.search size={13} /> Browse library
              </Link>
              {canManage && (
                <>
                  {isPro ? (
                    <Link href={`${base}/paste`} className="wbtn primary">
                      <Icon.plus size={13} /> Paste a link
                    </Link>
                  ) : (
                    <span
                      className="wbtn primary"
                      aria-disabled="true"
                      title="AI drafting is a Pro feature"
                      style={{
                        opacity: 0.5,
                        cursor: "not-allowed",
                        pointerEvents: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Icon.plus size={13} /> Paste a link
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: ".12em",
                          padding: "1px 5px",
                          borderRadius: 4,
                          background: "rgba(255,255,255,0.14)",
                        }}
                      >
                        PRO
                      </span>
                    </span>
                  )}
                  <Link href={`${base}/new`} className="wbtn">
                    <Icon.plus size={13} /> Build by hand
                  </Link>
                </>
              )}
            </>
          }
        />

        <div
          className="page"
          style={{ maxWidth: 1320, margin: "0 auto", width: "100%" }}
        >
          <DrillsLibraryClient
            drills={drillRows}
            canManage={canManage}
            base={base}
            teamId={teamId}
            plan={(team.plan as string | null) ?? null}
          />
        </div>
      </div>
    </div>
  );
}
