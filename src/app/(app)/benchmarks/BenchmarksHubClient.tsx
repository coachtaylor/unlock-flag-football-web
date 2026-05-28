"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BENCH_BY_ID, type BenchKind } from "@/components/uff-web/drills/atoms";

type Drill = {
  id: string;
  name: string;
  benchmarkTypes: BenchKind[];
};

type Player = {
  id: string;
  name: string;
  positions: string[];
};

type Props = {
  drills: Drill[];
  players: Player[];
  preselectedDrillId: string | null;
};

export default function BenchmarksHubClient({
  drills,
  players,
  preselectedDrillId,
}: Props) {
  const router = useRouter();
  const [selectedDrillId, setSelectedDrillId] = useState<string | null>(
    preselectedDrillId && drills.some((d) => d.id === preselectedDrillId)
      ? preselectedDrillId
      : null
  );
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(
    new Set()
  );

  const allSelected =
    players.length > 0 && selectedPlayerIds.size === players.length;

  function togglePlayer(id: string) {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelectedPlayerIds(new Set());
    else setSelectedPlayerIds(new Set(players.map((p) => p.id)));
  }

  function start() {
    if (!selectedDrillId || selectedPlayerIds.size === 0) return;
    const ids = Array.from(selectedPlayerIds).join(",");
    router.push(`/benchmarks/log?drill=${selectedDrillId}&players=${ids}`);
  }

  return (
    <div className="pt-3xl pb-2xl">
      <Link
        href="/dashboard"
        className="text-caption no-underline"
        style={{ color: "var(--color-text-secondary)" }}
      >
        ← Dashboard
      </Link>

      <h1
        className="text-title font-medium mt-md"
        style={{ color: "var(--color-text-primary)" }}
      >
        Run Assessment
      </h1>

      {/* Step 1: Select drill */}
      <div className="mt-2xl">
        <p
          className="label-micro"
          style={{ color: "var(--color-text-secondary)" }}
        >
          1. Pick a drill
        </p>

        {drills.length === 0 ? (
          <div
            className="mt-md p-2xl rounded-lg text-center"
            style={{
              backgroundColor: "var(--color-surface-base)",
              border: "1px dashed var(--color-border-default)",
            }}
          >
            <p
              className="text-body"
              style={{ color: "var(--color-text-secondary)" }}
            >
              No benchmark drills yet. Flag a drill as timed or rated from the
              drill library.
            </p>
            <Link
              href="/drills"
              className="inline-block mt-lg rounded-pill text-caption font-medium no-underline"
              style={{
                padding: "10px 16px",
                backgroundColor: "var(--color-orange-500)",
                color: "#FFFFFF",
                letterSpacing: "0.3px",
              }}
            >
              Go to Drills
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-sm mt-md">
            {drills.map((d) => {
              const selected = d.id === selectedDrillId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDrillId(d.id)}
                  aria-pressed={selected}
                  className="p-lg rounded-lg text-left transition-all"
                  style={{
                    backgroundColor: selected
                      ? "#5C3308"
                      : "var(--color-surface-base)",
                    border: selected
                      ? "1px solid #D48A30"
                      : "1px solid var(--color-border-subtle)",
                    minHeight: "44px",
                  }}
                >
                  <div className="flex items-start justify-between gap-md">
                    <p
                      className="text-heading font-medium"
                      style={{
                        color: selected ? "#F0B870" : "var(--color-text-primary)",
                      }}
                    >
                      {d.name}
                    </p>
                    <div className="flex items-center gap-xs flex-wrap justify-end">
                      {d.benchmarkTypes.map((t) => (
                        <span
                          key={t}
                          className="label-micro rounded-pill flex-shrink-0"
                          style={{
                            padding: "2px 8px",
                            backgroundColor: "#5C3308",
                            color: "#F0B870",
                            border: "1px solid #D48A30",
                          }}
                        >
                          {BENCH_BY_ID[t]?.label ?? t}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: Select players */}
      {selectedDrillId && (
        <div className="mt-3xl">
          <div className="flex items-center justify-between">
            <p
              className="label-micro"
              style={{ color: "var(--color-text-secondary)" }}
            >
              2. Pick players ({selectedPlayerIds.size} selected)
            </p>
            {players.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-caption font-medium"
                style={{
                  color: "var(--color-orange-400)",
                  minHeight: "44px",
                  padding: "0 4px",
                }}
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            )}
          </div>

          {players.length === 0 ? (
            <div
              className="mt-md p-2xl rounded-lg text-center"
              style={{
                backgroundColor: "var(--color-surface-base)",
                border: "1px dashed var(--color-border-default)",
              }}
            >
              <p
                className="text-body"
                style={{ color: "var(--color-text-secondary)" }}
              >
                No active players on the roster.
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
          ) : (
            <div className="flex flex-col gap-sm mt-md">
              {players.map((p) => {
                const selected = selectedPlayerIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlayer(p.id)}
                    aria-pressed={selected}
                    className="p-lg rounded-lg text-left transition-all"
                    style={{
                      backgroundColor: selected
                        ? "#5C3308"
                        : "var(--color-surface-base)",
                      border: selected
                        ? "1px solid #D48A30"
                        : "1px solid var(--color-border-subtle)",
                      minHeight: "44px",
                    }}
                  >
                    <p
                      className="text-heading font-medium"
                      style={{
                        color: selected
                          ? "#F0B870"
                          : "var(--color-text-primary)",
                      }}
                    >
                      {p.name}
                    </p>
                    {p.positions.length > 0 && (
                      <div className="flex items-center gap-xs mt-sm flex-wrap">
                        {p.positions.map((pos) => (
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
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Start */}
      {selectedDrillId && selectedPlayerIds.size > 0 && (
        <div className="mt-3xl">
          <button
            type="button"
            onClick={start}
            className="w-full py-lg rounded-xl text-body font-medium tracking-wide"
            style={{
              backgroundColor: "var(--color-orange-500)",
              color: "#FFFFFF",
              letterSpacing: "0.3px",
            }}
          >
            Start Assessment
          </button>
        </div>
      )}
    </div>
  );
}
