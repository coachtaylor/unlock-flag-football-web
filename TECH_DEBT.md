# Tech Debt — to resolve next

Tracked cross-cutting issues that aren't blocking today but should be paid down
deliberately. Newest / highest-priority first.

---

## TD-1 · `benchmark_config` has two incompatible shapes across web and mobile

**Status:** ✅ Resolved 2026-06-03 — converged on the canonical scope-grouped shape (see "Resolution" at the bottom). **Action required:** run migration `91_normalize_benchmark_config.sql`.
**Severity:** Medium (data-fidelity bug; no data loss, but cross-platform benchmark scope/targets can be misread)
**Found:** 2026-06-03, during Build 16.5 mobile parity (investigating a reported "benchmark shows on mobile but not web" on a coaching-only preset drill)

### Summary

The `team_drills.benchmark_config` (jsonb) column is written in **different shapes**
by the web app and the mobile app. A benchmark drill created/edited on one
platform cannot have its rich benchmark config (scope + per-type targets) read
faithfully by the other. The benchmark *exists/doesn't* signal is fine (see
"What's already consistent"); the **fidelity of the config** is what breaks.

### The two shapes

- **Web** (`unlock-web/src/app/(workspace)/drills/DrillForm.tsx`, type `BenchConfig`):
  **type-keyed** — `{ timed: { target, better? }, rated: { target }, ... }`.
  `Object.keys(config)` are the benchmark types. No scope inside the JSON; scope
  isn't modeled on web the same way.

- **Mobile** (`unlock-mobile/constants/benchmarks.ts`, type `BenchmarkConfig`):
  **scope-grouped** — `{ scope: 'whole'|'qb'|'nonqb'|'both', whole?/qb?/nonqb?: GroupConfig }`,
  where each group holds the per-type entries. Paired with the separate
  `team_drills.benchmark_scope` column.

So the same column holds, e.g.:
- web: `{"timed":{"target":"4.8","better":"lower"}}`
- mobile: `{"scope":"qb","qb":{"timed":{"target":"4.8"}}}`

### Where it bites

1. **Mobile reading a web-made benchmark drill:** `parseBenchmarkConfig()` expects a
   `scope` key, gets none → returns `null` → falls back to
   `benchmarkConfigFromLegacy(benchmark_type, benchmark_types)`, which rebuilds a
   **whole-team** config from the flat type list. Result: a web drill that was
   meant to be (say) QB-only renders/logs as whole-team on mobile, and per-type
   target directions ("lower is better") may be lost.

2. **Web reading a mobile-made benchmark drill:** web paths that read
   `benchmark_config` directly (e.g. `(app)/benchmarks/log/BenchmarkLogClient.tsx`,
   which types it as `Partial<Record<BenchKind, BenchConfigEntry>>`) will treat
   the mobile keys `scope`/`qb`/`nonqb` as if they were benchmark types →
   garbage / broken log UI.

### What's already consistent (and why this isn't worse)

- **`benchmark_types` (text[])** is written **in sync** by both forms and zeroed by
  the clone RPC, and is shape-compatible (a flat list). It is the de-facto
  cross-platform source of truth for "is this a benchmark / which types."
  - Web drill detail derives benchmark presence from `benchmark_types` (+ legacy
    `benchmark_type`).
  - Mobile drill detail was aligned to the same in Build 16.5
    (`isBenchmarkDrill = benchmark_types.length > 0 || !!benchmark_type`).
  - So the **boolean + type list never disagree** across platforms. Only the
    structured config (scope + per-type targets) does.
- `benchmark_scope` is its own column; mobile uses it, web largely doesn't.

### Root cause

The structured benchmark config was designed independently on each platform
(web's type-keyed model predates / diverges from mobile's scope-grouped model),
and both serialize to the same `benchmark_config` column without a shared schema.

### Proposed resolution (pick one canonical shape, then migrate + converge)

1. **Decide the canonical shape.** Recommended: the **mobile scope-grouped** shape
   (`{ scope, whole/qb/nonqb }`), because scope is a real product concept (QB vs
   non-QB benchmarks) that the web model can't express. Fold `benchmark_scope`
   into it or keep the column as a denormalized mirror.
