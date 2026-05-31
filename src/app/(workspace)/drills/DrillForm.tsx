"use client";

// Drill form — /drills/new and /drills/[id]/edit (Web Build 4).
//
// Mirrors UFF Web Drills.html § Drill form: numbered section cards, a Y/N
// "Capture a score during practice?" gate, the six benchmark types as a
// multi-select grid, per-type pass-mark rows, a live right-rail preview
// (drill card + capture widgets), and the existing DiagramEditor kept as
// its own section so the drill builder doesn't lose coach setup tooling.
//
// Renders the full .uff-web shell (TeamSidebar + DashTopBar) so it slots
// in next to /dashboard/team/[id] and /drills without the legacy (app)
// chrome wrapping a second time.

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import DashTopBar from "@/components/dashboard/DashTopBar";
import TeamSidebar from "@/components/dashboard/TeamSidebar";
import SetupDiagramSection from "@/components/SetupDiagramSection";
import {
  BENCH_TYPES,
  BENCH_BY_ID,
  BenchIcon,
  BenchChip,
  StatusPill,
  WEB_CAT_DEFS,
  CatPillWeb,
  DrillBadge,
  pickPhaseCat,
  type BenchKind,
  type CatSlug,
  type DrillStatus,
} from "@/components/uff-web/drills/atoms";
import { generateSetupInstructions } from "@/lib/generate-setup-instructions";
import type { DiagramData } from "@/types/diagram";
import type { SidebarWorkspace } from "@/lib/dashboard/sidebar-workspaces";
import SkillPicker, {
  type SkillPickerValue,
} from "@/components/uff-web/drills/SkillPicker";
import { allowedSkillGroupsForPhases } from "@/lib/drills/skill-groups";
import type {
  DrillSkillLink,
  DrillSkillWeight,
  Skill,
  SkillGroup,
} from "@/lib/types/skills";

// ── Types ──────────────────────────────────────────────────────────────

type Category = {
  id: string;
  name: string;
  slug: CatSlug;
  type: "phase" | "skill";
};

type BenchConfigEntry = {
  target?: string;
  better?: "lower" | "higher";
};

type BenchConfig = Partial<Record<BenchKind, BenchConfigEntry>>;

export type DrillFormInitial = {
  id: string;
  drillName: string;
  description: string;
  sourceUrl: string;
  categoryIds: string[];
  // Tagged skills the drill develops. Empty for new drills + drills that
  // existed before build-10. Populated from drill_skills for clones of
  // preset drills and for drills that have been hand-tagged.
  skills: DrillSkillLink[];
  benchmarkTypes: BenchKind[];
  benchmarkConfig: BenchConfig;
  defaultDurationMin: number;
  defaultReps: number;
  otherEquipment: string[];
  notes: string[];
  status: Exclude<DrillStatus, "archived">;
  isDashboardPinned: boolean;
  setupDiagram: DiagramData | null;
  setupInstructions: string | null;
};

type Team = {
  id: string;
  name: string;
  color: string;
  leagueId: string | null;
};

type User = { firstName: string; lastName: string; initials: string };

type Props = {
  team: Team;
  user: User;
  categories: Category[];
  // Full skill taxonomy (25 rows). Fetched server-side and passed in so
  // the picker doesn't need to re-fetch on every form mount.
  skills: Skill[];
  initial?: DrillFormInitial;
  sidebarWorkspaces?: SidebarWorkspace[];
};

// ── Per-type default targets (used when a type is freshly toggled on) ──

const DEFAULT_TARGETS: Record<BenchKind, BenchConfigEntry> = {
  timed: { target: "4.6", better: "lower" },
  rated: { target: "4" },
  reps: { target: "8" },
  pct: { target: "75" },
  flags: { target: "3" },
  drops: { target: "0", better: "lower" },
};

const BENCH_BLURBS: Record<BenchKind, string> = {
  timed: "Stopwatch run. Players race the clock.",
  rated: "Coach grades form on a 1–5 anchored scale.",
  reps: "Counts clean reps inside a fixed window.",
  pct: "Made ÷ attempts. Captures completion accuracy.",
  flags: "Pulls counted on a defender during a rep.",
  drops: "Dropped catches inside the rep. Lower is better.",
};

const BENCH_SAMPLE: Record<BenchKind, string> = {
  timed: "4.6s",
  rated: "4.4 / 5",
  reps: "12 reps",
  pct: "78%",
  flags: "3 pulls",
  drops: "1 drop",
};

// ── Component ──────────────────────────────────────────────────────────

