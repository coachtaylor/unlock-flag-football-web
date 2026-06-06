"use client";

// The pinned-pulse corner marker, as a remove control. Sits above the card's
// drill-page link (stops propagation so a click here unpins, not navigates).
// Coach-only — the parent only renders it when the user can manage the team.

import { useTransition } from "react";
import { Icon } from "@/components/uff/icons";
import { removePin } from "@/app/(workspace)/dashboard/team/[teamId]/actions";

export default function UnpinPulseButton({
  pinId,
  drillId,
  teamId,
}: {
  pinId: string;
  drillId: string;
  teamId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="pulse-unpin"
      title="Unpin from dashboard"
      aria-label="Unpin from dashboard"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          await removePin({ pinId, drillId, teamId });
        });
      }}
    >
      <Icon.pin size={13} />
    </button>
  );
}