2. **Write a migration** that rewrites existing `benchmark_config` rows into the
   canonical shape (web-shaped rows → wrap in `{ scope: 'whole', whole: <types> }`),
   leaving `benchmark_types` untouched (already correct).
3. **Converge the readers/writers:**
   - Web: replace `BenchConfig` (type-keyed) with the canonical shape; update
     `DrillForm` save, `(app)/benchmarks/log/*`, and drill-detail snapshot.
   - Mobile: already on the canonical shape — keep `parseBenchmarkConfig` as the
     single parser; consider sharing the type definition.
4. **Add a shared parse/flatten contract** (mirror, by-design, like
   `lib/activity` / `formatActorTime`) so the two never drift again:
   `parseBenchmarkConfig` + `flattenBenchmarkTypes` with identical behavior in
   both repos.

### Acceptance criteria

- A benchmark drill created on web and opened in mobile's **run/log** flow shows
  the correct scope and per-type targets (and vice versa).
- `benchmark_config` validates against one schema regardless of origin platform.
- `benchmark_types` continues to be written in sync (no regression to the
  is-benchmark signal).
- No drill loses its benchmark configuration during the migration.

### Out of scope / non-goals

- Changing the `benchmark_results` shape or the logging UX itself.
- The "is this a benchmark" boolean — already unified on `benchmark_types`.

### Resolution (shipped 2026-06-03)

**Canonical shape = the scope-grouped envelope** — which turned out to be the
*original* DB convention (migration 38 already seeded
`{ scope:'whole', whole:{ types, perType } }`). Web's type-keyed shape was the
regression, so web converges onto mobile/the DB, not the other way around.

One nuance the original writeup missed: the **per-type entry** also diverged.
Web stored `{ target, better }` (pass-mark threshold + direction); mobile stored
`{ attemptsPerSet, label, inverse }` (capture knobs). These are complementary,
not competing — so the canonical `PerTypeConfig` is the **union**, with direction
canonicalized on the boolean `inverse` (`better:'lower'` ⇔ `inverse:true`). Web
keeps `better` only as an internal UI representation and maps at the boundary.

What changed:
- **Migration `91_normalize_benchmark_config.sql`** — rewrites web-shaped
  `team_drills.benchmark_config` rows into the canonical shape (maps
  `better`→`inverse`); skips already-canonical/empty/null rows; leaves
  `benchmark_types` untouched. Idempotent. **Must be run manually.**
- **Mobile** `constants/benchmarks.ts` — added optional `target` to
  `PerTypeConfig` + `parseGroup`, so a web-authored pass-mark survives a mobile
  read/round-trip (mobile doesn't surface a target editor yet — preservation
  only).
- **Web** new shared lib `src/lib/benchmarks/config.ts` — by-design cross-repo
  mirror of mobile's contract (like `lib/activity`): `parseBenchmarkConfig`,
  `webEntriesFromConfig` (canonical → flat web shape for the scope-less web UI),
  and `applyWebEdits` (web edits → canonical, **preserving the original scope +
  any mobile-only per-type knobs** so a web save never silently flattens a
  mobile-authored scoped drill).
- **Web** drill form (`DrillForm.tsx`), drill edit loader
  (`drills/[id]/edit/page.tsx`), and benchmark log loader
  (`benchmarks/log/page.tsx`) now read/write through that lib. Web also writes
  `benchmark_scope` for the first time. The benchmark **log client needed no
  change** — it still consumes the flat web shape; the loader just feeds it
  correctly-mapped entries.

Both repos typecheck clean. **Keep `unlock-web/src/lib/benchmarks/config.ts` and
`unlock-mobile/constants/benchmarks.ts` in sync** — they are intentional mirrors.

Known limitation (acceptable for MVP): web has no scope picker, so editing a
mobile-authored `qb`/`nonqb`/`both` drill's *type set* on web applies the new
types to that drill's existing group(s) but can't re-split scope. Editing only
name/notes/etc. preserves the config untouched.