export default function DrillForm({ team, user, categories, skills, initial, sidebarWorkspaces }: Props) {
  const router = useRouter();
  const isEditing = !!initial;

  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("returnTo");
    if (r) setReturnTo(r);
  }, []);
  const buildReturnUrl = (addDrillId?: string) =>
    returnTo
      ? addDrillId
        ? `${returnTo}?addDrill=${encodeURIComponent(addDrillId)}`
        : returnTo
      : null;

  const phaseCats = useMemo(
    () => categories.filter((c) => c.type === "phase"),
    [categories],
  );
  // skillId → skill_group, for pruning out-of-scope skills on phase change.
  const skillGroupById = useMemo(() => {
    const m = new Map<string, SkillGroup>();
    for (const s of skills) m.set(s.id, s.skill_group);
    return m;
  }, [skills]);

  const [name, setName] = useState(initial?.drillName ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(() => {
    // Only phase categories are managed now — the Skill category axis was
    // retired in favor of the skill taxonomy. Strip any legacy skill-cat
    // links off an edited drill; they drop on the next save (Phase kept).
    const phaseIds = new Set(
      categories.filter((c) => c.type === "phase").map((c) => c.id),
    );
    return new Set(
      (initial?.categoryIds ?? []).filter((id) => phaseIds.has(id)),
    );
  });
  const [pickedSkills, setPickedSkills] = useState<SkillPickerValue>(
    () => {
      const m = new Map<string, DrillSkillWeight>();
      (initial?.skills ?? []).forEach((s) => m.set(s.skill_id, s.weight));
      return m;
    },
  );
  const [duration, setDuration] = useState<number>(
    initial?.defaultDurationMin ?? 10,
  );
  const [reps, setReps] = useState<number>(initial?.defaultReps ?? 5);
  const [otherEquipment, setOtherEquipment] = useState<string[]>(
    initial?.otherEquipment ?? [],
  );
  const [newEquipment, setNewEquipment] = useState("");
  const [notes, setNotes] = useState<string[]>(initial?.notes ?? []);
  const [newNote, setNewNote] = useState("");

  const [usesBench, setUsesBench] = useState<boolean>(
    (initial?.benchmarkTypes?.length ?? 0) > 0,
  );
  const [benchTypes, setBenchTypes] = useState<Set<BenchKind>>(
    new Set(initial?.benchmarkTypes ?? []),
  );
  const [benchConfig, setBenchConfig] = useState<BenchConfig>(
    initial?.benchmarkConfig ?? {},
  );

  const [status, setStatus] = useState<"draft" | "published">(
    initial?.status ?? "draft",
  );
  const [pinned, setPinned] = useState<boolean>(
    initial?.isDashboardPinned ?? false,
  );

  const [diagramData, setDiagramData] = useState<DiagramData | null>(
    initial?.setupDiagram ?? null,
  );
  const hasCones = !!diagramData && diagramData.cones.length > 0;
  const autoSetupInstructions = useMemo(
    () => (hasCones && diagramData ? generateSetupInstructions(diagramData) : ""),
    [diagramData, hasCones],
  );
  const initialAutoForExisting = useMemo(() => {
    if (!initial?.setupDiagram) return "";
    if (initial.setupDiagram.cones.length === 0) return "";
    return generateSetupInstructions(initial.setupDiagram);
  }, [initial]);
  const initialInstructions = initial?.setupInstructions ?? "";
  const [setupInstructionsOverride, setSetupInstructionsOverride] =
    useState<string | null>(
      initial && initialInstructions && initialInstructions !== initialAutoForExisting
        ? initialInstructions
        : null,
    );
  const setupInstructions =
    setupInstructionsOverride ?? autoSetupInstructions;
  const isInstructionsCustom = setupInstructionsOverride !== null;
  const coneCount =
    diagramData?.cones.filter((c) => (c.kind ?? "cone") === "cone").length ?? 0;

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleCat = (id: string) => {
    const n = new Set(selectedCatIds);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelectedCatIds(n);
    // Prune tagged skills whose group the new phase set no longer offers, so
    // an Offense drill can't keep Defense skills after a phase switch.
    const allowed = new Set(
      allowedSkillGroupsForPhases(
        categories.filter((c) => n.has(c.id)).map((c) => c.slug),
      ),
    );
    setPickedSkills((sw) => {
      let changed = false;
      const m = new Map(sw);
      for (const sid of Array.from(m.keys())) {
        const g = skillGroupById.get(sid);
        if (!g || !allowed.has(g)) {
          m.delete(sid);
          changed = true;
        }
      }
      return changed ? m : sw;
    });
  };
  const toggleBenchType = (id: BenchKind) =>
    setBenchTypes((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
        setBenchConfig((cfg) =>
          cfg[id] ? cfg : { ...cfg, [id]: { ...DEFAULT_TARGETS[id] } },
        );
      }
      return n;
    });
  const setBenchCfg = <K extends keyof BenchConfigEntry>(
    id: BenchKind,
    key: K,
    val: BenchConfigEntry[K],
  ) =>
    setBenchConfig((cfg) => ({
      ...cfg,
      [id]: { ...cfg[id], [key]: val },
    }));

  function addEquipment() {
    const trimmed = newEquipment.trim();
    if (!trimmed) return;
    setOtherEquipment((prev) =>
      prev.some((e) => e.toLowerCase() === trimmed.toLowerCase())
        ? prev
        : [...prev, trimmed],
    );
    setNewEquipment("");
  }
  const removeEquipment = (index: number) =>
    setOtherEquipment((prev) => prev.filter((_, i) => i !== index));

  function addNote() {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    setNotes((prev) => [...prev, trimmed]);
    setNewNote("");
  }
  const removeNote = (index: number) =>
    setNotes((prev) => prev.filter((_, i) => i !== index));
  const updateNote = (index: number, value: string) =>
    setNotes((prev) => prev.map((n, i) => (i === index ? value : n)));

  // Resolve a "primary" category — the first phase cat, else first selected.
  const selectedCatList = useMemo(
    () => categories.filter((c) => selectedCatIds.has(c.id)),
    [categories, selectedCatIds],
  );
  const primarySlug: CatSlug = useMemo(
    () => pickPhaseCat(selectedCatList.map((c) => c.slug)),
    [selectedCatList],
  );
  // Skill groups the picker may offer, derived from the chosen phase(s).
  const allowedGroups = useMemo(
    () => allowedSkillGroupsForPhases(selectedCatList.map((c) => c.slug)),
    [selectedCatList],
  );

  const nameReady = name.trim().length > 0;
  const catsReady = selectedCatIds.size > 0;
  const benchReady = !usesBench || benchTypes.size > 0;
  const canSubmit = nameReady && catsReady && benchReady && !submitting;

  // ── Save ─────────────────────────────────────────────────────────────

  async function save(targetStatus: "draft" | "published") {
    setError(null);
    if (!nameReady) {
      setError("Drill name is required.");
      return;
    }
    if (!catsReady) {
      setError("Pick at least one phase.");
      return;
    }
    if (usesBench && benchTypes.size === 0) {
      setError(
        "Pick at least one benchmark type, or toggle benchmarks off.",
      );
      return;
    }

    setSubmitting(true);

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      setError("You must be logged in.");
      setSubmitting(false);
      return;
    }

    const orderedCatIds = categories
      .filter((c) => selectedCatIds.has(c.id))
      .map((c) => c.id);
    const primaryCategoryId =
      // Prefer a phase category as primary if present.
      orderedCatIds.find((id) => {
        const c = categories.find((cc) => cc.id === id);
        return c?.type === "phase";
      }) ?? orderedCatIds[0];

    const types = Array.from(benchTypes);
    // Trim benchmark_config to only the selected types and to filled targets.
    const trimmedConfig: BenchConfig = {};
    for (const t of types) {
      const cfg = benchConfig[t] ?? DEFAULT_TARGETS[t];
      const entry: BenchConfigEntry = {};
      if (cfg?.target != null && String(cfg.target).trim() !== "") {
        entry.target = String(cfg.target).trim();
      }
      // Only persist `better` overrides for types where the design exposes a
      // direction toggle (timed / drops). Other types keep the catalog default.
      if ((t === "timed" || t === "drops") && cfg?.better) {
        entry.better = cfg.better;
      }
      trimmedConfig[t] = entry;
    }

    // Legacy single-string benchmark_type — keep populated for any read path
    // that hasn't migrated to benchmark_types[]. Falls back to the first of
    // timed/rated if the new types include them; otherwise null.
    const legacyBenchType =
      types.find((t) => t === "timed" || t === "rated") ?? null;

    const payload = {
      team_id: team.id,
      drill_name: name.trim(),
      category_id: primaryCategoryId,
      additional_category_ids: orderedCatIds,
      description: description.trim() || null,
      source_url: sourceUrl.trim() || null,
      benchmark_type: legacyBenchType,
      benchmark_types: usesBench ? types : [],
      benchmark_config: usesBench && types.length > 0 ? trimmedConfig : null,
      is_dashboard_pinned: pinned,
      dashboard_pinned_at:
        pinned && !initial?.isDashboardPinned ? new Date().toISOString() : null,
      default_duration_min: duration > 0 ? duration : null,
      default_reps: reps > 0 ? reps : null,
      status: targetStatus,
      equipment:
        coneCount > 0 || otherEquipment.length > 0
          ? { cones: coneCount, other: otherEquipment }
          : null,
      setup_diagram: hasCones ? diagramData : null,
      setup_instructions:
        setupInstructions && setupInstructions.trim()
          ? setupInstructions
          : null,
      notes: notes.map((n) => n.trim()).filter((n) => n.length > 0),
    };

    let drillId: string;

    if (isEditing && initial) {
      drillId = initial.id;
      const { error: updateErr } = await supabase
        .from("team_drills")
        .update(payload)
        .eq("id", drillId);
      if (updateErr) {
        setError(updateErr.message);
        setSubmitting(false);
        return;
      }
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("team_drills")
        .insert({ ...payload, created_by: authUser.id })
        .select("id")
        .single();
      if (insertErr || !inserted) {
        setError(insertErr?.message ?? "Failed to save drill.");
        setSubmitting(false);
        return;
      }
      drillId = inserted.id as string;
    }

    // Replace junction rows in one atomic-ish pair.
    const { error: delErr } = await supabase
      .from("team_drill_categories")
      .delete()
      .eq("drill_id", drillId);
    if (delErr) {
      setError(delErr.message);
      setSubmitting(false);
      return;
    }
    if (orderedCatIds.length > 0) {
      const { error: junctionErr } = await supabase
        .from("team_drill_categories")
        .insert(
          orderedCatIds.map((category_id) => ({ drill_id: drillId, category_id })),
        );
      if (junctionErr) {
        setError(junctionErr.message);
        setSubmitting(false);
        return;
      }
    }

    // Same replace pattern for drill_skills (delete-then-insert). The
    // picker holds the canonical state; we don't try to diff additions/
    // removals against initial.skills — full replace is simpler and the
    // table has 0–N rows per drill so the cost is negligible.
    const { error: skillsDelErr } = await supabase
      .from("drill_skills")
      .delete()
      .eq("drill_id", drillId);
    if (skillsDelErr) {
      setError(skillsDelErr.message);
      setSubmitting(false);
      return;
    }
    // Persist only skills whose group the chosen phase actually offers — the
    // guided-flow invariant (an Offense drill can't store Defense skills).
    const allowedSet = new Set(allowedGroups);
    const skillRows = Array.from(pickedSkills.entries())
      .filter(([skill_id]) => {
        const g = skillGroupById.get(skill_id);
        return g ? allowedSet.has(g) : false;
      })
      .map(([skill_id, weight]) => ({ drill_id: drillId, skill_id, weight }));
    if (skillRows.length > 0) {
      const { error: skillsInsErr } = await supabase
        .from("drill_skills")
        .insert(skillRows);
      if (skillsInsErr) {
        setError(skillsInsErr.message);
        setSubmitting(false);
        return;
      }
    }

    router.refresh();
    if (isEditing) {
      router.push(`/drills/${drillId}`);
    } else {
      const returnUrl = buildReturnUrl(
        targetStatus === "published" ? drillId : undefined,
      );
      router.push(returnUrl ?? `/drills/${drillId}`);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────

  const title = isEditing
    ? `Edit · ${name || initial?.drillName || "Drill"}`
    : "Build a drill";
  const statusLabel = isEditing
    ? status === "published"
      ? "PUBLISHED"
      : "DRAFT"
    : "CREATE";

  const backHref = returnTo
    ? buildReturnUrl() ?? "/drills"
    : isEditing && initial
      ? `/drills/${initial.id}`
      : "/drills";

  return (
    <div className="uff-web">
      <TeamSidebar
        active="drills"
        teamId={team.id}
        teamColor={team.color}
        teamName={team.name}
        leagueId={team.leagueId}
        user={{ firstName: user.firstName, lastName: user.lastName }}
        workspaces={sidebarWorkspaces}
      />

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          status={statusLabel}
          title={title}
          userInitials={user.initials}
          showSearch={false}
          actions={
            <>
              <Link href={backHref} className="wbtn ghost">
                Cancel
              </Link>
              <button
                type="button"
                className="wbtn"
                disabled={!canSubmit}
                onClick={() => save("draft")}
                style={{ opacity: canSubmit ? 1 : 0.5 }}
              >
                Save as draft
              </button>
              <button
                type="button"
                className="wbtn primary"
                disabled={!canSubmit}
                onClick={() => save("published")}
                style={{ opacity: canSubmit ? 1 : 0.5 }}
              >
                {isEditing ? "Save changes" : "Publish drill"}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </>
          }
        />

        <div
          className="page"
          style={{ maxWidth: 1180, margin: "0 auto", width: "100%" }}
        >
          <div className="drillform-grid">
            {/* LEFT — sectioned form */}
            <div
              className="w-card"
              style={{
                padding: 28,
                display: "flex",
                flexDirection: "column",
                gap: 28,
              }}
            >
              <Section
                num="01"
                label="Identity"
                hint="Players see the name in practice plans and benchmark logs."
              >
                <FormField label="Drill name">
                  <input
                    className="fr-input"
                    placeholder="e.g., Slant + Flat read"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </FormField>
                <FormField label="Description" optional="optional">
                  <textarea
                    className="fr-input"
                    style={{
                      height: 92,
                      padding: "12px 14px",
                      resize: "vertical",
                      fontFamily: "inherit",
                      lineHeight: 1.45,
                    }}
                    placeholder="One paragraph. What is the drill, what's the read, what does success look like?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </FormField>
                <FormField label="Source URL" optional="YouTube, blog, PDF">
                  <input
                    className="fr-input"
                    placeholder="https://…"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                  />
                </FormField>
              </Section>

              <Section
                num="02"
                label="Phase"
                hint="When this drill runs in practice. The phase anchors the drill's visual identity and sets which skill groups you can tag below."
              >
                <CatGroup
                  label=""
                  cats={phaseCats}
                  selected={selectedCatIds}
                  onToggle={toggleCat}
                />
              </Section>

              <Section
                num="03"
                label="Skill tags"
                hint="Which player skills does this drill develop? These power the team skill profile, the player dashboard, and recommended-drill suggestions. Pick at least one primary."
              >
                {allowedGroups.length === 0 ? (
                  <div
                    style={{
                      border: "1px dashed var(--uff-line)",
                      borderRadius: 8,
                      padding: "16px 14px",
                      textAlign: "center",
                      color: "var(--uff-text-mute)",
                      fontSize: 12.5,
                      lineHeight: 1.5,
                    }}
                  >
                    Pick a phase above first — the skills you can tag depend on
                    where the drill runs.
                  </div>
                ) : (
                  <SkillPicker
                    skills={skills}
                    value={pickedSkills}
                    onChange={setPickedSkills}
                    groups={allowedGroups}
                  />
                )}
              </Section>

              <Section
                num="04"
                label="Benchmarks"
                hint="Pick the metrics coaches will capture during practice. One drill can capture multiple types per rep."
              >
                <BenchGate on={usesBench} onChange={setUsesBench} />

                {usesBench && (
                  <>
                    <BenchTypeGrid
                      selected={benchTypes}
                      onToggle={toggleBenchType}
                    />

                    {benchTypes.size > 0 ? (
                      <BenchTargetsBlock
                        selected={Array.from(benchTypes)}
                        config={benchConfig}
                        onChange={setBenchCfg}
                      />
                    ) : (
                      <div
                        style={{
                          padding: "14px 16px",
                          background: "rgba(255,77,77,0.05)",
                          border: "1px solid rgba(255,77,77,0.18)",
                          borderRadius: 12,
                          color: "var(--uff-text)",
                          fontSize: 12.5,
                          lineHeight: 1.5,
                        }}
                      >
                        Pick at least one type, or toggle benchmarks off to
                        run this as a coaching-only drill.
                      </div>
                    )}
                  </>
                )}
              </Section>

              <Section
                num="05"
                label="Setup diagram"
                hint="Drag cones onto the field. Movement segments auto-fill the setup instructions below."
              >
                <SetupDiagramSection
                  value={diagramData}
                  onChange={setDiagramData}
                  catColor={WEB_CAT_DEFS[primarySlug]?.color ?? "var(--uff-orange)"}
                />
                {(hasCones || isInstructionsCustom) && (
                  <FormField
                    label={
                      isInstructionsCustom
                        ? "Setup instructions"
                        : "Setup instructions (auto-generated)"
                    }
                    right={
                      isInstructionsCustom ? (
                        <button
                          type="button"
                          onClick={() => setSetupInstructionsOverride(null)}
                          style={{
                            background: "transparent",
                            border: 0,
                            color: "var(--uff-text)",
                            fontFamily: "inherit",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          Reset to auto
                        </button>
                      ) : undefined
                    }
                  >
                    <textarea
                      className="fr-input"
                      value={setupInstructions}
                      onChange={(e) =>
                        setSetupInstructionsOverride(e.target.value)
                      }
                      rows={3}
                      style={{
                        height: "auto",
                        minHeight: 72,
                        padding: "12px 14px",
                        resize: "vertical",
                        fontFamily: "inherit",
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                      }}
                    />
                  </FormField>
                )}
              </Section>

              <Section
                num="06"
                label="Drill notes"
                hint="Coaching cues, common mistakes, or anything you want to remember about running this drill. Each line is its own note."
              >
                <NotesList
                  items={notes}
                  onUpdate={updateNote}
                  onRemove={removeNote}
                  value={newNote}
                  onValueChange={setNewNote}
                  onAdd={addNote}
                />
              </Section>

              <Section
                num="07"
                label="Block timing & equipment"
                hint="Defaults the planner uses when this drill gets added to a practice. Cones come from the diagram above; add anything extra below."
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  }}
                >
                  <FormField label="Default duration" rightMeta={`${duration} min`}>
                    <Stepper
                      value={duration}
                      onChange={setDuration}
                      min={1}
                      max={60}
                      suffix="min"
                    />
                  </FormField>
                  <FormField label="Default reps" rightMeta={`${reps} reps`}>
                    <Stepper
                      value={reps}
                      onChange={setReps}
                      min={1}
                      max={20}
                      suffix="reps"
                    />
                  </FormField>
                </div>

                <FormField label="Equipment" optional="cones counted from diagram">
                  <EquipmentList
                    coneCount={coneCount}
                    items={otherEquipment}
                    onRemove={removeEquipment}
                    value={newEquipment}
                    onValueChange={setNewEquipment}
                    onAdd={addEquipment}
                  />
                </FormField>
              </Section>

              <Section
                num="08"
                label="Visibility"
                hint="Drafts stay hidden from the practice planner. Pinned drills surface on the team dashboard."
              >
                <div
                  className="fr-seg"
                  style={{ gridTemplateColumns: "1fr 1fr" }}
                >
                  {(["published", "draft"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={status === s ? "on" : ""}
                      onClick={() => setStatus(s)}
                      style={
                        status === s
                          ? {
                              background:
                                s === "published"
                                  ? "var(--uff-lime)"
                                  : "var(--uff-orange)",
                              color: "#0a0a0d",
                            }
                          : undefined
                      }
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background:
                            s === "published"
                              ? "var(--uff-lime)"
                              : "var(--uff-text)",
                          marginRight: 6,
                          display: "inline-block",
                          opacity: status === s ? 0 : 1,
                        }}
                      />
                      {s[0].toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <PinToggle on={pinned} onChange={setPinned} />
              </Section>

              {error && (
                <div
                  style={{
                    padding: "12px 14px",
                    background: "rgba(255,77,77,0.08)",
                    border: "1px solid rgba(255,77,77,0.28)",
                    borderRadius: 10,
                    color: "#FF8A8A",
                    fontSize: 12.5,
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </div>
              )}
            </div>

            {/* RIGHT — live preview rail (only at xl+, where there's room) */}
            <aside className="drillform-rail">
              <DrillFormPreview
                name={name}
                duration={duration}
                reps={reps}
                cats={selectedCatList.map((c) => c.slug)}
                primarySlug={primarySlug}
                types={Array.from(benchTypes)}
                status={status}
                pinned={pinned}
              />
              {usesBench && benchTypes.size > 0 && (
                <CaptureWidgetPreview
                  types={Array.from(benchTypes)}
                  config={benchConfig}
                />
              )}
              <FormHelpCard />
            </aside>
          </div>
        </div>
      </div>

      {/* Local responsive rules: stack the rail beneath the form below xl. */}
      <style jsx>{`
        .drillform-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        .drillform-rail {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        @media (min-width: 1180px) {
          .drillform-grid {
            grid-template-columns: minmax(0, 720px) 360px;
          }
          .drillform-rail {
            position: sticky;
            top: 84px;
          }
        }
      `}</style>
    </div>
  );
}

// ── Section + Field wrappers ───────────────────────────────────────────

function Section({
  num,
  label,
  hint,
  children,
}: {
  num: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--uff-lime)",
            letterSpacing: ".08em",
            fontWeight: 700,
          }}
        >
          {num}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--uff-orange)",
            letterSpacing: ".01em",
          }}
        >
          {label}
        </span>
      </div>
      {hint && (
        <div
          style={{
            fontSize: 12,
            color: "var(--uff-text)",
            lineHeight: 1.5,
            paddingLeft: 28,
          }}
        >
          {hint}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function FormField({
  label,
  optional,
  rightMeta,
  right,
  children,
}: {
  label: string;
  optional?: string;
  rightMeta?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: "var(--uff-text)",
          }}
        >
          {label}
        </span>
        {optional && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: ".08em",
              color: "var(--uff-text)",
            }}
          >
            · {optional}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {rightMeta && (
          <span
            style={{
              fontSize: 10.5,
              color: "var(--uff-text)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {rightMeta}
          </span>
        )}
        {right}
      </div>
      {children}
    </div>
  );
}

// ── Category picker ────────────────────────────────────────────────────

function CatGroup({
  label,
  cats,
  selected,
  onToggle,
}: {
  label: string;
  cats: Category[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      {label ? (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".18em",
            color: "var(--uff-text)",
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {cats.map((c) => {
          const def = WEB_CAT_DEFS[c.slug];
          const on = selected.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              aria-pressed={on}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 11px",
                borderRadius: 999,
                background: on ? def.tint : "var(--uff-surface-2)",
                border: `1px solid ${on ? def.color : "var(--uff-line)"}`,
                color: on ? def.color : "var(--uff-text)",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 120ms ease, border-color 120ms ease",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  background: def.color,
                  flexShrink: 0,
                }}
              />
              {def.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Benchmark gate (Y/N) ───────────────────────────────────────────────

function BenchGate({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: on
          ? "linear-gradient(180deg, rgba(255,106,26,0.06) 0%, transparent 80%), var(--uff-surface-2)"
          : "var(--uff-surface-2)",
        border: `1.5px solid ${on ? "var(--uff-orange)" : "var(--uff-line)"}`,
        borderRadius: 12,
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        color: "var(--uff-text)",
      }}
    >
      <span
        style={{
          width: 44,
          height: 26,
          borderRadius: 999,
          background: on ? "var(--uff-orange)" : "var(--uff-line)",
          position: "relative",
          flexShrink: 0,
          transition: "background 140ms ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: on ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#0a0a0d",
            transition: "left 140ms ease",
          }}
        />
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--uff-text)",
          }}
        >
          Capture a score during practice?
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--uff-text)",
            marginTop: 3,
            lineHeight: 1.5,
          }}
        >
          {on
            ? "Coaches will be asked to mark each player on the metrics you pick below."
            : "Coaching-only drill. No numbers logged — appears in practice plans but not benchmarks."}
        </div>
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".16em",
          color: on ? "var(--uff-orange)" : "var(--uff-text)",
        }}
      >
        {on ? "YES" : "NO"}
      </span>
    </button>
  );
}

