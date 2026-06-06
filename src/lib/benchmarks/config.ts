// Canonical benchmark_config contract — WEB MIRROR of
// unlock-mobile/constants/benchmarks.ts. By-design cross-repo duplication
// (same pattern as lib/activity + formatActorTime): keep the two in sync.
//
// The DB stores team_drills.benchmark_config in ONE canonical shape — the
// scope-grouped envelope established in migration 38 and used by the mobile
// app + the benchmark capture flow:
//
//   { scope, matchConfigs?, whole?|qb?|nonqb?: { types, perType } }
//
// Web only authors WHOLE-team benchmarks (there is no scope picker in the web
// drill form), but it must (a) read configs authored by mobile without losing
// scope or per-type knobs, and (b) preserve scope + mobile-only knobs when a
// web edit saves over a mobile-authored drill. See TD-1 in TECH_DEBT.md.
//
// Direction canonicalizes on the boolean `inverse` (mobile's field). Web's UI
// works in `better: 'lower'|'higher'` terms; the two map at this boundary.

import { BENCH_BY_ID, type BenchKind } from "@/components/uff-web/drills/atoms";

export type BenchmarkScope = "whole" | "qb" | "nonqb" | "both";

const BENCH_ORDER: BenchKind[] = [
  "timed",
  "rated",
  "reps",
  "pct",
  "flags",
  "drops",
];

const isBenchKind = (v: unknown): v is BenchKind =>
  typeof v === "string" && (BENCH_ORDER as string[]).includes(v);

// Union per-type entry. Web authors `target` + (via mapping) `inverse`;
// mobile authors `attemptsPerSet` / `label` / `inverse`. We preserve the
// mobile-only fields untouched when web saves over a mobile-authored drill.
export type PerTypeConfig = {
  target?: string;
  inverse?: boolean;
  attemptsPerSet?: number;
  label?: string;
};

export type GroupConfig = {
  types: BenchKind[];
  perType: Partial<Record<BenchKind, PerTypeConfig>>;
};

export type BenchmarkConfig = {
  scope: BenchmarkScope;
  matchConfigs?: boolean;
  whole?: GroupConfig;
  qb?: GroupConfig;
  nonqb?: GroupConfig;
};

// The web drill form's per-type representation.
export type WebBenchEntry = { target?: string; better?: "lower" | "higher" };
export type WebBenchConfig = Partial<Record<BenchKind, WebBenchEntry>>;

type GroupName = "whole" | "qb" | "nonqb";

function groupsForScope(scope: BenchmarkScope): GroupName[] {
  if (scope === "whole") return ["whole"];
  if (scope === "qb") return ["qb"];
  if (scope === "nonqb") return ["nonqb"];
  return ["qb", "nonqb"];
}

// ── Parse (mirror of mobile parseBenchmarkConfig / parseGroup) ───────────

function parseGroup(raw: unknown): GroupConfig {
  if (!raw || typeof raw !== "object") return { types: [], perType: {} };
  const r = raw as Record<string, unknown>;
  const types = Array.isArray(r.types) ? r.types.filter(isBenchKind) : [];
  const perType: GroupConfig["perType"] = {};
  const rawPerType =
    r.perType && typeof r.perType === "object"
      ? (r.perType as Record<string, unknown>)
      : {};
  for (const t of types) {
    const cfg = rawPerType[t];
    const next: PerTypeConfig = {};
    if (cfg && typeof cfg === "object") {
      const c = cfg as Record<string, unknown>;
      if (typeof c.attemptsPerSet === "number")
        next.attemptsPerSet = c.attemptsPerSet;
      if (typeof c.label === "string") next.label = c.label;
      if (typeof c.inverse === "boolean") next.inverse = c.inverse;
      if (typeof c.target === "string" && c.target.trim() !== "")
        next.target = c.target.trim();
    }
    perType[t] = next;
  }
  return { types, perType };
}

export function parseBenchmarkConfig(raw: unknown): BenchmarkConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const scope = r.scope as BenchmarkScope | undefined;
  if (scope !== "whole" && scope !== "qb" && scope !== "nonqb" && scope !== "both")
    return null;
  const cfg: BenchmarkConfig = { scope };
  if (typeof r.matchConfigs === "boolean") cfg.matchConfigs = r.matchConfigs;
  if (r.whole) cfg.whole = parseGroup(r.whole);
  if (r.qb) cfg.qb = parseGroup(r.qb);
  if (r.nonqb) cfg.nonqb = parseGroup(r.nonqb);
  return cfg;
}

// ── Direction mapping (canonical `inverse` <-> web `better`) ─────────────

function betterFromInverse(
  type: BenchKind,
  inverse: boolean | undefined,
): "lower" | "higher" {
  if (inverse === true) return "lower";
  if (inverse === false) return "higher";
  return BENCH_BY_ID[type].better; // catalog default when unset
}

// Only return a value when web set an explicit direction (timed / drops);
// otherwise undefined so we DON'T clobber a mobile-authored `inverse`.
function inverseFromBetter(
  better: "lower" | "higher" | undefined,
): boolean | undefined {
  if (better === "lower") return true;
  if (better === "higher") return false;
  return undefined;
}

