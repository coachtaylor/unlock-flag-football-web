// Shared atoms + catalogs for the UFF Web Drills surfaces (list, detail,
// form). Mirrors the prototype in uff-web-drills-shell.jsx — kept in one
// file because every drills surface needs the same pieces.

// ── Benchmark type catalog ─────────────────────────────────────────────
// Mirrors the mobile BenchmarkKind union: timed | rated | reps | pct |
// flags | drops. Stored on team_drills.benchmark_types text[].

export type BenchKind = "timed" | "rated" | "reps" | "pct" | "flags" | "drops";

type BenchMeta = {
  id: BenchKind;
  label: string;
  unit: string;
  better: "lower" | "higher";
  accent: string;
  tint: string;
  border: string;
};

export const BENCH_TYPES: BenchMeta[] = [
  {
    id: "timed",
    label: "Timed",
    unit: "s",
    better: "lower",
    accent: "var(--uff-orange)",
    tint: "rgba(255,106,26,0.14)",
    border: "rgba(255,106,26,0.32)",
  },
  {
    id: "rated",
    label: "Rated",
    unit: "/5",
    better: "higher",
    accent: "#6EA8FF",
    tint: "rgba(110,168,255,0.14)",
    border: "rgba(110,168,255,0.32)",
  },
  {
    id: "reps",
    label: "Reps",
    unit: "×",
    better: "higher",
    accent: "var(--uff-lime)",
    tint: "rgba(194,255,61,0.14)",
    border: "rgba(194,255,61,0.32)",
  },
  {
    id: "pct",
    label: "Percent",
    unit: "%",
    better: "higher",
    accent: "#FFB347",
    tint: "rgba(255,179,71,0.16)",
    border: "rgba(255,179,71,0.34)",
  },
  {
    id: "flags",
    label: "Flags",
    unit: "pulls",
    better: "higher",
    accent: "#B89BFF",
    tint: "rgba(184,155,255,0.14)",
    border: "rgba(184,155,255,0.32)",
  },
  {
    id: "drops",
    label: "Drops",
    unit: "drops",
    better: "lower",
    accent: "#FF4D4D",
    tint: "rgba(255,77,77,0.14)",
    border: "rgba(255,77,77,0.32)",
  },
];

export const BENCH_BY_ID: Record<BenchKind, BenchMeta> = Object.fromEntries(
  BENCH_TYPES.map((b) => [b.id, b]),
) as Record<BenchKind, BenchMeta>;

export function BenchIcon({
  kind,
  size = 14,
  color,
}: {
  kind: BenchKind;
  size?: number;
  color?: string;
}) {
  const c = color || "currentColor";
  switch (kind) {
    case "timed":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l3 2M9 2h6" />
        </svg>
      );
    case "rated":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={c}>
          <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
        </svg>
      );
    case "reps":
      return (
        <span style={{ color: c, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: size - 1, lineHeight: 1 }}>#</span>
      );
    case "pct":
      return (
        <span style={{ color: c, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: size - 2, lineHeight: 1 }}>%</span>
      );
    case "flags":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 22V4M5 4h12l-2 4 2 4H5" />
        </svg>
      );
    case "drops":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={c}>
          <path d="M12 3c-3.5 5-6 9-6 12a6 6 0 0 0 12 0c0-3-2.5-7-6-12z" />
        </svg>
      );
  }
}

export function BenchChip({
  id,
  mini,
  dimmed,
}: {
  id: BenchKind;
  mini?: boolean;
  dimmed?: boolean;
}) {
  const t = BENCH_BY_ID[id];
  if (!t) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: mini ? "2px 7px" : "3px 9px",
        borderRadius: 999,
        border: `1px solid ${dimmed ? "var(--uff-line)" : t.border}`,
        background: dimmed ? "transparent" : t.tint,
        color: dimmed ? "var(--uff-text-mute)" : t.accent,
        fontSize: mini ? 9.5 : 10,
        fontWeight: 700,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        lineHeight: 1.3,
        whiteSpace: "nowrap",
      }}
    >
      <BenchIcon kind={id} size={mini ? 9 : 10} color={dimmed ? "var(--uff-text-mute)" : t.accent} />
      {t.label}
    </span>
  );
}

// Icon-only stack for table rows where a full pill would be too noisy.
// Each icon is rendered in its type accent color with a tiny tinted disc
// behind it so the type stays scannable. Hover for the label.
export function BenchIconRow({
  types,
  size = 16,
}: {
  types: BenchKind[];
  size?: number;
}) {
  if (!types || types.length === 0) {
    return null;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {types.map((id) => {
        const t = BENCH_BY_ID[id];
        if (!t) return null;
        return (
          <span
            key={id}
            title={t.label}
            aria-label={t.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              color: t.accent,
              flexShrink: 0,
            }}
          >
            <BenchIcon kind={id} size={size} color={t.accent} />
          </span>
        );
      })}
    </span>
  );
}

