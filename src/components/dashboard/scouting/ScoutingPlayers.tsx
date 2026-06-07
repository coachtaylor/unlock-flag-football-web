"use client";

// §3 interactive layer (Build 8.7 Phase 3). Renders the player report-card grid
// as tappable cards and owns the selected-player state that drives the side
// sheet. The card face + atoms are the shared presentational pieces from
// ScoutingSections, so the visual stays identical to the server-rendered grid
// it replaces — this only adds the open-sheet interaction.

import { useState } from "react";
import SectionHead from "@/components/dashboard/widgets/SectionHead";
import { PlayerCardFace } from "./ScoutingSections";
import PlayerScoutSheet from "./PlayerScoutSheet";
import type { PlayerReportCard } from "@/lib/dashboard/team-scouting-data";

export default function ScoutingPlayers({
  cards,
  teamId,
  canManage,
}: {
  cards: PlayerReportCard[];
  teamId: string;
  canManage: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = cards.find((c) => c.playerId === selectedId) ?? null;

  return (
    <div className="w-card" style={{ padding: 16 }}>
      <SectionHead label="Player report cards" meta={`${cards.length} PLAYERS`} />
      <div className="scout-players">
        {cards.map((c) => (
          <button
            key={c.playerId}
            type="button"
            onClick={() => setSelectedId(c.playerId)}
            className="scout-player-card scout-player-btn"
            style={{
              textAlign: "left",
              cursor: "pointer",
              font: "inherit",
              color: "inherit",
              width: "100%",
            }}
          >
            <PlayerCardFace c={c} />
          </button>
        ))}
      </div>

      <PlayerScoutSheet
        card={selected}
        teamId={teamId}
        canManage={canManage}
        onClose={() => setSelectedId(null)}
      />

      <style>{`
        .scout-player-btn {
          transition: border-color 120ms ease, background 120ms ease;
        }
        .scout-player-btn:hover {
          border-color: var(--uff-line);
          background: rgba(255,255,255,0.03);
        }
      `}</style>
    </div>
  );
}