// ── Read: canonical -> web form/log shape ────────────────────────────────
// Flattens the config into a single type list + per-type {target, better} for
// web's flat (scope-less) UI. `whole` is used as-is; for qb/nonqb/both we
// merge the groups (first group wins on a per-type conflict) so a coach still
// sees the drill's targets when opening a mobile-scoped drill on web.

// One group → web {types, perType}. Used per-role when the form edits a
// scope's groups independently (e.g. "both" — QB vs non-QB).
export function webEntriesFromGroup(group: GroupConfig | undefined): {
  types: BenchKind[];
  perType: WebBenchConfig;
} {
  const perType: WebBenchConfig = {};
  const types = BENCH_ORDER.filter((t) => group?.types.includes(t));
  for (const t of types) {
    const pt = group!.perType[t] ?? {};
    perType[t] = { target: pt.target, better: betterFromInverse(t, pt.inverse) };
  }
  return { types, perType };
}

export function webEntriesFromConfig(cfg: BenchmarkConfig): {
  types: BenchKind[];
  perType: WebBenchConfig;
} {
  const typeSet = new Set<BenchKind>();
  const perType: WebBenchConfig = {};
  for (const gName of groupsForScope(cfg.scope)) {
    const { types, perType: gPer } = webEntriesFromGroup(cfg[gName]);
    for (const t of types) {
      typeSet.add(t);
      if (!perType[t]) perType[t] = gPer[t];
    }
  }
  return { types: BENCH_ORDER.filter((t) => typeSet.has(t)), perType };
}

// Flatten a canonical config to its de-duped type list (for the flat
// benchmark_types[] column the dashboard filters on).
export function flattenConfigTypes(cfg: BenchmarkConfig): BenchKind[] {
  return webEntriesFromConfig(cfg).types;
}

// ── Write: web edits -> canonical, preserving scope + mobile knobs ───────
// Web always edits as a flat type list with per-type targets. We write those
// into whichever groups the drill's existing scope uses (whole for new /
// legacy / whole drills), preserving mobile-only per-type fields and the
// original scope so a web save never silently flattens a mobile config.

// Build one canonical group from a web type list + per-type edits, preserving
// any mobile-only per-type knobs (attemptsPerSet / label) on the existing group.
function buildGroupFromWeb(
  existing: GroupConfig | undefined,
  types: BenchKind[],
  webPerType: WebBenchConfig,
): GroupConfig {
  const ordered = BENCH_ORDER.filter((t) => types.includes(t));
  const perType: GroupConfig["perType"] = {};
  for (const t of ordered) {
    const prev = existing?.perType[t] ?? {};
    const web = webPerType[t] ?? {};
    const entry: PerTypeConfig = { ...prev }; // keep mobile knobs

    const target = web.target != null ? String(web.target).trim() : "";
    if (target !== "") entry.target = target;
    else delete entry.target;

    const inv = inverseFromBetter(web.better);
    if (inv !== undefined) entry.inverse = inv;

    perType[t] = entry;
  }
  return { types: [...ordered], perType };
}

// A web type list + per-type edits, per role group. Only the groups relevant
// to `scope` are read.
export type WebGroupEdits = {
  whole?: { types: BenchKind[]; perType: WebBenchConfig };
  qb?: { types: BenchKind[]; perType: WebBenchConfig };
  nonqb?: { types: BenchKind[]; perType: WebBenchConfig };
};

// Write web edits into a canonical config under an explicit scope (role).
// Mirrors mobile's buildBenchmarkConfig: whole/qb/nonqb keep a single group;
// "both" keeps qb + nonqb (collapsed to one shared group when matchConfigs).
export function applyWebEditsScoped(
  original: BenchmarkConfig | null,
  scope: BenchmarkScope,
  edits: WebGroupEdits,
  matchConfigs = false,
): BenchmarkConfig {
  const cfg: BenchmarkConfig = { scope };
  if (scope === "both") {
    cfg.matchConfigs = matchConfigs;
    const nonqb = buildGroupFromWeb(
      original?.nonqb,
      edits.nonqb?.types ?? [],
      edits.nonqb?.perType ?? {},
    );
    cfg.nonqb = nonqb;
    cfg.qb = matchConfigs
      ? nonqb
      : buildGroupFromWeb(original?.qb, edits.qb?.types ?? [], edits.qb?.perType ?? {});
    return cfg;
  }
  const g = scope; // "whole" | "qb" | "nonqb"
  cfg[g] = buildGroupFromWeb(original?.[g], edits[g]?.types ?? [], edits[g]?.perType ?? {});
  return cfg;
}

// Back-compat flat (whole-scope) writer. Preserves the drill's existing scope
// by writing the same flat edits into each of that scope's groups.
export function applyWebEdits(
  original: BenchmarkConfig | null,
  types: BenchKind[],
  webPerType: WebBenchConfig,
): BenchmarkConfig {
  const scope: BenchmarkScope = original?.scope ?? "whole";
  const cfg: BenchmarkConfig = { scope };
  if (scope === "both" && typeof original?.matchConfigs === "boolean") {
    cfg.matchConfigs = original.matchConfigs;
  }
  for (const g of groupsForScope(scope)) {
    cfg[g] = buildGroupFromWeb(original?.[g], types, webPerType);
  }
  return cfg;
}
