"use client";

// Pin / unpin a drill for the team dashboard. The dashboard surfaces
// up to 4 pinned drills as Pinned Pulses (Build 7). State is stored on
// team_drills.is_dashboard_pinned + dashboard_pinned_at.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { togglePinDrill } from "@/app/(workspace)/dashboard/team/[teamId]/actions";
import { Icon } from "@/components/uff/icons";

export default function PinButton({
  drillId,
  teamId,
  pinned,
}: {
  drillId: string;
  teamId: string;
  pinned: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await togglePinDrill(drillId, teamId, !pinned);
          router.refresh();
        })
      }
      aria-pressed={pinned}
      disabled={pending}
      className={`wbtn ${pinned ? "primary" : ""}`}
      style={{
        height: 32,
        padding: "0 12px",
        fontSize: 12,
        opacity: pending ? 0.7 : 1,
      }}
    >
      <Icon.pin size={12} />
      {pinned ? "Pinned" : "Pin to dashboard"}
    </button>
  );
}
