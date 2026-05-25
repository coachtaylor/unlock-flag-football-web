import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

function formatLongDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(t: string | null): string | null {
  if (!t) return null;
  const match = t.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = match[2];
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === "00" ? `${hour12} ${period}` : `${hour12}:${m} ${period}`;
}

function diffMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = start.match(/^(\d{2}):(\d{2})/);
  const e = end.match(/^(\d{2}):(\d{2})/);
  if (!s || !e) return null;
  const diff =
    Number(e[1]) * 60 + Number(e[2]) - (Number(s[1]) * 60 + Number(s[2]));
  return diff > 0 ? diff : null;
}

export default async function PracticePlanDetailPage({ params }: Props) {
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

  const { data: plan } = await supabase
    .from("practice_plans")
    .select(
      "id, team_id, practice_date, start_time, end_time, title, status, notes, practice_plan_drills(id, drill_id, drill_order, duration_minutes, team_drills(id, drill_name, drill_categories(category_name)))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!plan || plan.team_id !== membership.team_id) notFound();

  const status = plan.status as "draft" | "finalized" | "completed";

  const { data: practiceLog } =
    status === "completed"
      ? await supabase
          .from("practice_logs")
          .select(
            "id, drills_completed, drills_skipped, team_performance_notes, highlights, areas_to_improve, attendance_count, energy_level"
          )
          .eq("practice_plan_id", id)
          .maybeSingle()
      : { data: null };

  const planDrills = ((plan.practice_plan_drills as
    | {
        id: string;
        drill_id: string;
        drill_order: number;
        duration_minutes: number | null;
        team_drills:
          | {
              id: string;
              drill_name: string;
              drill_categories:
                | { category_name: string }
                | { category_name: string }[]
                | null;
            }
          | {
              id: string;
              drill_name: string;
              drill_categories:
                | { category_name: string }
                | { category_name: string }[]
                | null;
            }[]
          | null;
      }[]
    | null) ?? []).slice().sort((a, b) => a.drill_order - b.drill_order);

  const totalDuration = planDrills.reduce(
    (sum, d) => sum + (d.duration_minutes ?? 0),
    0
  );

  const completedSet = new Set<string>(
    (practiceLog?.drills_completed as string[] | null) ?? []
  );
  const skippedSet = new Set<string>(
    (practiceLog?.drills_skipped as string[] | null) ?? []
  );
  const skippedDrillNames = planDrills
    .filter((pd) => skippedSet.has(pd.drill_id))
    .map((pd) => {
      const drillRecord = Array.isArray(pd.team_drills)
        ? pd.team_drills[0]
        : pd.team_drills;
      return drillRecord?.drill_name ?? "Unknown drill";
    });
  const completedCount = completedSet.size;
  const plannedCount = planDrills.length;

  const ENERGY_ANCHORS: Record<number, string> = {
    1: "Low energy",
    2: "Sluggish",
    3: "Average",
    4: "Good energy",
    5: "Fired up",
  };

  return (
    <div className="pt-3xl pb-2xl">
      <Link
        href="/practice"
        className="text-caption no-underline"
        style={{ color: "var(--color-text-secondary)" }}
      >
        ← Back to Plans
      </Link>

      <h1
        className="text-title font-medium mt-md"
        style={{ color: "var(--color-text-primary)" }}
      >
        {formatLongDate(plan.practice_date as string)}
      </h1>

      {plan.title ? (
        <p
          className="text-body mt-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {plan.title as string}
        </p>
      ) : null}

      {(() => {
        const startStr = formatTime(plan.start_time as string | null);
        const endStr = formatTime(plan.end_time as string | null);
        if (!startStr || !endStr) return null;
        return (
          <p
            className="text-body mt-xs tabular-nums"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {startStr} – {endStr}
          </p>
        );
      })()}

      <div className="mt-md">
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
        {status === "finalized" && (
          <span
            className="text-micro font-medium rounded-pill"
            style={{
              padding: "2px 8px",
              backgroundColor: "var(--color-green-800)",
              color: "var(--color-green-400)",
              border: "1px solid var(--color-green-600)",
            }}
          >
            Finalized
          </span>
        )}
        {status === "completed" && (
          <span
            className="text-micro font-medium rounded-pill"
            style={{
              padding: "2px 8px",
              backgroundColor: "rgba(255,255,255,0.04)",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            Completed
          </span>
        )}
      </div>

      {plan.notes ? (
        <div className="mt-2xl">
          <p
            className="label-micro"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Notes
          </p>
          <p
            className="text-body mt-sm whitespace-pre-wrap"
            style={{ color: "var(--color-text-primary)" }}
          >
            {plan.notes as string}
          </p>
        </div>
      ) : null}

      <div className="mt-2xl">
        <p
          className="text-heading font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          Schedule
        </p>

        {planDrills.length === 0 ? (
          <div
            className="mt-md p-2xl rounded-lg text-center"
            style={{
              backgroundColor: "var(--color-surface-base)",
              border: "1px dashed var(--color-border-default)",
            }}
          >
            <p
              className="text-body"
              style={{ color: "var(--color-text-secondary)" }}
            >
              No drills scheduled.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-sm mt-md">
            {planDrills.map((pd, index) => {
              const drillRecord = Array.isArray(pd.team_drills)
                ? pd.team_drills[0]
                : pd.team_drills;
              const drillName =
                drillRecord?.drill_name ?? "Unknown drill";
              const cat = drillRecord?.drill_categories as
                | { category_name: string }
                | { category_name: string }[]
                | null;
              const categoryName = Array.isArray(cat)
                ? cat[0]?.category_name
                : cat?.category_name;

              return (
                <Link
                  key={pd.id}
                  href={`/drills/${pd.drill_id}`}
                  className="p-md rounded-lg no-underline"
                  style={{
                    backgroundColor: "var(--color-surface-base)",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <div className="flex items-start gap-sm">
                    <span
                      className="text-caption tabular-nums flex-shrink-0"
                      style={{
                        color: "var(--color-text-muted)",
                        width: "20px",
                        marginTop: "2px",
                      }}
                    >
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-body font-medium"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {drillName}
                      </p>
                      {categoryName && (
                        <span
                          className="label-micro rounded-pill capitalize inline-block mt-xs"
                          style={{
                            padding: "2px 8px",
                            backgroundColor: "rgba(255,255,255,0.04)",
                            color: "rgba(255,255,255,0.55)",
                          }}
                        >
                          {categoryName}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-caption tabular-nums flex-shrink-0"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {pd.duration_minutes ?? 0} min
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {(() => {
          const practiceMinutes = diffMinutes(
            plan.start_time as string | null,
            plan.end_time as string | null
          );
          if (planDrills.length === 0 && practiceMinutes == null) return null;
          const remaining =
            practiceMinutes != null ? practiceMinutes - totalDuration : null;
          return (
            <div className="mt-md flex items-center justify-between gap-md">
              <p
                className="text-caption tabular-nums"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {totalDuration} min planned
                {practiceMinutes != null && ` of ${practiceMinutes} min`}
              </p>
              {remaining != null && (
                <p
                  className="text-body font-medium tabular-nums"
                  style={{
                    color:
                      remaining < 0
                        ? "var(--color-orange-400)"
                        : "var(--color-text-primary)",
                  }}
                >
                  {remaining >= 0
                    ? `${remaining} min available`
                    : `${Math.abs(remaining)} min over`}
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {/* Practice Log */}
      {status === "completed" && practiceLog && (
        <div className="mt-3xl">
          <p
            className="text-heading font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            Practice Log
          </p>

          <div
            className="mt-md p-lg rounded-lg"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            <p
              className="text-stat font-medium tabular-nums"
              style={{ color: "var(--color-text-primary)" }}
            >
              {completedCount} of {plannedCount} drills completed
            </p>

            {skippedDrillNames.length > 0 && (
              <div className="mt-md flex flex-col gap-xs">
                <p
                  className="label-micro"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Skipped
                </p>
                {skippedDrillNames.map((name, i) => (
                  <div
                    key={`${name}-${i}`}
                    className="flex items-center gap-sm"
                  >
                    <span
                      aria-hidden
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "9999px",
                        backgroundColor: "#FB923C",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      className="text-body"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-md grid grid-cols-2 gap-sm">
            <div
              className="p-lg rounded-lg"
              style={{
                backgroundColor: "var(--color-surface-raised)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <p
                className="label-micro"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Attendance
              </p>
              <p
                className="text-stat font-medium tabular-nums mt-xs"
                style={{ color: "var(--color-text-primary)" }}
              >
                {practiceLog.attendance_count != null
                  ? practiceLog.attendance_count
                  : "—"}
              </p>
            </div>
            <div
              className="p-lg rounded-lg"
              style={{
                backgroundColor: "var(--color-surface-raised)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <p
                className="label-micro"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Energy
              </p>
              <p
                className="text-stat font-medium tabular-nums mt-xs"
                style={{ color: "var(--color-text-primary)" }}
              >
                {practiceLog.energy_level != null
                  ? practiceLog.energy_level
                  : "—"}
              </p>
              {practiceLog.energy_level != null && (
                <p
                  className="text-caption mt-xs"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {ENERGY_ANCHORS[practiceLog.energy_level as number]}
                </p>
              )}
            </div>
          </div>

          {practiceLog.team_performance_notes && (
            <div className="mt-md">
              <p
                className="label-micro"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Team performance
              </p>
              <p
                className="text-body mt-sm whitespace-pre-wrap"
                style={{ color: "var(--color-text-primary)" }}
              >
                {practiceLog.team_performance_notes as string}
              </p>
            </div>
          )}

          {practiceLog.highlights && (
            <div className="mt-md">
              <p
                className="label-micro"
                style={{ color: "var(--color-text-secondary)" }}
              >
                What went well
              </p>
              <p
                className="text-body mt-sm whitespace-pre-wrap"
                style={{ color: "var(--color-text-primary)" }}
              >
                {practiceLog.highlights as string}
              </p>
            </div>
          )}

          {practiceLog.areas_to_improve && (
            <div className="mt-md">
              <p
                className="label-micro"
                style={{ color: "var(--color-text-secondary)" }}
              >
                What needs work
              </p>
              <p
                className="text-body mt-sm whitespace-pre-wrap"
                style={{ color: "var(--color-text-primary)" }}
              >
                {practiceLog.areas_to_improve as string}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {status !== "completed" && (
        <div className="mt-3xl flex flex-col gap-sm">
          {status === "draft" && (
            <>
              <Link
                href={`/practice/${plan.id}/edit`}
                className="w-full block py-lg rounded-xl text-body font-medium tracking-wide text-center no-underline"
                style={{
                  backgroundColor: "var(--color-orange-500)",
                  color: "#FFFFFF",
                  letterSpacing: "0.3px",
                }}
              >
                Edit Plan
              </Link>
              <Link
                href={`/practice/${plan.id}/edit?finalize=1`}
                className="w-full block py-lg rounded-xl text-body font-medium tracking-wide text-center no-underline"
                style={{
                  backgroundColor: "var(--color-green-800)",
                  color: "var(--color-green-400)",
                  border: "1px solid var(--color-green-600)",
                  letterSpacing: "0.3px",
                }}
              >
                Finalize
              </Link>
            </>
          )}
          {status === "finalized" && (
            <>
              <Link
                href={`/practice/${plan.id}/log`}
                className="w-full block py-lg rounded-xl text-body font-medium tracking-wide text-center no-underline"
                style={{
                  backgroundColor: "var(--color-orange-500)",
                  color: "#FFFFFF",
                  letterSpacing: "0.3px",
                }}
              >
                Log Practice
              </Link>
              <Link
                href={`/practice/${plan.id}/edit`}
                className="w-full block py-lg rounded-xl text-body font-medium tracking-wide text-center no-underline"
                style={{
                  backgroundColor: "var(--color-surface-raised)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-subtle)",
                  letterSpacing: "0.3px",
                }}
              >
                Edit Plan
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