export function BenchChipStack({
  types,
  max = 3,
  mini,
}: {
  types: BenchKind[];
  max?: number;
  mini?: boolean;
}) {
  if (!types || types.length === 0) {
    return (
      <span
        style={{
          fontSize: mini ? 9 : 9.5,
          fontWeight: 700,
          letterSpacing: ".12em",
          color: "var(--uff-text-mute)",
          textTransform: "uppercase",
        }}
      >
        NO BENCH
      </span>
    );
  }
  const shown = types.slice(0, max);
  const overflow = types.length - shown.length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {shown.map((t) => (
        <BenchChip key={t} id={t} mini={mini} />
      ))}
      {overflow > 0 && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: mini ? 9.5 : 10.5,
            color: "var(--uff-text-mute)",
            letterSpacing: ".06em",
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}

// ── Status pill (Published / Draft / Archived) ─────────────────────────
export type DrillStatus = "published" | "draft" | "archived";

export function StatusPill({ status }: { status: DrillStatus }) {
  const map: Record<DrillStatus, { fg: string; label: string }> = {
    published: { fg: "var(--uff-lime)", label: "Published" },
    draft: { fg: "var(--uff-text-dim)", label: "Draft" },
    archived: { fg: "#FF4D4D", label: "Archived" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        color: s.fg,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: ".18em",
        textTransform: "uppercase",
      }}
    >
      {s.label}
    </span>
  );
}

// ── Category catalog mapped against the design's slug keys ─────────────
// DB stores category_name as "Route Running", "Flag Pulling", etc. We
// slugify on read so the design tokens line up.

export type CatSlug =
  | "offense"
  | "defense"
  | "scrimmage"
  | "warmup"
  | "conditioning"
  | "agilities"
  | "footwork"
  | "routes"
  | "throwing"
  | "catching"
  | "flagpulling"
  | "pursuit"
  | "rushing"
  | "blocking"
  | "other";

type CatDef = { label: string; color: string; tint: string; group: "phase" | "skill" };

export const WEB_CAT_DEFS: Record<CatSlug, CatDef> = {
  offense: { label: "Offense", color: "#FF6A1A", tint: "rgba(255,106,26,0.14)", group: "phase" },
  defense: { label: "Defense", color: "#FF4D4D", tint: "rgba(255,77,77,0.14)", group: "phase" },
  scrimmage: { label: "Scrimmage", color: "#7DDFD2", tint: "rgba(125,223,210,0.14)", group: "phase" },
  warmup: { label: "Warm-up", color: "#FFB347", tint: "rgba(255,179,71,0.14)", group: "phase" },
  conditioning: { label: "Conditioning", color: "#FFB3B3", tint: "rgba(255,179,179,0.14)", group: "phase" },
  agilities: { label: "Agilities", color: "#C2FF3D", tint: "rgba(194,255,61,0.14)", group: "phase" },
  footwork: { label: "Footwork", color: "#C2FF3D", tint: "rgba(194,255,61,0.14)", group: "skill" },
  routes: { label: "Routes", color: "#6EA8FF", tint: "rgba(110,168,255,0.14)", group: "skill" },
  throwing: { label: "Throwing", color: "#B89BFF", tint: "rgba(184,155,255,0.14)", group: "skill" },
  catching: { label: "Catching", color: "#FFB347", tint: "rgba(255,179,71,0.14)", group: "skill" },
  flagpulling: { label: "Flag pulling", color: "#FF6A8B", tint: "rgba(255,106,139,0.14)", group: "skill" },
  pursuit: { label: "Pursuit", color: "#FF4D4D", tint: "rgba(255,77,77,0.14)", group: "skill" },
  rushing: { label: "Rushing", color: "#FF6A1A", tint: "rgba(255,106,26,0.14)", group: "skill" },
  blocking: { label: "Blocking", color: "#7DDFD2", tint: "rgba(125,223,210,0.14)", group: "skill" },
  other: { label: "Other", color: "#9CA3AF", tint: "rgba(156,163,175,0.14)", group: "skill" },
};

export const PHASE_CATS: CatSlug[] = [
  "offense",
  "defense",
  "scrimmage",
  "warmup",
  "conditioning",
  "agilities",
];
export const SKILL_CATS: CatSlug[] = [
  "footwork",
  "routes",
  "throwing",
  "catching",
  "flagpulling",
  "pursuit",
  "rushing",
  "blocking",
  "other",
];

// Slugify a DB category_name into a CatSlug. Keeps a small alias table
// for the multi-word names that don't survive a naive slugify.
const CAT_ALIASES: Record<string, CatSlug> = {
  "route running": "routes",
  "flag pulling": "flagpulling",
  "warm up": "warmup",
};

