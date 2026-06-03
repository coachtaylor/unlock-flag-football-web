"use client";

// Destructive confirmation for permanently deleting an archived practice.
// Thin practice-specific wrapper over the generic DeleteConfirmModal: it
// resolves the type-to-confirm name from the plan title (untitled practices
// have no name to match, so they fall back to a plain confirm) and supplies
// the "practice" noun. All markup + behavior lives in the shared modal.

import { isUntitledPlanTitle } from "@/lib/practice/plan-data";
import DeleteConfirmModal from "@/components/ui/DeleteConfirmModal";

export default function DeletePlanModal({
  open,
  title,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /**
   * The practice title the coach must re-type to confirm (case-sensitive).
   * Empty/whitespace => the practice is untitled and the typing gate is
   * skipped.
   */
  title: string | null | undefined;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // A real, user-given name requires typing to confirm; placeholder/blank
  // titles fall back to a plain confirm.
  const name = isUntitledPlanTitle(title) ? null : title;
  return (
    <DeleteConfirmModal
      open={open}
      name={name}
      noun="practice"
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
