// Hand-written types for the skill taxonomy + preset drill library.
//
// There are no auto-generated Supabase types in this project — these
// stubs mirror the columns defined in migration 66_skill_taxonomy_schema.sql.
// Keep in sync with the SQL: if a column is added there, add the field here.

import type { BenchKind } from "@/components/uff-web/drills/atoms";

// ── Skill ─────────────────────────────────────────────────────────────

// The five groups map onto the radar-chart spokes on the future dashboard.
// IQ skills are coach-rated only (no objective benchmark drill); the
// is_benchmarkable / is_ratable flags on the skill row carry the truth.
export type SkillGroup = "athletic" | "offense" | "qb" | "defense" | "iq";

export type Skill = {
  id: string;
  slug: string;
  skill_name: string;
  skill_group: SkillGroup;
  description: string;
  display_order: number;
  is_benchmarkable: boolean;
  is_ratable: boolean;
};

// ── Skill tag (quick-tap chip per skill) ──────────────────────────────

export type SkillTag = {
  id: string;
  skill_id: string;
  label: string;
  display_order: number;
  is_active: boolean;
};

// ── Drill ↔ Skill junction (weight 1.0 = primary, 0.5 = secondary) ────

export type DrillSkillWeight = 1.0 | 0.5;

export type DrillSkillLink = {
  skill_id: string;
  weight: DrillSkillWeight;
};

// Used wherever we render a drill with its tagged skills (preset cards,
// team drill detail, the skill picker). Inlines the joined skill row so
// consumers don't need a second lookup.
export type TaggedSkill = Skill & { weight: DrillSkillWeight };

// ── Preset drill ──────────────────────────────────────────────────────

// Mirrors public.preset_drills exactly. equipment + benchmark_config are
// jsonb in the DB — we leave them as `unknown` until a consumer needs to
// reach into them (then narrow at the boundary).
export type PresetDrill = {
  id: string;
  slug: string;
  drill_name: string;
  description: string;
  category_type: string;
  default_reps: number | null;
  default_duration_min: number | null;
  benchmark_types: BenchKind[];
  benchmark_config: unknown;
  setup_diagram: unknown;
  setup_instructions: string | null;
  equipment: unknown;
  source_url: string | null;
  formats: string[]; // ('5v5' | '7v7') — string[] so we can filter without narrowing
  primary_for_positions: string[];
  display_order: number;
  is_active: boolean;
};

// Hydrated shape returned by loadPresetLibrary — adds skill tags and a
// "has this team already cloned this preset?" hint so the card can show
// either "Add to my team" or "Already in your library →".
export type PresetDrillWithSkills = PresetDrill & {
  skills: TaggedSkill[];
  alreadyCloned: boolean;
  clonedDrillId: string | null;
};