export function categoryToSlug(name: string): CatSlug {
  const norm = name.trim().toLowerCase();
  if (CAT_ALIASES[norm]) return CAT_ALIASES[norm];
  // Strip spaces AND hyphens so "Warm-up" / "Warm up" / "Warmup" all → "warmup".
  const compact = norm.replace(/[\s-]+/g, "") as CatSlug;
  return (compact in WEB_CAT_DEFS ? compact : "other") as CatSlug;
}

export function CatPillWeb({ slug, mini }: { slug: CatSlug; mini?: boolean }) {
  const c = WEB_CAT_DEFS[slug];
  if (!c) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: mini ? "2px 7px" : "3px 9px",
        borderRadius: 4,
        background: c.tint,
        color: c.color,
        fontSize: mini ? 9.5 : 10,
        fontWeight: 700,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        lineHeight: 1.3,
      }}
    >
      {c.label}
    </span>
  );
}

// ── Trend chip ─────────────────────────────────────────────────────────
export function TrendChip({
  delta,
  better = "lower",
  mini,
}: {
  delta: number | null;
  better?: "lower" | "higher";
  mini?: boolean;
}) {
  if (delta == null || delta === 0) {
    return (
      <span
        style={{
          fontSize: mini ? 9.5 : 10.5,
          color: "var(--uff-text-mute)",
          fontFamily: "var(--font-mono)",
        }}
      >
        —
      </span>
    );
  }
  const positiveIsGood = better !== "lower";
  const good = positiveIsGood ? delta > 0 : delta < 0;
  const color = good ? "var(--uff-lime)" : "#FF4D4D";
  const arrow = delta > 0 ? "↑" : "↓";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--font-mono)",
        fontSize: mini ? 10.5 : 11.5,
        fontWeight: 600,
        color,
      }}
    >
      <span style={{ fontSize: mini ? 10 : 11 }}>{arrow}</span>
      {Math.abs(delta).toFixed(delta % 1 === 0 ? 0 : 2)}
    </span>
  );
}

// ── Sparkline ──────────────────────────────────────────────────────────
export function Spark({
  data,
  color = "var(--uff-orange)",
  w = 70,
  h = 22,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <span
        style={{
          fontSize: 10,
          color: "var(--uff-text-mute)",
          fontFamily: "var(--font-mono)",
        }}
      >
        —
      </span>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(0.001, max - min);
  const stepX = w / Math.max(1, data.length - 1);
  const yAt = (v: number) => h - 3 - ((v - min) / span) * (h - 6);
  const d = data
    .map((v, i) => `${i ? "L" : "M"}${(i * stepX).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(" ");
  const last = data[data.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) * stepX} cy={yAt(last)} r="2.4" fill={color} />
    </svg>
  );
}

// ── Drill badge — phase-colored monogram tile ──────────────────────────
// The 1–3 char monogram is derived from the drill name (see drillMonogram).
// Color is driven by the drill's PHASE category (offense, defense, etc.)
// — phase anchors the visual identity; skill cats stay in the pill column.

export function pickPhaseCat(cats: CatSlug[]): CatSlug {
  const phase = cats.find((c) => WEB_CAT_DEFS[c]?.group === "phase");
  return phase ?? cats[0] ?? "other";
}

export function drillMonogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "•";
  // Leading numeric token like "8-3 Shuttle" → "83"
  const numLead = trimmed.match(/^(\d+(?:-\d+)?)/);
  if (numLead) return numLead[1].replace(/-/g, "").slice(0, 3);
  const SKIP = new Set(["a", "an", "the", "of", "and", "to", "for", "with"]);
  const words = trimmed
    .split(/[\s\-_/]+/)
    .filter((w) => w.length > 0 && !SKIP.has(w.toLowerCase()));
  if (words.length === 0) return trimmed[0].toUpperCase();
  if (words.length === 1) {
    const w = words[0];
    return (w.length <= 3 ? w : w.slice(0, 2)).toUpperCase();
  }
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function DrillBadge({
  cat,
  name,
  size = 36,
}: {
  cat: CatSlug;
  name: string;
  size?: number;
}) {
  const def = WEB_CAT_DEFS[cat];
  const color = def?.color ?? "var(--uff-text-mute)";
  const tint = def?.tint ?? "rgba(255,255,255,0.04)";
  const text = drillMonogram(name);
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        background: tint,
        border: `1px solid ${color}40`,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        color,
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: size <= 36 ? 12.5 : 14,
        letterSpacing: text.length >= 3 ? "-0.04em" : "-0.02em",
        lineHeight: 1,
      }}
    >
      {text}
    </div>
  );
}
