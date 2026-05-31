"use client";

// Archive / Unarchive / Delete control for the practice detail page.
//
// Policy: every active practice (draft/scheduled/live/completed) can only be
// archived — its data is always kept. Once archived, it can be unarchived or
// permanently deleted. Delete goes through a type-the-name confirm modal.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlanStatus } from "@/lib/practice/plan-data";
import { deletePlan, archivePlan, unarchivePlan } from "@/lib/practice/actions";
import DeletePlanModal from "@/components/practice/DeletePlanModal";

export default function PlanLifecycleActions({
  planId,
  status,
  archived,
  title,
}: {
  planId: string;
  status: PlanStatus;
  archived: boolean;
  /** Practice title — what the coach must re-type to confirm a delete. */
  title?: string | null;
}) {
  // status is part of the public contract but the lifecycle no longer
  // branches on it (every active status archives the same way).
  void status;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (archived) {
    return (
      <>
        <div style={{ display: "flex", gap: 8 }}>
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
          <button
            type="button"
            className="wbtn"
            disabled={pending}
            style={{ color: "var(--uff-red, #ff4d4d)" }}
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </button>
        </div>
        <DeletePlanModal
          open={deleteOpen}
          title={title}
          busy={pending}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() =>
            startTransition(async () => {
              await deletePlan(planId);
              router.push("/practice");
            })
          }
        />
      </>
    );
  }

  return (
    <button
      type="button"
      className="wbtn"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Archive this practice? It moves to your Archived list — all data is kept, and you can unarchive it later.",
          )
        )
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
