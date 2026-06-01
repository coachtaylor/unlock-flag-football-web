// Coach attribution read layer (Build 14.5).
//
// Reads the append-only activity_events log (mig 74) and resolves actor names
// (via profiles) + subject-player names (via team_players) for display. Powers
// BOTH the team activity feed (RecentActivityCard) and the per-entity history
// shown behind a byline tap. describeActivity() is the single place that turns
// a raw event into human-readable verb/what/category, so the feed and the
// history modal never phrase the same event differently.
//
// Resilient by design: if the table doesn't exist yet (migrations not applied)
// or the query errors, every loader returns [] and the surfaces fall back to
// their empty state rather than throwing.

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatActorTime } from "./time";

export type ActivityEntityType =
  | "drill"
  | "practice_plan"
  | "player"
  | "benchmark"
  | "practice_log"
  | "note";

export type ActivityEvent = {
  id: string;
  teamId: string;
  actorUserId: string;
  verb: string;
  entityType: ActivityEntityType;
  entityId: string;
  subjectPlayerId: string | null;
  summary: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

// An event enriched with display fields, ready to render.
export type ActivityFeedItem = ActivityEvent & {
  who: string; // actor display name
  subjectName: string | null; // resolved player name (benchmarks / player events / notes)
  verbLabel: string; // human verb phrase
  what: string; // the object of the action
  category: string; // dot-color key (matches RecentActivityCard's CAT_COLOR)
  when: string; // formatActorTime(createdAt)
};

// Past-tense verb phrases. cleared_review / injury verbs read as phrases that
// expect a name to follow (the player), so describeActivity puts the name in `what`.
const VERB_LABEL: Record<string, string> = {
  created: "created",
  updated: "updated",
  published: "published",
  unpublished: "unpublished",
  pinned: "pinned",
  unpinned: "unpinned",
  finalized: "finalized",
  began: "started",
  completed: "completed",
  archived: "archived",
  added: "added",
  deactivated: "deactivated",
  reactivated: "reactivated",
  assessed: "assessed",
  quick_rated: "quick-rated",
  cleared_review: "cleared review on",
  logged_injury: "flagged an injury for",
  resolved_injury: "cleared the injury for",
  noted: "added a note",
  logged: "logged",
};

// Dot color key per entity type (keys exist in RecentActivityCard's CAT_COLOR).
const CATEGORY_BY_ENTITY: Record<ActivityEntityType, string> = {
  drill: "fundamentals",
  practice_plan: "offense",
  practice_log: "offense",
  benchmark: "qb",
  player: "footwork",
  note: "routes",
};

// Compact benchmark value from meta, e.g. " · 4.52s" / " · 4/5" / " · 7/10".
function benchmarkValue(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const time = meta.time_seconds as number | null | undefined;
  const rating = meta.rating as number | null | undefined;
  const made = meta.made_count as number | null | undefined;
  const attempts = meta.attempts_count as number | null | undefined;
  if (time != null) return ` · ${Number(time).toFixed(2)}s`;
  if (rating != null) return ` · ${rating}/5`;
  if (made != null && attempts != null) return ` · ${made}/${attempts}`;
  return "";
}

/**
 * Turn a raw event into { verbLabel, what, category } for display. Single
 * source so the feed and history modal phrase events identically.
 */
export function describeActivity(
  ev: ActivityEvent,
  ctx: { subjectName?: string | null } = {}
): { verbLabel: string; what: string; category: string } {
  const verbLabel = VERB_LABEL[ev.verb] ?? ev.verb;
  const category = CATEGORY_BY_ENTITY[ev.entityType] ?? "fundamentals";
  const summary = ev.summary ?? "";
  const subject = ctx.subjectName ?? null;

  let what = summary;
  switch (ev.entityType) {
    case "benchmark":
      what = subject ? `${subject} · ${summary}${benchmarkValue(ev.meta)}` : `${summary}${benchmarkValue(ev.meta)}`;
      break;
    case "player":
      // verb phrases like "flagged an injury for" already expect the name next.
      what = summary || subject || "a player";
      break;
    case "note":
      what = subject ? `on ${subject}` : "a practice note";
      break;
    case "practice_log":
      what = "post-practice notes";
      break;
    default:
      what = summary;
  }
  return { verbLabel, what, category };
}

// ── name resolution ────────────────────────────────────────────────────────

/**
 * Resolve actor user ids → display names (display_name, else "First Last",
 * else "Coach"). Single source for the actor-name rule, reused by the feed,
 * the history modal, and detail-card bylines. Returns an empty map on error.
 */
export async function resolveActorNames(
  supabase: SupabaseClient,
  userIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean) as string[]));
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, last_name")
    .in("id", ids);
  for (const p of (data ?? []) as {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
  }[]) {
    const name =
      p.display_name?.trim() ||
      [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
      "Coach";
    out.set(p.id, name);
  }
  return out;
}

