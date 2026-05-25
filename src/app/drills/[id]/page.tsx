import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DiagramRenderer from "@/components/DiagramRenderer";
import type { DiagramData } from "@/types/diagram";

type Props = { params: Promise<{ id: string }> };

export default async function DrillDetailPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/team-setup");

  const { data: drill } = await supabase
    .from("team_drills")
    .select(
      "id, team_id, drill_name, description, source_url, benchmark_type, status, setup_instructions, setup_diagram, equipment, category_id, additional_category_ids"
    )
    .eq("id", id)
    .maybeSingle();

  if (!drill || drill.team_id !== membership.team_id) notFound();

  const allCategoryIds = Array.from(
    new Set<string>(
      [
        (drill.category_id as string | null) ?? null,
        ...((drill.additional_category_ids as string[] | null) ?? []),
      ].filter((x): x is string => !!x)
    )
  );
  const { data: categoryRows } = allCategoryIds.length
    ? await supabase
        .from("drill_categories")
        .select("id, category_name")
        .in("id", allCategoryIds)
    : { data: [] as { id: string; category_name: string }[] };
  const nameById = new Map(
    (categoryRows ?? []).map((c) => [c.id as string, c.category_name as string])
  );
  const categoryNames = allCategoryIds
    .map((id) => nameById.get(id))
    .filter((n): n is string => !!n);

  const benchmarkType = drill.benchmark_type as "timed" | "rated" | null;
  const status = drill.status as "draft" | "published";

  const rawDiagram = drill.setup_diagram as DiagramData | null;
  const diagram =
    rawDiagram && Array.isArray(rawDiagram.cones) && rawDiagram.cones.length > 0
      ? rawDiagram
      : null;

  const equipment = drill.equipment as
    | { cones?: number; other?: unknown }
    | null;
  const equipmentCones =
    typeof equipment?.cones === "number" ? equipment.cones : 0;
  const equipmentOther = Array.isArray(equipment?.other)
    ? equipment!.other!.filter((x): x is string => typeof x === "string")
    : [];
  const showEquipment = equipmentCones > 0 || equipmentOther.length > 0;

  return (
    <div className="pt-3xl pb-2xl">
      <Link
        href="/drills"
        className="text-caption no-underline"
        style={{ color: "var(--color-text-secondary)" }}
      >
        ← Drill Library
      </Link>

      <h1
        className="text-title font-medium mt-md"
        style={{ color: "var(--color-text-primary)" }}
      >
        {drill.drill_name as string}
      </h1>

      <div className="flex items-center gap-xs mt-md flex-wrap">
        {categoryNames.map((name) => (
          <span
            key={name}
            className="label-micro rounded-pill capitalize"
            style={{
              padding: "2px 8px",
              backgroundColor: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            {name}
          </span>
        ))}
        {benchmarkType && (
          <span
            className="label-micro rounded-pill capitalize"
            style={{
              padding: "2px 8px",
              backgroundColor: "#5C3308",
              color: "#F0B870",
              border: "1px solid #D48A30",
            }}
          >
            {benchmarkType}
          </span>
        )}
        {status === "draft" && (
          <span
            className="text-micro font-medium rounded-pill"
            style={{
              padding: "2px 8px",
              backgroundColor: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.45)",
              border: "1px dashed rgba(255,255,255,0.18)",
            }}
          >
            Draft
          </span>
        )}
      </div>

      {(drill.description || drill.source_url) && (
        <div className="mt-2xl">
          <p
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Description
          </p>
          {drill.description ? (
            <p
              className="text-body mt-sm whitespace-pre-wrap"
              style={{ color: "var(--color-text-primary)" }}
            >
              {drill.description as string}
            </p>
          ) : null}
          {drill.source_url ? (
            <a
              href={drill.source_url as string}
              target="_blank"
              rel="noopener noreferrer"
              className="text-body mt-sm inline-block break-all"
              style={{ color: "var(--color-orange-400)" }}
            >
              {drill.source_url as string}
            </a>
          ) : null}
        </div>
      )}

      {diagram ? (
        <div className="mt-2xl">
          <p
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Setup Diagram
          </p>
          <div className="mt-sm">
            <DiagramRenderer data={diagram} />
          </div>
          {drill.setup_instructions ? (
            <div
              className="mt-md rounded-lg p-lg"
              style={{ backgroundColor: "var(--color-surface-raised)" }}
            >
              <p
                className="label-micro"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Setup Instructions
              </p>
              <p
                className="text-body mt-sm whitespace-pre-wrap"
                style={{ color: "var(--color-text-primary)" }}
              >
                {drill.setup_instructions as string}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {showEquipment ? (
        <div className="mt-2xl">
          <p
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Equipment
          </p>
          <div
            className="mt-sm rounded-lg p-lg flex flex-col gap-sm"
            style={{ backgroundColor: "var(--color-surface-raised)" }}
          >
            {equipmentCones > 0 && (
              <div className="flex items-center justify-between">
                <p
                  className="text-body"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Cones
                </p>
                <span
                  className="text-body tabular-nums"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {equipmentCones}
                </span>
              </div>
            )}
            {equipmentOther.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="flex items-center"
              >
                <p
                  className="text-body"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3xl flex flex-col gap-sm">
        {benchmarkType && status === "published" && (
          <Link
            href={`/benchmarks?drill=${drill.id}`}
            className="w-full block py-lg rounded-xl text-body font-medium tracking-wide text-center no-underline"
            style={{
              backgroundColor: "var(--color-green-800)",
              color: "var(--color-green-400)",
              border: "1px solid var(--color-green-600)",
              letterSpacing: "0.3px",
            }}
          >
            Run Benchmark
          </Link>
        )}
        <Link
          href={`/drills/${drill.id}/edit`}
          className="w-full block py-lg rounded-xl text-body font-medium tracking-wide text-center no-underline"
          style={{
            backgroundColor: "var(--color-orange-500)",
            color: "#FFFFFF",
            letterSpacing: "0.3px",
          }}
        >
          Edit
        </Link>
      </div>
    </div>
  );
}
