"use client";

import Link from "next/link";

type Plan = {
  id: string;
  practiceDate: string;
  title: string | null;
  status: "draft" | "finalized" | "completed";
  drillCount: number;
  totalDuration: number;
};

type Props = { plans: Plan[] };

function formatShortDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: Plan["status"] }) {
  if (status === "draft") {
    return (
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
    );
  }
  if (status === "finalized") {
    return (
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
    );
  }
  return (
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
  );
}

export default function PracticeListClient({ plans }: Props) {
  if (plans.length === 0) {
    return (
      <div
        className="mt-2xl p-2xl rounded-lg text-center"
        style={{
          backgroundColor: "var(--color-surface-base)",
          border: "1px dashed var(--color-border-default)",
        }}
      >
        <p
          className="text-body"
          style={{ color: "var(--color-text-secondary)" }}
        >
          No practice plans yet. Plan your first session.
        </p>
        <Link
          href="/practice/new"
          className="inline-block mt-lg rounded-pill text-caption font-medium no-underline"
          style={{
            padding: "10px 16px",
            backgroundColor: "var(--color-orange-500)",
            color: "#FFFFFF",
            letterSpacing: "0.3px",
          }}
        >
          New Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm mt-xl">
      {plans.map((plan) => (
        <Link
          key={plan.id}
          href={`/practice/${plan.id}`}
          className="p-lg rounded-lg no-underline"
          style={{
            backgroundColor: "var(--color-surface-base)",
            border: "1px solid var(--color-border-subtle)",
            opacity: plan.status === "completed" ? 0.7 : 1,
          }}
        >
          <div className="flex items-start justify-between gap-md">
            <div className="flex-1 min-w-0">
              <p
                className="text-heading font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {formatShortDate(plan.practiceDate)}
              </p>
              {plan.title && (
                <p
                  className="text-body mt-xs"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {plan.title}
                </p>
              )}
              <div className="flex items-center gap-md mt-sm">
                <span
                  className="text-caption"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {plan.drillCount}{" "}
                  {plan.drillCount === 1 ? "drill" : "drills"}
                </span>
                <span
                  className="text-caption tabular-nums"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {plan.totalDuration} min
                </span>
              </div>
            </div>
            <StatusBadge status={plan.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}
