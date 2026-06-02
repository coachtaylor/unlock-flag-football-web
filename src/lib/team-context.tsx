"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { isFullAccess } from "@/lib/team/staff-roles";

export type TeamContextValue = {
  teamId: string | null;
  teamName: string | null;
  userRole: string | null;
  /** True for full-access roles; false for view-only (team_manager). */
  canManage: boolean;
  loading: boolean;
};

const TeamContext = createContext<TeamContextValue>({
  teamId: null,
  teamName: null,
  userRole: null,
  canManage: false,
  loading: true,
});

type Props = {
  children: ReactNode;
  initialTeamId?: string | null;
  initialTeamName?: string | null;
  initialUserRole?: string | null;
};

export function TeamProvider({
  children,
  initialTeamId = null,
  initialTeamName = null,
  initialUserRole = null,
}: Props) {
  const [teamId, setTeamId] = useState<string | null>(initialTeamId);
  const [teamName, setTeamName] = useState<string | null>(initialTeamName);
  const [userRole, setUserRole] = useState<string | null>(initialUserRole);
  const [loading, setLoading] = useState(initialTeamId === null);

  useEffect(() => {
    if (initialTeamId) return;

    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, role, teams(team_name)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("[team-context] membership lookup failed", error);
        setLoading(false);
        return;
      }

      if (data) {
        const teams = data.teams as { team_name: string } | { team_name: string }[] | null;
        const name = Array.isArray(teams) ? teams[0]?.team_name : teams?.team_name;
        setTeamId(data.team_id);
        setTeamName(name ?? null);
        setUserRole(data.role);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [initialTeamId]);

  return (
    <TeamContext.Provider
      value={{
        teamId,
        teamName,
        userRole,
        canManage: isFullAccess(userRole),
        loading,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
