"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Player = {
  id: string;
  name: string;
  positions: string[];
  jerseyNumber: string | null;
  status: "active" | "inactive";
};

type Props = {
  players: Player[];
};

export default function RosterListClient({ players }: Props) {
  const [showInactive, setShowInactive] = useState(false);

  const { active, inactive } = useMemo(() => {
    const active: Player[] = [];
    const inactive: Player[] = [];
    for (const p of players) {
      if (p.status === "inactive") inactive.push(p);
      else active.push(p);
    }
    return { active, inactive };
  }, [players]);

  if (players.length === 0) {
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
          No players on the roster yet. Add your first player.
        </p>
        <Link
          href="/roster/new"
          className="inline-block mt-lg rounded-pill text-caption font-medium no-underline"
          style={{
            padding: "10px 16px",
            backgroundColor: "var(--color-orange-500)",
            color: "#FFFFFF",
            letterSpacing: "0.3px",
          }}
        >
          Add Player
        </Link>
      </div>
    );
  }

  return (
    <>
      {active.length > 0 && (
        <div className="flex flex-col gap-sm mt-xl">
          {active.map((p) => (
            <PlayerCard key={p.id} player={p} dim={false} />
          ))}
        </div>
      )}

      {active.length === 0 && inactive.length > 0 && (
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
            No active players.
          </p>
        </div>
      )}

      {inactive.length > 0 && (
        <div className="mt-2xl">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            aria-expanded={showInactive}
            className="text-caption font-medium"
            style={{
              color: "var(--color-text-secondary)",
              padding: "8px 0",
              minHeight: "44px",
            }}
          >
            {showInactive ? "Hide" : "Show"} inactive ({inactive.length})
          </button>

          {showInactive && (
            <div className="flex flex-col gap-sm mt-sm">
              {inactive.map((p) => (
                <PlayerCard key={p.id} player={p} dim={true} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function PlayerCard({ player, dim }: { player: Player; dim: boolean }) {
  return (
    <Link
      href={`/roster/${player.id}`}
      className="p-lg rounded-lg no-underline"
      style={{
        backgroundColor: "var(--color-surface-base)",
        border: "1px solid var(--color-border-subtle)",
        opacity: dim ? 0.55 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-md">
        <div className="flex-1 min-w-0">
          <p
            className="text-heading font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            {player.name}
          </p>
          {player.positions.length > 0 && (
            <div className="flex items-center gap-xs mt-sm flex-wrap">
              {player.positions.map((pos) => (
                <span
                  key={pos}
                  className="label-micro rounded-pill"
                  style={{
                    padding: "2px 8px",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  {pos}
                </span>
              ))}
            </div>
          )}
        </div>
        {player.jerseyNumber && (
          <span
            className="text-body tabular-nums flex-shrink-0"
            style={{ color: "var(--color-text-muted)" }}
          >
            #{player.jerseyNumber}
          </span>
        )}
      </div>
    </Link>
  );
}
