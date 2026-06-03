"use client";

// Remove-staff control for the coach detail page (Build 16.5c). A red ghost
// button that opens a confirm modal, then calls removeStaff(). The DB RPC
// enforces the guards (can't remove yourself, can't strip the team's last
// full-access member) — we surface its error if it refuses.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeStaff } from "@/lib/team/staff-actions";

export default function RemoveStaffButton({
  memberId,
  teamId,
  name,
  rosterHref,
}: {
  memberId: string;
  teamId: string;
  name: string;
  rosterHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await removeStaff({ memberId, teamId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(rosterHref);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className="wbtn"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        style={{
          height: 38,
          background: "transparent",
          color: "var(--uff-red)",
          border: "1px solid rgba(255,77,77,0.42)",
        }}
      >
        Remove
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-staff-headline"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.62)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            zIndex: 50,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "var(--uff-bg-1)",
              border: "1px solid var(--uff-line)",
              borderRadius: 14,
              padding: 22,
              boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 10.5,
                color: "var(--uff-red, #ff4d4d)",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Remove from team
            </div>
            <h2
              id="remove-staff-headline"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--uff-text)",
              }}
            >
              Remove {name}?
            </h2>
            <p
              style={{
                marginTop: 8,
                marginBottom: 0,
                fontSize: 13,
                color: "var(--uff-text)",
                opacity: 0.78,
                lineHeight: 1.5,
              }}
            >
              They lose access to this team and drop off the coaching staff.
              Their account isn&rsquo;t deleted — you can invite them back any
              time.
            </p>

            {error && (
              <p
                role="alert"
                style={{
                  marginTop: 12,
                  marginBottom: 0,
                  fontSize: 12.5,
                  color: "var(--uff-red, #ff4d4d)",
                }}
              >
                {error}
              </p>
            )}

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="wbtn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={pending}
                className="wbtn primary"
                style={{
                  background: "var(--uff-red, #ff4d4d)",
                  color: "#0b0b0d",
                  borderColor: "transparent",
                  opacity: pending ? 0.6 : 1,
                }}
              >
                {pending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
