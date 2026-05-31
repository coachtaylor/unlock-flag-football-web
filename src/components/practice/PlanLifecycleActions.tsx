"use client";

// Delete / Archive / Unarchive control for the practice detail page.
//
// Policy: draft + scheduled can be hard-deleted; once a practice has gone
// live (live/completed) it can only be archived (a live plan can be moved
// back to scheduled first to regain delete). Archived plans can be
// unarchived.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlanStatus } from "@/lib/practice/plan-data";
import { deletePlan, archivePlan, unarchivePlan } from "@/lib/practice/actions";

export default function PlanLifecycleActions({
  planId,
  status,
  archived,
}: {
  planId: string;
  status: PlanStatus;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (archived) {
    return (
      <button
        type="button"
        className="wbtn"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await unarchivePlan(planId);
            router.refresh();
          })
        }
      >
        {pending ? "Unarchiving…" : "Unarchive"}
      </button>
    );
  }

  const canDelete = status === "draft" || status === "scheduled";

  if (canDelete) {
    return (
      <button
        type="button"
        className="wbtn"
        disabled={pending}
        style={{ color: "var(--uff-red, #ff4d4d)" }}
        onClick={() => {
          if (!confirm("Delete this practice? This can't be undone.")) return;
          startTransition(async () => {
            await deletePlan(planId);
            router.push("/practice");
          });
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="wbtn"
      disabled={pending}
      onClick={() => {
        if (!confirm("Archive this practice? It moves to your Archived list."))
          return;
        startTransition(async () => {
          await archivePlan(planId);
          router.push("/practice");
        });
      }}
    >
      {pending ? "Archiving…" : "Archive"}
    </button>
  );
}