/** One actor id → display name (null if unresolved). Convenience for bylines. */
export async function resolveActorName(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<string | null> {
  if (!userId) return null;
  const map = await resolveActorNames(supabase, [userId]);
  return map.get(userId) ?? null;
}

async function enrich(
  supabase: SupabaseClient,
  events: ActivityEvent[]
): Promise<ActivityFeedItem[]> {
  if (events.length === 0) return [];

  const subjectIds = Array.from(
    new Set(events.map((e) => e.subjectPlayerId).filter(Boolean) as string[])
  );

  const [nameByUser, playersRes] = await Promise.all([
    resolveActorNames(supabase, events.map((e) => e.actorUserId)),
    subjectIds.length
      ? supabase.from("team_players").select("id, player_name").in("id", subjectIds)
      : Promise.resolve({ data: [] as { id: string; player_name: string }[] }),
  ]);

  const playerById = new Map<string, string>();
  for (const p of (playersRes.data ?? []) as { id: string; player_name: string }[]) {
    playerById.set(p.id, p.player_name);
  }

  return events.map((ev) => {
    const subjectName = ev.subjectPlayerId ? playerById.get(ev.subjectPlayerId) ?? null : null;
    const { verbLabel, what, category } = describeActivity(ev, { subjectName });
    return {
      ...ev,
      who: nameByUser.get(ev.actorUserId) ?? "Coach",
      subjectName,
      verbLabel,
      what,
      category,
      when: formatActorTime(ev.createdAt),
    };
  });
}

const SELECT_COLS =
  "id, team_id, actor_user_id, verb, entity_type, entity_id, subject_player_id, summary, meta, created_at";

function rowToEvent(r: Record<string, unknown>): ActivityEvent {
  return {
    id: r.id as string,
    teamId: r.team_id as string,
    actorUserId: r.actor_user_id as string,
    verb: r.verb as string,
    entityType: r.entity_type as ActivityEntityType,
    entityId: r.entity_id as string,
    subjectPlayerId: (r.subject_player_id as string | null) ?? null,
    summary: (r.summary as string | null) ?? null,
    meta: (r.meta as Record<string, unknown> | null) ?? null,
    createdAt: r.created_at as string,
  };
}

/**
 * Team activity feed, newest first. `sinceDays` windows the feed (the
 * dashboard card uses 7); omit for all-time. Returns [] on any error so the
 * card renders its empty state (incl. before migrations are applied).
 */
export async function loadTeamActivity(
  supabase: SupabaseClient,
  teamId: string,
  opts: { limit?: number; sinceDays?: number } = {}
): Promise<ActivityFeedItem[]> {
  if (!teamId) return [];
  const { limit = 20, sinceDays } = opts;
  let q = supabase
    .from("activity_events")
    .select(SELECT_COLS)
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (sinceDays != null) {
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * sinceDays).toISOString();
    q = q.gte("created_at", cutoff);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return enrich(supabase, data.map(rowToEvent));
}

/**
 * Full history for one entity (the create→edit→finalize→… trail shown behind a
 * byline tap), newest first. Returns [] on any error.
 */
export async function loadEntityHistory(
  supabase: SupabaseClient,
  entityType: ActivityEntityType,
  entityId: string,
  opts: { limit?: number } = {}
): Promise<ActivityFeedItem[]> {
  if (!entityId) return [];
  const { data, error } = await supabase
    .from("activity_events")
    .select(SELECT_COLS)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (error || !data) return [];
  return enrich(supabase, data.map(rowToEvent));
}