// ── 6-type multi-select grid ───────────────────────────────────────────

function BenchTypeGrid({
  selected,
  onToggle,
}: {
  selected: Set<BenchKind>;
  onToggle: (id: BenchKind) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 10,
      }}
    >
      {BENCH_TYPES.map((t) => {
        const on = selected.has(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onToggle(t.id)}
            aria-pressed={on}
            style={{
              textAlign: "left",
              background: on
                ? `linear-gradient(180deg, ${t.tint} 0%, transparent 80%), var(--uff-surface-2)`
                : "var(--uff-surface-2)",
              border: `1.5px solid ${on ? t.border : "var(--uff-line)"}`,
              borderRadius: 12,
              padding: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              color: "var(--uff-text)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 116,
              transition:
                "border-color 120ms ease, background 120ms ease",
              position: "relative",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: on ? t.accent : "rgba(255,255,255,0.04)",
                  color: on ? "#0a0a0d" : t.accent,
                  border: on ? "none" : `1px solid ${t.border}`,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <BenchIcon
                  kind={t.id}
                  size={15}
                  color={on ? "#0a0a0d" : t.accent}
                />
              </div>
              <span style={{ flex: 1 }} />
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: on ? t.accent : "transparent",
                  border: on ? "none" : "1.5px solid var(--uff-line)",
                  display: "grid",
                  placeItems: "center",
                  color: "#0a0a0d",
                }}
              >
                {on && (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 12l5 5L20 6" />
                  </svg>
                )}
              </div>
            </div>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                letterSpacing: "-0.005em",
              }}
            >
              {t.label}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--uff-text)",
                lineHeight: 1.45,
              }}
            >
              {BENCH_BLURBS[t.id]}
            </div>
            <span
              style={{
                position: "absolute",
                top: 14,
                right: 42,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: on ? t.accent : "var(--uff-text)",
                letterSpacing: ".06em",
              }}
            >
              {BENCH_SAMPLE[t.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Pass-mark inputs per selected type ─────────────────────────────────

function BenchTargetsBlock({
  selected,
  config,
  onChange,
}: {
  selected: BenchKind[];
  config: BenchConfig;
  onChange: <K extends keyof BenchConfigEntry>(
    id: BenchKind,
    key: K,
    val: BenchConfigEntry[K],
  ) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".18em",
          color: "var(--uff-text)",
          marginBottom: 2,
        }}
      >
        PASS MARK · per type
      </div>
      {selected.map((id) => {
        const t = BENCH_BY_ID[id];
        const cfg = config[id] ?? {};
        const better = cfg.better ?? t.better;
        return (
          <div
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              background: "var(--uff-surface-2)",
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              flexWrap: "wrap",
            }}
          >
            <BenchChip id={id} mini />
            <span style={{ fontSize: 12, color: "var(--uff-text)" }}>
              {better === "lower"
                ? "Player passes if ≤"
                : "Player passes if ≥"}
            </span>
            <input
              value={cfg.target ?? ""}
              onChange={(e) => onChange(id, "target", e.target.value)}
              style={{
                width: 64,
                height: 30,
                background: "var(--uff-surface)",
                border: "1px solid var(--uff-line)",
                borderRadius: 8,
                color: t.accent,
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: 14,
                textAlign: "right",
                padding: "0 8px",
                outline: "none",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--uff-text)",
              }}
            >
              {t.unit}
            </span>
            {(id === "timed" || id === "drops") && (
              <button
                type="button"
                onClick={() =>
                  onChange(
                    id,
                    "better",
                    better === "lower" ? "higher" : "lower",
                  )
                }
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  border: "1px solid var(--uff-line)",
                  borderRadius: 999,
                  padding: "4px 10px",
                  color: "var(--uff-text)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {better} is better
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Pin toggle ─────────────────────────────────────────────────────────

function PinToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
        background: "var(--uff-surface-2)",
        border: `1px solid ${on ? "rgba(255,106,26,0.32)" : "var(--uff-line)"}`,
        borderRadius: 12,
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        color: "var(--uff-text)",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: on ? "var(--uff-orange)" : "transparent",
          border: on ? "none" : "1.5px solid var(--uff-line)",
          display: "grid",
          placeItems: "center",
          color: "#0a0a0d",
          flexShrink: 0,
        }}
      >
        {on && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12l5 5L20 6" />
          </svg>
        )}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          Pin to team dashboard
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--uff-text)",
            marginTop: 2,
          }}
        >
          Surfaces this drill in the &ldquo;Pinned pulses&rdquo; widget on
          every coach&rsquo;s dashboard.
        </div>
      </div>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={on ? "var(--uff-orange)" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          color: on ? "var(--uff-orange)" : "var(--uff-text)",
        }}
      >
        <path d="M14 4l6 6-4 1-3 6-2-2-5 5-1-1 5-5-2-2 6-3z" />
      </svg>
    </button>
  );
}

