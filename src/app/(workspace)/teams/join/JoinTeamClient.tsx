"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { joinTeam } from "./actions";

const ROLES: { id: "captain" | "coach" | "assistant"; label: string; hint: string }[] = [
  { id: "captain", label: "Captain", hint: "Player-leader. Calls the locker-room shots." },
  { id: "coach", label: "Coach", hint: "Plans practices and runs benchmarks." },
  { id: "assistant", label: "Assistant", hint: "Helps run sessions. Promote later." },
];

export default function JoinTeamClient() {
  const router = useRouter();
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState<"captain" | "coach" | "assistant">("coach");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmed = teamId.trim();
  const canSubmit = trimmed.length > 0 && !isPending;

  function submit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("teamId", trimmed);
      fd.set("role", role);
      const res = await joinTeam(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/dashboard/team/${res.teamId}`);
      router.refresh();
    });
  }

  return (
    <div
      className="uff-web"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "48px 20px",
      }}
    >
      <div
        className="w-card"
        style={{
          width: "100%",
          maxWidth: 480,
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--uff-lime)",
              letterSpacing: ".08em",
              fontWeight: 700,
            }}
          >
            JOIN A TEAM
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--uff-text)",
            }}
          >
            Got a team ID?
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--uff-text-mute)",
              lineHeight: 1.5,
            }}
          >
            Paste the team&rsquo;s ID below and you&rsquo;ll be added as an
            assistant. A captain can promote you later. The ID is the UUID at
            the end of any team URL — e.g.{" "}
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--uff-text)",
              }}
            >
              /dashboard/team/&lt;id&gt;
            </code>
            .
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label
            htmlFor="teamId"
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "var(--uff-text)",
            }}
          >
            Team ID
          </label>
          <input
            id="teamId"
            className="fr-input"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={teamId}
            onChange={(e) => {
              setTeamId(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              letterSpacing: "0.02em",
            }}
          />
          {error && (
            <div
              style={{
                padding: "10px 12px",
                background: "rgba(255,77,77,0.08)",
                border: "1px solid rgba(255,77,77,0.28)",
                borderRadius: 10,
                color: "#FF8A8A",
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "var(--uff-text)",
            }}
          >
            Join as
          </label>
          <div
            className="fr-seg"
            style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
          >
            {ROLES.map((r) => {
              const on = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={on ? "on" : ""}
                  style={
                    on
                      ? {
                          background: "var(--uff-orange)",
                          color: "#0a0a0d",
                        }
                      : undefined
                  }
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 11.5,
              color: "var(--uff-text-mute)",
              lineHeight: 1.5,
            }}
          >
            {ROLES.find((r) => r.id === role)?.hint}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/dashboard"
            className="wbtn ghost"
            style={{ flex: 1, justifyContent: "center" }}
          >
            Cancel
          </Link>
          <button
            type="button"
            className="wbtn primary"
            onClick={submit}
            disabled={!canSubmit}
            style={{
              flex: 1,
              justifyContent: "center",
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            {isPending ? "Joining…" : "Join team"}
          </button>
        </div>
      </div>
    </div>
  );
}
