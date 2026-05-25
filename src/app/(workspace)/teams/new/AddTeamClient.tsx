"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import DashTopBar from "@/components/dashboard/DashTopBar";
import UserSidebar, { type WorkspaceItem } from "@/components/dashboard/UserSidebar";
import LeagueSidebar from "@/components/dashboard/LeagueSidebar";
import { OnbError } from "@/components/onboarding/shell";
import Segmented from "@/components/uff/Segmented";
import ColorSwatchRow from "@/components/uff/ColorSwatchRow";
import FieldIcon from "@/components/uff/FieldIcon";
import { teamColorHex, type TeamColorId } from "@/components/uff/team-colors";
import { Icon } from "@/components/uff/icons";
import { createTeam } from "./actions";

type UserLeague = {
  id: string;
  league_name: string;
  league_color: string;
  format: string;
};

type Format = "4v4" | "5v5" | "7v7" | "11v11";

type Pick = string | null | undefined; // string = leagueId, null = standalone, undefined = not chosen

export default function AddTeamClient({
  user,
  userLeagues,
  presetLeagueId,
}: {
  user: { firstName: string; lastName: string; email: string };
  userLeagues: UserLeague[];
  presetLeagueId: string | null;
}) {
  // Default pick rules from the design canvas:
  // 0 leagues → null (standalone, no picker)
  // 1 league  → that league pre-selected
  // 2+ leagues → undefined (force a choice)
  // preset    → the preset league, locked
  const initialPick: Pick =
    presetLeagueId !== null
      ? presetLeagueId
      : userLeagues.length === 0
      ? null
      : userLeagues.length === 1
      ? userLeagues[0].id
      : undefined;

  const [pick, setPick] = useState<Pick>(initialPick);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("5v5");
  const [color, setColor] = useState<TeamColorId>("orange");
  const [coachIt, setCoachIt] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = name.trim().length > 0 && pick !== undefined;
  const colorHex = teamColorHex(color);
  const ctxLeague =
    pick && typeof pick === "string"
      ? userLeagues.find((l) => l.id === pick)
      : null;
  const presetLeague = presetLeagueId
    ? userLeagues.find((l) => l.id === presetLeagueId)
    : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await createTeam({
        teamName: name,
        format,
        teamColorId: color,
        leagueId: pick === null ? null : (pick as string),
        coachIt,
      });
      if (result && "error" in result) setError(result.error);
    });
  }

  const initials =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() || "U";

  const workspaces: WorkspaceItem[] = userLeagues.map((l) => ({
    id: l.id,
    kind: "league" as const,
    name: l.league_name,
    color: l.league_color,
  }));

  return (
    <div className="uff-web">
      {ctxLeague ? (
        <LeagueSidebar
          league={{
            id: ctxLeague.id,
            name: ctxLeague.league_name,
            color: ctxLeague.league_color,
            teams: 0,
            members: 0,
          }}
          user={{ firstName: user.firstName, lastName: user.lastName }}
        />
      ) : (
        <UserSidebar
          workspaces={workspaces}
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          }}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DashTopBar
          crumbs={
            presetLeague
              ? [
                  { label: "Workspaces", href: "/dashboard" },
                  { label: presetLeague.league_name, href: `/dashboard/league/${presetLeague.id}` },
                ]
              : [{ label: "Workspaces", href: "/dashboard" }, { label: "Teams" }]
          }
          title="New team"
          kicker={
            presetLeague
              ? `LEAGUE · ${presetLeague.league_name.toUpperCase()}`
              : userLeagues.length === 0
              ? "STANDALONE"
              : userLeagues.length === 1
              ? "1 LEAGUE"
              : `${userLeagues.length} LEAGUES`
          }
          userInitials={initials}
          actions={
            <>
              <Link href="/dashboard" className="wbtn ghost">
                Cancel
              </Link>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!ready || pending}
                className="wbtn primary"
              >
                {pending ? "Creating…" : "Create team"} <Icon.arrowRight size={13} />
              </button>
            </>
          }
        />

        <div
          className="page"
          style={{ maxWidth: 1180, margin: "0 auto", width: "100%" }}
        >
          <ATTitle
            presetLeague={presetLeague}
            leagueCount={userLeagues.length}
          />

          <form
            onSubmit={onSubmit}
            className="addteam-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 720px) 360px",
              gap: 20,
              alignItems: "start",
            }}
          >
            <div
              className="w-card"
              style={{
                padding: 28,
                display: "flex",
                flexDirection: "column",
                gap: 26,
              }}
            >
              {/* 01 — picker */}
              {presetLeague ? (
                <ATSection
                  num="01"
                  label="Where does this team belong?"
                  hint="You came in from a league dashboard. The team will be created inside that league."
                >
                  <LockedLeagueRow league={presetLeague} />
                </ATSection>
              ) : userLeagues.length === 0 ? (
                <ATSection
                  num="01"
                  label="Team scope"
                  hint="You don't have any leagues yet, so this will be a standalone team. You can create a league later from your dashboard."
                >
                  <LockedStandaloneRow />
                </ATSection>
              ) : (
                <ATSection
                  num="01"
                  label="Where does this team belong?"
                  hint={
                    userLeagues.length === 1
                      ? "You admin one league. Pick whether this team joins it or stays standalone."
                      : "Pick a league this team will be part of, or keep it standalone."
                  }
                >
                  <WebLeaguePicker
                    userLeagues={userLeagues}
                    value={pick}
                    onChange={setPick}
                  />
                </ATSection>
              )}

              {/* 02 — team name */}
              <ATSection num="02" label="Team name">
                <input
                  className="fr-input"
                  placeholder="e.g., Miami Thunder"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                />
              </ATSection>

              {/* 03 — format */}
              <ATSection
                num="03"
                label="Game format"
                hint="Your default for game day. You can override per-event later."
              >
                <Segmented<Format>
                  value={format}
                  onChange={setFormat}
                  cols={4}
                  options={[
                    { value: "4v4", label: "4v4", icon: <FieldIcon dots={4} /> },
                    { value: "5v5", label: "5v5", icon: <FieldIcon dots={5} /> },
                    { value: "7v7", label: "7v7", icon: <FieldIcon dots={7} /> },
                    { value: "11v11", label: "11v11" },
                  ]}
                />
              </ATSection>

              {/* 04 — color */}
              <ATSection
                num="04"
                label="Team color"
                right={
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: colorHex,
                      letterSpacing: ".06em",
                    }}
                  >
                    {colorHex}
                  </span>
                }
              >
                <ColorSwatchRow value={color} onChange={setColor} />
              </ATSection>

              {/* 05 — coach toggle (only when joining a league) */}
              {pick && typeof pick === "string" && (
                <ATSection
                  num="05"
                  label="Your role on this team"
                  hint="If you'll coach this team yourself, we'll add you to team_members. Otherwise you'll only see it from the league dashboard as admin."
                >
                  <CoachToggle on={coachIt} onChange={setCoachIt} />
                </ATSection>
              )}

              {error && <OnbError>{error}</OnbError>}
            </div>

            {/* RIGHT — preview + what-happens rails */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                position: "sticky",
                top: 24,
              }}
            >
              <ATPreviewCard
                name={name}
                format={format}
                colorHex={colorHex}
                pick={pick}
                userLeagues={userLeagues}
                coachIt={coachIt}
              />
              <ATWhatHappensCard
                pick={pick}
                userLeagues={userLeagues}
                coachIt={coachIt}
              />
            </div>
          </form>
        </div>

        <style>{`
          @media (max-width: 1024px) {
            .addteam-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

function ATTitle({
  presetLeague,
  leagueCount,
}: {
  presetLeague: UserLeague | null | undefined;
  leagueCount: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "4px 0 12px",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".18em",
          color: "var(--uff-orange)",
        }}
      >
        {presetLeague
          ? `LEAGUE · ${presetLeague.league_name.toUpperCase()}`
          : leagueCount === 0
          ? "STANDALONE · NO LEAGUE"
          : leagueCount === 1
          ? "JOIN OR STAND ALONE"
          : "PICK A LEAGUE"}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: "var(--uff-text)",
        }}
      >
        Add a team
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: "var(--uff-text-dim)",
          lineHeight: 1.5,
          maxWidth: 640,
        }}
      >
        Set the scope and identity. The team&apos;s roster, drills, and practice
        plan all come after.
      </div>
    </div>
  );
}

function ATSection({
  num,
  label,
  hint,
  right,
  children,
}: {
  num: string;
  label: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--uff-text-mute)",
            letterSpacing: ".08em",
          }}
        >
          {num}
        </span>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--uff-text)",
            letterSpacing: "-0.005em",
          }}
        >
          {label}
        </span>
        <span style={{ flex: 1 }} />
        {right}
      </div>
      {children}
      {hint && (
        <div
          style={{
            fontSize: 12,
            color: "var(--uff-text-mute)",
            lineHeight: 1.5,
            paddingLeft: 28,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function WebLeaguePicker({
  userLeagues,
  value,
  onChange,
}: {
  userLeagues: UserLeague[];
  value: Pick;
  onChange: (next: Pick) => void;
}) {
  if (userLeagues.length === 1) {
    const l = userLeagues[0];
    return (
      <div
        className="fr-seg"
        style={{ gridTemplateColumns: "1fr 1fr", padding: 4 }}
      >
        <button
          type="button"
          className={value === l.id ? "on" : ""}
          onClick={() => onChange(l.id)}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: l.league_color,
              display: "inline-block",
            }}
          />
          {l.league_name}
        </button>
        <button
          type="button"
          className={value === null ? "on" : ""}
          onClick={() => onChange(null)}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background:
                "repeating-linear-gradient(135deg, var(--uff-line) 0 3px, transparent 3px 6px)",
              border: "1px solid var(--uff-line)",
              display: "inline-block",
            }}
          />
          Standalone team
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {userLeagues.map((l) => (
        <PickerRow
          key={l.id}
          selected={value === l.id}
          onClick={() => onChange(l.id)}
          color={l.league_color}
          label={l.league_name}
          sub={`Default ${l.format.toUpperCase()}`}
          tag="LEAGUE"
        />
      ))}
      <PickerRow
        selected={value === null}
        onClick={() => onChange(null)}
        color={null}
        label="Standalone team"
        sub="Not part of any league. You'll manage it directly."
        tag="—"
      />
      {value === undefined && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--uff-text-mute)",
            padding: "4px 4px 0",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ color: "var(--uff-orange)" }}>
            <Icon.bolt size={11} />
          </span>
          Pick one to continue — no default selection.
        </div>
      )}
    </div>
  );
}

function PickerRow({
  selected,
  color,
  label,
  sub,
  tag,
  onClick,
}: {
  selected: boolean;
  color: string | null;
  label: string;
  sub: string;
  tag: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        background: "var(--uff-surface-2)",
        border: `1.5px solid ${selected ? "var(--uff-orange)" : "var(--uff-line)"}`,
        borderRadius: 12,
        padding: "14px 16px",
        cursor: "pointer",
        fontFamily: "inherit",
        color: "var(--uff-text)",
        width: "100%",
        boxSizing: "border-box",
        transition: "border-color 120ms ease, background 120ms ease",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      {color ? (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: color,
            color: "#1a0f08",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: "-0.04em",
            flexShrink: 0,
          }}
        >
          {label[0]}
        </div>
      ) : (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background:
              "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 5px, transparent 5px 10px)",
            border: "1px solid var(--uff-line)",
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.005em",
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--uff-text-dim)" }}>{sub}</div>
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--uff-text-mute)",
          letterSpacing: ".14em",
        }}
      >
        {tag}
      </span>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: selected ? "var(--uff-orange)" : "transparent",
          border: selected ? "none" : "1.5px solid var(--uff-line)",
          color: "#0a0a0d",
          display: "grid",
          placeItems: "center",
        }}
      >
        {selected && <Icon.check size={12} />}
      </div>
    </button>
  );
}

function LockedLeagueRow({ league }: { league: UserLeague }) {
  return (
    <div
      style={{
        background: "var(--uff-surface-2)",
        border: "1.5px solid var(--uff-orange)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: league.league_color,
          color: "#1a0f08",
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--font-mono)",
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: "-0.04em",
          flexShrink: 0,
        }}
      >
        {league.league_name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 14, fontWeight: 600, color: "var(--uff-text)" }}
        >
          {league.league_name}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--uff-text-dim)" }}>
          Pre-selected from the league dashboard.
        </div>
      </div>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: ".16em",
          padding: "3px 8px",
          borderRadius: 4,
          background: "rgba(255, 106, 26, 0.14)",
          color: "var(--uff-orange)",
        }}
      >
        LOCKED
      </span>
    </div>
  );
}

function LockedStandaloneRow() {
  return (
    <div
      style={{
        background: "var(--uff-surface-2)",
        border: "1.5px dashed var(--uff-line)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 5px, transparent 5px 10px)",
          border: "1px solid var(--uff-line)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 14, fontWeight: 600, color: "var(--uff-text)" }}
        >
          Standalone team
        </div>
        <div style={{ fontSize: 11.5, color: "var(--uff-text-dim)" }}>
          Picker hidden because you haven&apos;t created any leagues yet.
        </div>
      </div>
    </div>
  );
}

function CoachToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        textAlign: "left",
        background: on
          ? "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 80%), var(--uff-surface-2)"
          : "var(--uff-surface-2)",
        border: `1.5px solid ${on ? "var(--uff-orange)" : "var(--uff-line)"}`,
        borderRadius: 12,
        padding: 14,
        cursor: "pointer",
        fontFamily: "inherit",
        color: "var(--uff-text)",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: on ? "var(--uff-orange)" : "transparent",
          border: on ? "none" : "1.5px solid var(--uff-line)",
          color: "#0a0a0d",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {on && <Icon.check size={13} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          I&apos;ll coach this team myself.
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--uff-text-dim)",
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          Adds you to the team&apos;s coaches. Leave unchecked if another coach
          will run it — you&apos;ll still see it as league admin.
        </div>
      </div>
    </button>
  );
}

function ATPreviewCard({
  name,
  format,
  colorHex,
  pick,
  userLeagues,
  coachIt,
}: {
  name: string;
  format: string;
  colorHex: string;
  pick: Pick;
  userLeagues: UserLeague[];
  coachIt: boolean;
}) {
  const ready = name.trim().length > 0;
  const league =
    pick && typeof pick === "string"
      ? userLeagues.find((l) => l.id === pick)
      : null;
  return (
    <div
      className="w-card"
      style={{
        padding: 0,
        borderTop: `2px solid ${colorHex}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".18em",
            color: "var(--uff-text-mute)",
          }}
        >
          LIVE PREVIEW
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: colorHex,
              color: "#1a0f08",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-mono)",
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: "-0.04em",
              flexShrink: 0,
              boxShadow: `0 8px 24px ${colorHex}30`,
            }}
          >
            {(name.trim()[0] ?? "T").toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: ready ? "var(--uff-text)" : "var(--uff-text-mute)",
                lineHeight: 1.2,
              }}
            >
              {ready ? name : "Your team name"}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--uff-text-dim)",
                letterSpacing: ".06em",
                marginTop: 4,
              }}
            >
              {format.toUpperCase()} ·{" "}
              {pick === null ? "COACH" : coachIt ? "COACH" : "ADMIN ONLY"}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 12,
            background: "var(--uff-surface-2)",
            borderRadius: 10,
            border: "1px solid var(--uff-line-soft)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <SumKV
            label="Scope"
            value={
              league ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: league.league_color,
                    }}
                  />
                  {league.league_name}
                </span>
              ) : pick === null ? (
                "Standalone"
              ) : (
                "—"
              )
            }
            muted={pick === undefined}
          />
          <SumKV label="Format" value={format.toUpperCase()} />
          <SumKV label="Color" value={colorHex} mono />
          <SumKV
            label="Role"
            value={pick === null || coachIt ? "Coach" : "League admin only"}
          />
        </div>
      </div>
    </div>
  );
}

