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
// The web drill form authors the full scope-grouped config (whole / qb /
// nonqb / both) via its own scope picker — parity with mobile. It must also
// (a) read configs authored by mobile without losing scope or per-type knobs,
// and (b) preserve mobile-only per-type knobs (attemptsPerSet, label) when a
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

// Build a whole-team config from the pre-migration-38 legacy columns
// (benchmark_type / benchmark_types). Mirror of mobile's
// benchmarkConfigFromLegacy. Used as a fallback when benchmark_config is null
// so a legacy drill still shows its benchmarks in the editor.
const LEGACY_TYPE_MAP: Record<string, BenchKind> = {
  timed: "timed",
  rated: "rated",
  reps_complete: "reps",
  percentage: "pct",
};

export function benchmarkConfigFromLegacy(
  legacyType: string | null | undefined,
  legacyTypes: string[] | null | undefined,
): BenchmarkConfig | null {
  const fromArray = (legacyTypes ?? [])
    .map((t) => LEGACY_TYPE_MAP[t] ?? (isBenchKind(t) ? t : null))
    .filter((t): t is BenchKind => t != null);
  const single = legacyType ? LEGACY_TYPE_MAP[legacyType] : null;
  const seen = new Set<BenchKind>();
  const types = (fromArray.length > 0 ? fromArray : single ? [single] : [])
    .filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
  if (types.length === 0) return null;
  const perType: GroupConfig["perType"] = {};
  for (const t of types) perType[t] = {};
  return { scope: "whole", whole: { types, perType } };
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

export function webEntriesFromConfig(cfg: BenchmarkConfig): {
  types: BenchKind[];
  perType: WebBenchConfig;
} {
  const typeSet = new Set<BenchKind>();
  const perType: WebBenchConfig = {};
  for (const gName of groupsForScope(cfg.scope)) {
    const g = cfg[gName];
    if (!g) continue;
    for (const t of g.types) {
      typeSet.add(t);
      if (!perType[t]) {
        const pt = g.perType[t] ?? {};
        perType[t] = { target: pt.target, better: betterFromInverse(t, pt.inverse) };
      }
    }
  }
  return { types: BENCH_ORDER.filter((t) => typeSet.has(t)), perType };
}

// Per-group read — canonical GroupConfig -> web {types, perType}. Used to seed
// each of the web form's three parallel group editors (whole / qb / nonqb) so
// the scope picker is non-destructive when flipping between scopes.
export function webGroupEntries(g: GroupConfig | undefined): {
  types: BenchKind[];
  perType: WebBenchConfig;
} {
  if (!g) return { types: [], perType: {} };
  const perType: WebBenchConfig = {};
  for (const t of g.types) {
    const pt = g.perType[t] ?? {};
    perType[t] = { target: pt.target, better: betterFromInverse(t, pt.inverse) };
  }
  return { types: BENCH_ORDER.filter((t) => g.types.includes(t)), perType };
}

// Seed the web drill form's benchmark state from a stored config. Mirrors the
// three parallel group states the mobile DrillForm keeps (so a coach can flip
// whole → both → whole without losing a config).
export function webFormGroups(cfg: BenchmarkConfig | null): {
  scope: BenchmarkScope;
  matchConfigs: boolean;
  whole: { types: BenchKind[]; perType: WebBenchConfig };
  qb: { types: BenchKind[]; perType: WebBenchConfig };
  nonqb: { types: BenchKind[]; perType: WebBenchConfig };
} {
  return {
    scope: cfg?.scope ?? "whole",
    matchConfigs: cfg?.matchConfigs ?? false,
    whole: webGroupEntries(cfg?.whole),
    qb: webGroupEntries(cfg?.qb),
    nonqb: webGroupEntries(cfg?.nonqb),
  };
}

// ── Write: web edits -> canonical, preserving scope + mobile knobs ───────
// Web now authors the full scope-grouped config (whole / qb / nonqb / both),
// mirroring mobile's buildBenchmarkConfig. Each web group carries a flat type
// list + per-type {target, better}; we map that back into the canonical
// {types, perType{target, inverse}} shape while preserving any mobile-only
// per-type fields (attemptsPerSet, label) from the matching original group.

type WebGroupInput = { types: BenchKind[]; perType: WebBenchConfig };

export function buildWebBenchmarkConfig(input: {
  original: BenchmarkConfig | null;
  scope: BenchmarkScope;
  whole: WebGroupInput;
  qb: WebGroupInput;
  nonqb: WebGroupInput;
  matchConfigs: boolean;
}): BenchmarkConfig {
  const { original, scope, whole, qb, nonqb, matchConfigs } = input;

  const buildGroup = (
    web: WebGroupInput,
    existing?: GroupConfig,
  ): GroupConfig => {
    const ordered = BENCH_ORDER.filter((t) => web.types.includes(t));
    const perType: GroupConfig["perType"] = {};
    for (const t of ordered) {
      const prev = existing?.perType[t] ?? {};
      const w = web.perType[t] ?? {};
      const entry: PerTypeConfig = { ...prev }; // keep mobile-only knobs

      const target = w.target != null ? String(w.target).trim() : "";
      if (target !== "") entry.target = target;
      else delete entry.target;

      const inv = inverseFromBetter(w.better);
      if (inv !== undefined) entry.inverse = inv;

      perType[t] = entry;
    }
    return { types: ordered, perType };
  };

  const cfg: BenchmarkConfig = { scope };
  if (scope === "whole") {
    cfg.whole = buildGroup(whole, original?.whole);
  } else if (scope === "qb") {
    cfg.qb = buildGroup(qb, original?.qb);
  } else if (scope === "nonqb") {
    cfg.nonqb = buildGroup(nonqb, original?.nonqb);
  } else {
    // both — when matchConfigs is on, QBs mirror the Non-QB group.
    cfg.matchConfigs = matchConfigs;
    const nonqbGroup = buildGroup(nonqb, original?.nonqb);
    cfg.nonqb = nonqbGroup;
    cfg.qb = matchConfigs ? nonqbGroup : buildGroup(qb, original?.qb);
  }
  return cfg;
}

// Whether a built config captures anything (mirror of mobile
// isBenchmarkConfigured). Used to gate save + decide the empty state.
export function isBenchmarkConfigured(cfg: BenchmarkConfig | null): boolean {
  if (!cfg) return false;
  if (cfg.scope === "both")
    return (cfg.qb?.types.length ?? 0) > 0 || (cfg.nonqb?.types.length ?? 0) > 0;
  const g =
    cfg.scope === "whole" ? cfg.whole : cfg.scope === "qb" ? cfg.qb : cfg.nonqb;
  return (g?.types.length ?? 0) > 0;
}