// ── Stepper ────────────────────────────────────────────────────────────

function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line)",
        borderRadius: 10,
        height: 44,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        style={{
          width: 44,
          background: "transparent",
          border: 0,
          color: "var(--uff-text)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
        }}
        aria-label="Decrease"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M5 12h14" />
        </svg>
      </button>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "center",
          gap: 5,
          borderLeft: "1px solid var(--uff-line)",
          borderRight: "1px solid var(--uff-line)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <input
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value || "0", 10);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          style={{
            width: 50,
            textAlign: "right",
            background: "transparent",
            border: 0,
            outline: 0,
            color: "var(--uff-text)",
            fontFamily: "var(--font-mono)",
            fontSize: 18,
            fontWeight: 700,
          }}
        />
        {suffix && (
          <span
            style={{ fontSize: 11.5, color: "var(--uff-text)" }}
          >
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        style={{
          width: 44,
          background: "transparent",
          border: 0,
          color: "var(--uff-text)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
        }}
        aria-label="Increase"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

// ── Equipment list ─────────────────────────────────────────────────────

function EquipmentList({
  coneCount,
  items,
  onRemove,
  value,
  onValueChange,
  onAdd,
}: {
  coneCount: number;
  items: string[];
  onRemove: (i: number) => void;
  value: string;
  onValueChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line)",
        borderRadius: 10,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--uff-text)" }}>Cones</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 600,
            color:
              coneCount > 0
                ? "var(--uff-text)"
                : "var(--uff-text)",
          }}
        >
          {coneCount}
        </span>
      </div>
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "var(--uff-surface)",
                border: "1px solid var(--uff-line-soft)",
                borderRadius: 8,
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "var(--uff-text)",
                }}
              >
                {item}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${item}`}
                style={{
                  width: 28,
                  height: 28,
                  background: "transparent",
                  border: 0,
                  color: "var(--uff-text)",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="fr-input"
          style={{ flex: 1, height: 38 }}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="e.g., agility ladder"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!value.trim()}
          className="wbtn"
          style={{
            height: 38,
            opacity: value.trim() ? 1 : 0.4,
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Drill notes list ───────────────────────────────────────────────────

function NotesList({
  items,
  onUpdate,
  onRemove,
  value,
  onValueChange,
  onAdd,
}: {
  items: string[];
  onUpdate: (i: number, value: string) => void;
  onRemove: (i: number) => void;
  value: string;
  onValueChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line)",
        borderRadius: 10,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px 6px 12px",
                background: "var(--uff-surface)",
                border: "1px solid var(--uff-line-soft)",
                borderRadius: 8,
              }}
            >
              <input
                className="fr-input"
                value={item}
                onChange={(e) => onUpdate(index, e.target.value)}
                style={{
                  flex: 1,
                  height: 32,
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  fontSize: 13,
                  color: "var(--uff-text)",
                }}
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label="Remove note"
                style={{
                  width: 28,
                  height: 28,
                  background: "transparent",
                  border: 0,
                  color: "var(--uff-text)",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="fr-input"
          style={{ flex: 1, height: 38 }}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="e.g., emphasize hip rotation on the snap"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!value.trim()}
          className="wbtn"
          style={{
            height: 38,
            opacity: value.trim() ? 1 : 0.4,
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Right rail: live drill card preview ────────────────────────────────

function DrillFormPreview({
  name,
  duration,
  reps,
  cats,
  primarySlug,
  types,
  status,
  pinned,
}: {
  name: string;
  duration: number;
  reps: number;
  cats: CatSlug[];
  primarySlug: CatSlug;
  types: BenchKind[];
  status: "draft" | "published";
  pinned: boolean;
}) {
  const accent = WEB_CAT_DEFS[primarySlug]?.color ?? "var(--uff-orange)";
  return (
    <div
      className="w-card"
      style={{
        padding: 0,
        overflow: "hidden",
        borderTop: `2px solid ${accent}`,
      }}
    >
      <div
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
            color: "var(--uff-text-mute)",
          }}
        >
          LIVE PREVIEW
        </div>

        <div
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          <DrillBadge cat={primarySlug} name={name || "•"} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "-0.005em",
                color: name ? "var(--uff-text)" : "var(--uff-text-mute)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
              }}
            >
              {name || "Your drill name"}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--uff-text-mute)",
                marginTop: 4,
                letterSpacing: ".04em",
              }}
            >
              {duration}m · {reps} reps
            </div>
          </div>
          {pinned && (
            <span
              style={{ color: "var(--uff-orange)" }}
              title="Pinned to dashboard"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M14 4l6 6-4 1-3 6-2-2-5 5-1-1 5-5-2-2 6-3z" />
              </svg>
            </span>
          )}
        </div>

        {cats.length > 0 && (
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
          >
            {cats.map((c) => (
              <CatPillWeb key={c} slug={c} mini />
            ))}
          </div>
        )}

        <div
          style={{
            padding: 12,
            background: "var(--uff-surface-2)",
            borderRadius: 10,
            border: "1px solid var(--uff-line-soft)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <KVRow k="Status" v={<StatusPill status={status} />} />
          <KVRow
            k="Benchmarks"
            v={
              types.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    justifyContent: "flex-end",
                  }}
                >
                  {types.map((id) => (
                    <BenchChip key={id} id={id} mini />
                  ))}
                </div>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--uff-text-mute)",
                  }}
                >
                  None — coaching only
                </span>
              )
            }
          />
          <KVRow
            k="Dashboard"
            v={
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: pinned
                    ? "var(--uff-orange)"
                    : "var(--uff-text-mute)",
                }}
              >
                {pinned ? "Pinned" : "Not pinned"}
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}

function KVRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
          textTransform: "uppercase",
        }}
      >
        {k}
      </span>
      <span>{v}</span>
    </div>
  );
}

// ── Right rail: capture-widget preview (what coaches see) ──────────────

function CaptureWidgetPreview({
  types,
  config,
}: {
  types: BenchKind[];
  config: BenchConfig;
}) {
  return (
    <div
      className="w-card"
      style={{
        padding: 0,
        overflow: "hidden",
        borderTop: "2px solid var(--uff-orange)",
      }}
    >
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
          WHAT COACHES SEE · CAPTURE
        </div>
        <span
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#FF4D4D",
              boxShadow: "0 0 0 2px rgba(255, 77, 77, 0.25)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--uff-text)",
              letterSpacing: ".1em",
            }}
          >
            PREVIEW
          </span>
        </span>
      </div>

      <div
        style={{
          padding: "16px 16px 18px",
          background:
            "radial-gradient(120% 80% at 100% 0%, rgba(255,106,26,0.06) 0%, transparent 60%), var(--uff-surface-2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            background: "var(--uff-surface)",
            border: "1px solid var(--uff-line-soft)",
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "#FF6A1A",
              color: "#1a0f08",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 11,
            }}
          >
            MR
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>
              Marcus Rivera
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                color: "var(--uff-text)",
              }}
            >
              #7 · QB · REP 1 OF 3
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              color: "var(--uff-text)",
              letterSpacing: ".08em",
            }}
          >
            1/12
          </span>
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {types.map((id) => (
            <CaptureWidget key={id} id={id} cfg={config[id] ?? {}} />
          ))}
        </div>

        <button
          type="button"
          style={{
            marginTop: 14,
            width: "100%",
            height: 36,
            borderRadius: 10,
            background: "var(--uff-orange)",
            color: "#1a0f08",
            border: 0,
            fontFamily: "inherit",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          Save rep
        </button>
      </div>
    </div>
  );
}

function CaptureWidget({
  id,
  cfg,
}: {
  id: BenchKind;
  cfg: BenchConfigEntry;
}) {
  const t = BENCH_BY_ID[id];
  return (
    <div
      style={{
        padding: 12,
        background: "var(--uff-surface)",
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <BenchChip id={id} mini />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            color: "var(--uff-text)",
          }}
        >
          target {cfg.target ?? "—"}
          {t.unit}
        </span>
      </div>
      {id === "timed" && <TimedWidget t={t} />}
      {id === "rated" && <RatedWidget t={t} />}
      {id === "reps" && <RepsWidget t={t} cfg={cfg} />}
      {id === "pct" && <PctWidget t={t} />}
      {id === "flags" && <CounterWidget t={t} verb="pulls" initial={3} />}
      {id === "drops" && <CounterWidget t={t} verb="drops" initial={1} />}
    </div>
  );
}

function TimedWidget({ t }: { t: (typeof BENCH_TYPES)[number] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: t.accent,
          color: "#0a0a0d",
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 5l13 7-13 7V5z" />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--uff-text)",
            letterSpacing: "-0.02em",
          }}
        >
          4.36
          <span
            style={{
              fontSize: 12,
              color: "var(--uff-text)",
              marginLeft: 3,
            }}
          >
            {t.unit}
          </span>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: "var(--uff-line)",
            overflow: "hidden",
            marginTop: 5,
          }}
        >
          <div
            style={{
              width: "70%",
              height: "100%",
              background: t.accent,
              opacity: 0.8,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function RatedWidget({ t }: { t: (typeof BENCH_TYPES)[number] }) {
  const v = 4;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 9,
            background: n <= v ? t.tint : "var(--uff-surface-2)",
            border: `1px solid ${n <= v ? t.border : "var(--uff-line)"}`,
            color: n <= v ? t.accent : "var(--uff-text)",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 13,
            display: "grid",
            placeItems: "center",
          }}
        >
          {n <= v ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
            </svg>
          ) : (
            n
          )}
        </div>
      ))}
    </div>
  );
}

function RepsWidget({
  t,
  cfg,
}: {
  t: (typeof BENCH_TYPES)[number];
  cfg: BenchConfigEntry;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <StaticCounter
        value={parseInt(cfg.target || "8", 10) || 8}
        accent={t.accent}
      />
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 10.5,
          color: "var(--uff-text)",
          fontFamily: "var(--font-mono)",
        }}
      >
        clean reps
      </span>
    </div>
  );
}

function PctWidget({ t }: { t: (typeof BENCH_TYPES)[number] }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            color: "var(--uff-text)",
            letterSpacing: ".12em",
            fontWeight: 700,
          }}
        >
          MADE
        </span>
        <StaticCounter value={7} accent={t.accent} />
      </div>
      <span
        style={{
          fontSize: 22,
          color: "var(--uff-text)",
          fontFamily: "var(--font-mono)",
          alignSelf: "flex-end",
          paddingBottom: 4,
        }}
      >
        /
      </span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            color: "var(--uff-text)",
            letterSpacing: ".12em",
            fontWeight: 700,
          }}
        >
          ATTEMPTS
        </span>
        <StaticCounter value={9} accent="var(--uff-text)" />
      </div>
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 16,
          fontWeight: 700,
          color: t.accent,
        }}
      >
        78
        <span style={{ fontSize: 10, color: "var(--uff-text)" }}>
          %
        </span>
      </span>
    </div>
  );
}

function CounterWidget({
  t,
  verb,
  initial,
}: {
  t: (typeof BENCH_TYPES)[number];
  verb: string;
  initial: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <StaticCounter value={initial} accent={t.accent} />
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 10.5,
          color: "var(--uff-text)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {verb}
      </span>
    </div>
  );
}

function StaticCounter({
  value,
  accent,
}: {
  value: number;
  accent: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 32,
        borderRadius: 9,
        background: "var(--uff-surface-2)",
        border: "1px solid var(--uff-line)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 28,
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: "var(--uff-text)",
        }}
      >
        −
      </div>
      <span
        style={{
          minWidth: 32,
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: 15,
          color: accent,
          borderLeft: "1px solid var(--uff-line)",
          borderRight: "1px solid var(--uff-line)",
          padding: "0 4px",
        }}
      >
        {value}
      </span>
      <div
        style={{
          width: 28,
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: "var(--uff-text)",
        }}
      >
        +
      </div>
    </div>
  );
}

// ── Right rail: contextual help ────────────────────────────────────────

function FormHelpCard() {
  return (
    <div className="w-card subdued" style={{ padding: 18 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".18em",
          color: "var(--uff-text)",
          marginBottom: 10,
        }}
      >
        HOW BENCHMARKS WORK
      </div>
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 9,
        }}
      >
        <HelpItem n={1}>
          One drill can capture multiple types per rep — a 5-10-5 might log{" "}
          <strong style={{ color: "var(--uff-text)" }}>Timed</strong> +{" "}
          <strong style={{ color: "var(--uff-text)" }}>Reps</strong>.
        </HelpItem>
        <HelpItem n={2}>
          The pass mark is per-type. Below it a player &ldquo;passes&rdquo;
          — above means &ldquo;needs work&rdquo; (or reversed for
          &ldquo;lower is better&rdquo; types).
        </HelpItem>
        <HelpItem n={3}>
          Coaching-only drills don&rsquo;t capture numbers but still appear
          in the practice planner with their cues and setup.
        </HelpItem>
        <HelpItem n={4}>
          Switch off a type later to stop capturing it. Old benchmarks stay
          readable; the type just doesn&rsquo;t appear in new sessions.
        </HelpItem>
      </ol>
    </div>
  );
}

function HelpItem({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "rgba(255, 106, 26, 0.14)",
          color: "var(--uff-orange)",
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          fontWeight: 700,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {n}
      </span>
      <span
        style={{
          fontSize: 12,
          color: "var(--uff-text)",
          lineHeight: 1.6,
        }}
      >
        {children}
      </span>
    </li>
  );
}