function SumKV({
  label,
  value,
  mono,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".14em",
          color: "var(--uff-text-mute)",
        }}
      >
        {label.toUpperCase()}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          color: muted ? "var(--uff-text-mute)" : "var(--uff-text)",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ATWhatHappensCard({
  pick,
  userLeagues,
  coachIt,
}: {
  pick: Pick;
  userLeagues: UserLeague[];
  coachIt: boolean;
}) {
  const isStandalone = pick === null;
  const league =
    pick && typeof pick === "string"
      ? userLeagues.find((l) => l.id === pick)
      : null;
  return (
    <div className="w-card subdued" style={{ padding: 18 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".18em",
          color: "var(--uff-text-mute)",
          marginBottom: 12,
        }}
      >
        WHAT HAPPENS
      </div>
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <ATStep n={1} done>
          We call <code>create_team_with_member</code>
          {league ? (
            <>
              {" "}
              with{" "}
              <strong style={{ color: "var(--uff-text)" }}>
                {league.league_name}
              </strong>
            </>
          ) : (
            <>, no league</>
          )}
          {league && !coachIt && <>, and don&apos;t add you as a team member</>}.
        </ATStep>
        <ATStep n={2}>
          You land on <code>/dashboard/team/[id]</code> — the new team&apos;s
          dashboard.
        </ATStep>
        <ATStep n={3}>
          {isStandalone ? (
            <>
              The team appears on your account home under{" "}
              <strong style={{ color: "var(--uff-text)" }}>My teams</strong>.
            </>
          ) : (
            <>
              The team appears on{" "}
              <strong style={{ color: "var(--uff-text)" }}>
                {league?.league_name}
              </strong>
              &apos;s league dashboard.
            </>
          )}
        </ATStep>
      </ol>
    </div>
  );
}

function ATStep({
  n,
  done,
  children,
}: {
  n: number;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: done ? "var(--uff-orange)" : "rgba(255,255,255,0.05)",
          color: done ? "#1a0f08" : "var(--uff-text-dim)",
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {n}
      </span>
      <span
        style={{
          fontSize: 12.5,
          color: "var(--uff-text-dim)",
          lineHeight: 1.6,
        }}
      >
        {children}
      </span>
    </li>
  );
}
