"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import DiagramEditor from "@/components/DiagramEditor";
import { generateSetupInstructions } from "@/lib/generate-setup-instructions";
import type { DiagramData } from "@/types/diagram";

type Category = { id: string; name: string };

type BenchmarkOption = "None" | "Timed" | "Rated";

const BENCHMARK_OPTIONS: BenchmarkOption[] = ["None", "Timed", "Rated"];

export type DrillFormInitial = {
  id: string;
  drillName: string;
  categoryId: string | null;
  additionalCategoryIds: string[];
  description: string;
  sourceUrl: string;
  benchmarkType: "timed" | "rated" | null;
  status: "draft" | "published";
  setupDiagram: DiagramData | null;
  setupInstructions: string | null;
  otherEquipment: string[];
};

type Props = {
  teamId: string;
  categories: Category[];
  initial?: DrillFormInitial;
};

export default function DrillForm({ teamId, categories, initial }: Props) {
  const router = useRouter();
  const isEditing = !!initial;

  // When the user lands here via the practice planner ("+ New drill"), the URL
  // carries `returnTo` (the practice page). On exit — publish, draft, or back —
  // route back to that page; only publish appends the new drill via addDrill.
  // Practice form state is preserved separately via sessionStorage on the
  // practice form itself.
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("returnTo");
    if (r) setReturnTo(r);
  }, []);

  function buildReturnUrl(addDrillId?: string) {
    if (!returnTo) return null;
    return addDrillId
      ? `${returnTo}?addDrill=${encodeURIComponent(addDrillId)}`
      : returnTo;
  }

  const otherCategory = useMemo(
    () => categories.find((c) => c.name.toLowerCase() === "other") ?? null,
    [categories]
  );

  const [drillName, setDrillName] = useState(initial?.drillName ?? "");
  const initialCategoryIds = useMemo<string[]>(() => {
    if (initial) {
      const set = new Set<string>();
      if (initial.categoryId) set.add(initial.categoryId);
      for (const id of initial.additionalCategoryIds ?? []) set.add(id);
      return Array.from(set);
    }
    return categories[0]?.id ? [categories[0].id] : [];
  }, [initial, categories]);
  const [selectedCategoryIds, setSelectedCategoryIds] =
    useState<string[]>(initialCategoryIds);
  const [newCategoryName, setNewCategoryName] = useState("");
  const isOtherSelected =
    !!otherCategory && selectedCategoryIds.includes(otherCategory.id);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [benchmarkType, setBenchmarkType] = useState<BenchmarkOption>(
    initial?.benchmarkType
      ? ((initial.benchmarkType[0].toUpperCase() +
          initial.benchmarkType.slice(1)) as BenchmarkOption)
      : "None"
  );
  const [diagramData, setDiagramData] = useState<DiagramData | null>(
    initial?.setupDiagram ?? null
  );

  const hasCones = !!diagramData && diagramData.cones.length > 0;
  const autoSetupInstructions = useMemo(
    () => (hasCones && diagramData ? generateSetupInstructions(diagramData) : ""),
    [diagramData, hasCones]
  );

  const initialAutoForExisting = useMemo(() => {
    if (!initial) return "";
    if (initial.setupDiagram && initial.setupDiagram.cones.length > 0) {
      return generateSetupInstructions(initial.setupDiagram);
    }
    return "";
  }, [initial]);
  const initialInstructions = initial?.setupInstructions ?? "";
  const [setupInstructionsOverride, setSetupInstructionsOverride] = useState<
    string | null
  >(
    initial && initialInstructions && initialInstructions !== initialAutoForExisting
      ? initialInstructions
      : null
  );
  const setupInstructions =
    setupInstructionsOverride ?? autoSetupInstructions;
  const isInstructionsCustom = setupInstructionsOverride !== null;

  const coneCount = diagramData?.cones.length ?? 0;
  const [otherEquipment, setOtherEquipment] = useState<string[]>(
    initial?.otherEquipment ?? []
  );
  const [newEquipment, setNewEquipment] = useState("");

  function addEquipment() {
    const trimmed = newEquipment.trim();
    if (!trimmed) return;
    setOtherEquipment((prev) =>
      prev.some((e) => e.toLowerCase() === trimmed.toLowerCase())
        ? prev
        : [...prev, trimmed]
    );
    setNewEquipment("");
  }
  function removeEquipment(index: number) {
    setOtherEquipment((prev) => prev.filter((_, i) => i !== index));
  }

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save(targetStatus: "draft" | "published") {
    setError(null);
    if (!drillName.trim()) {
      setError("Drill name is required.");
      return;
    }
    if (selectedCategoryIds.length === 0) {
      setError("Pick at least one category.");
      return;
    }
    const isCreatingCategory =
      !!otherCategory &&
      isOtherSelected &&
      newCategoryName.trim().length > 0;

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in.");
      setSubmitting(false);
      return;
    }

    const resolvedIds = selectedCategoryIds.filter(
      (id) => !otherCategory || id !== otherCategory.id
    );

    if (isCreatingCategory) {
      const trimmedName = newCategoryName.trim();
      const { data: existing } = await supabase
        .from("drill_categories")
        .select("id")
        .eq("team_id", teamId)
        .ilike("category_name", trimmedName)
        .maybeSingle();

      let createdId: string | null = null;
      if (existing?.id) {
        createdId = existing.id as string;
      } else {
        const { data: newCat, error: catErr } = await supabase
          .from("drill_categories")
          .insert({
            category_name: trimmedName.toLowerCase(),
            team_id: teamId,
            created_by: user.id,
            display_order: 50,
          })
          .select("id")
          .single();
        if (catErr || !newCat) {
          setError(catErr?.message ?? "Failed to create category.");
          setSubmitting(false);
          return;
        }
        createdId = newCat.id as string;
      }
      if (createdId && !resolvedIds.includes(createdId)) {
        resolvedIds.push(createdId);
      }
    }

    if (resolvedIds.length === 0) {
      setError("Pick at least one category.");
      setSubmitting(false);
      return;
    }
    const primaryCategoryId = resolvedIds[0];

    const payload = {
      team_id: teamId,
      drill_name: drillName.trim(),
      category_id: primaryCategoryId,
      additional_category_ids: resolvedIds,
      description: description.trim() || null,
      source_url: sourceUrl.trim() || null,
      benchmark_type:
        benchmarkType === "None" ? null : benchmarkType.toLowerCase(),
      status: targetStatus,
      equipment:
        coneCount > 0 || otherEquipment.length > 0
          ? { cones: coneCount, other: otherEquipment }
          : null,
      setup_diagram: hasCones ? diagramData : null,
      setup_instructions:
        setupInstructions && setupInstructions.trim() ? setupInstructions : null,
    };

    if (isEditing && initial) {
      const { error: updateErr } = await supabase
        .from("team_drills")
        .update(payload)
        .eq("id", initial.id);
      if (updateErr) {
        setError(updateErr.message);
        setSubmitting(false);
        return;
      }
      router.refresh();
      router.push(`/drills/${initial.id}`);
    } else {
      const { data, error: insertErr } = await supabase
        .from("team_drills")
        .insert({ ...payload, created_by: user.id })
        .select("id")
        .single();
      if (insertErr || !data) {
        setError(insertErr?.message ?? "Failed to save drill.");
        setSubmitting(false);
        return;
      }
      router.refresh();
      const returnUrl = buildReturnUrl(
        targetStatus === "published" ? (data.id as string) : undefined
      );
      router.push(returnUrl ?? `/drills/${data.id}`);
    }
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--color-surface-base)",
    border: "1px solid var(--color-border-default)",
    color: "var(--color-text-primary)",
  };

  const pillStyle = (selected: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    minHeight: "44px",
    backgroundColor: selected ? "#5C3308" : "rgba(255,255,255,0.04)",
    color: selected ? "#F0B870" : "rgba(255,255,255,0.45)",
    border: selected ? "1px solid #D48A30" : "1px solid rgba(255,255,255,0.08)",
  });

  const showUnpublish = isEditing && initial?.status === "published";

  return (
    <div className="pt-3xl pb-2xl">
      <Link
        href={
          returnTo
            ? buildReturnUrl() ?? "/drills"
            : isEditing && initial
              ? `/drills/${initial.id}`
              : "/drills"
        }
        className="text-caption no-underline"
        style={{ color: "var(--color-text-secondary)" }}
      >
        ← Back{returnTo ? " to practice plan" : ""}
      </Link>

      <h1
        className="text-title font-medium mt-md"
        style={{ color: "var(--color-text-primary)" }}
      >
        {isEditing ? "Edit drill" : "New drill"}
      </h1>

      <form
        className="flex flex-col gap-xl mt-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          save("published");
        }}
      >
        <div className="flex flex-col gap-xs">
          <label
            htmlFor="drillName"
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Drill name
          </label>
          <input
            id="drillName"
            type="text"
            required
            value={drillName}
            onChange={(e) => setDrillName(e.target.value)}
            placeholder="e.g., Explosion Sprint Shuttle"
            className="w-full rounded-md px-md text-body outline-none transition-colors"
            style={{ height: "44px", ...inputStyle }}
          />
        </div>

        <div className="flex flex-col gap-xs">
          <span
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Categories
          </span>
          <p
            className="text-micro"
            style={{ color: "var(--color-text-muted)" }}
          >
            Tap as many as fit. The first one you pick is the primary
            category.
          </p>
          <div className="flex gap-sm flex-wrap mt-xs">
            {categories.map((c) => {
              const selected = selectedCategoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryIds((prev) => {
                      if (prev.includes(c.id)) {
                        return prev.filter((id) => id !== c.id);
                      }
                      return [...prev, c.id];
                    });
                    if (otherCategory && c.id === otherCategory.id) {
                      // toggling Other off clears the new-name input
                      if (selectedCategoryIds.includes(c.id)) {
                        setNewCategoryName("");
                      }
                    }
                  }}
                  aria-pressed={selected}
                  className="rounded-pill text-caption font-medium transition-all capitalize"
                  style={pillStyle(selected)}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          {otherCategory && isOtherSelected && (
            <div className="flex flex-col gap-xs mt-sm">
              <input
                id="newCategory"
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                className="w-full rounded-md px-md text-body outline-none transition-colors"
                style={{ height: "44px", ...inputStyle }}
              />
              <p
                className="text-micro"
                style={{ color: "var(--color-text-muted)" }}
              >
                Saved to your team so other captains can reuse it.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-xs">
          <label
            htmlFor="description"
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="How to run this drill, coaching cues..."
            rows={5}
            className="w-full rounded-md px-md py-md text-body outline-none transition-colors"
            style={inputStyle}
          />
          <input
            id="sourceUrl"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Source link (TikTok, Instagram, YouTube)"
            className="w-full rounded-md px-md text-body outline-none transition-colors mt-xs"
            style={{ height: "44px", ...inputStyle }}
          />
        </div>

        <div className="flex flex-col gap-xs">
          <span
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Benchmark type
          </span>
          <div className="flex gap-sm flex-wrap">
            {BENCHMARK_OPTIONS.map((opt) => {
              const selected = benchmarkType === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setBenchmarkType(opt)}
                  aria-pressed={selected}
                  className="rounded-pill text-caption font-medium transition-all"
                  style={pillStyle(selected)}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-xs">
          <span
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Setup Diagram
          </span>
          <DiagramEditor value={diagramData} onChange={setDiagramData} />
        </div>

        {(hasCones || isInstructionsCustom) && (
          <div
            className="rounded-lg p-lg flex flex-col gap-sm"
            style={{ backgroundColor: "var(--color-surface-raised)" }}
          >
            <div className="flex items-center justify-between gap-sm">
              <p
                className="label-micro"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Setup Instructions
                {isInstructionsCustom ? "" : " (auto-generated)"}
              </p>
              {isInstructionsCustom && (
                <button
                  type="button"
                  onClick={() => setSetupInstructionsOverride(null)}
                  className="text-caption font-medium"
                  style={{
                    color: "var(--color-text-secondary)",
                    background: "transparent",
                    padding: "4px 8px",
                  }}
                >
                  Reset to auto
                </button>
              )}
            </div>
            <textarea
              value={setupInstructions}
              onChange={(e) => setSetupInstructionsOverride(e.target.value)}
              rows={3}
              className="w-full rounded-md px-md py-sm text-body outline-none transition-colors whitespace-pre-wrap"
              style={inputStyle}
            />
          </div>
        )}

        <div className="flex flex-col gap-xs">
          <span
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Equipment
          </span>
          <p
            className="text-micro"
            style={{ color: "var(--color-text-muted)" }}
          >
            Cones are counted from the diagram. Add anything else (agility
            ladder, resistance bands, etc.).
          </p>
          <div
            className="rounded-lg p-md mt-xs flex flex-col gap-sm"
            style={{ backgroundColor: "var(--color-surface-raised)" }}
          >
            <div className="flex items-center justify-between">
              <p
                className="text-body"
                style={{ color: "var(--color-text-primary)" }}
              >
                Cones
              </p>
              <span
                className="text-body tabular-nums"
                style={{
                  color:
                    coneCount > 0
                      ? "var(--color-text-primary)"
                      : "var(--color-text-muted)",
                }}
              >
                {coneCount}
              </span>
            </div>

            {otherEquipment.length > 0 && (
              <div className="flex flex-col gap-xs">
                {otherEquipment.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="flex items-center justify-between gap-sm rounded-md px-md"
                    style={{
                      backgroundColor: "var(--color-surface-base)",
                      border: "1px solid var(--color-border-subtle)",
                      minHeight: "44px",
                    }}
                  >
                    <p
                      className="text-body flex-1 min-w-0"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {item}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeEquipment(index)}
                      aria-label={`Remove ${item}`}
                      style={{
                        width: "44px",
                        height: "44px",
                        backgroundColor: "transparent",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-sm">
              <input
                type="text"
                value={newEquipment}
                onChange={(e) => setNewEquipment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEquipment();
                  }
                }}
                placeholder="e.g., agility ladder"
                className="flex-1 rounded-md px-md text-body outline-none transition-colors"
                style={{ height: "44px", ...inputStyle }}
              />
              <button
                type="button"
                onClick={addEquipment}
                disabled={!newEquipment.trim()}
                className="rounded-md text-caption font-medium"
                style={{
                  padding: "0 14px",
                  height: "44px",
                  backgroundColor: "var(--color-surface-base)",
                  color: newEquipment.trim()
                    ? "var(--color-orange-400)"
                    : "var(--color-text-muted)",
                  border: "1px solid var(--color-border-subtle)",
                  opacity: newEquipment.trim() ? 1 : 0.6,
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p
            className="text-caption"
            style={{ color: "var(--color-error-light)" }}
          >
            {error}
          </p>
        )}

        <div className="flex flex-col gap-sm">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-lg rounded-xl text-body font-medium tracking-wide transition-opacity"
            style={{
              backgroundColor: "var(--color-orange-500)",
              color: "#FFFFFF",
              letterSpacing: "0.3px",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting
              ? "Saving…"
              : isEditing && initial?.status === "published"
                ? "Save"
                : "Publish"}
          </button>

          {showUnpublish ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => save("draft")}
              className="w-full py-lg rounded-xl text-body font-medium transition-opacity"
              style={{
                backgroundColor: "transparent",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              Unpublish (move to draft)
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => save("draft")}
              className="w-full py-lg rounded-xl text-body font-medium transition-opacity"
              style={{
                backgroundColor: "transparent",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              Save as Draft
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
