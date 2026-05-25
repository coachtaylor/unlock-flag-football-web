import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TeamProvider } from "@/lib/team-context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Unlock Flag Football",
  description:
    "Train smarter. Track workouts, throwing health, game performance, and football IQ — with a dashboard that tells you what to focus on next.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0D1117",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialTeamId: string | null = null;
  let initialTeamName: string | null = null;
  let initialUserRole: string | null = null;

  if (user) {
    const { data } = await supabase
      .from("team_members")
      .select("team_id, role, teams(team_name)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (data) {
      const teams = data.teams as
        | { team_name: string }
        | { team_name: string }[]
        | null;
      const name = Array.isArray(teams) ? teams[0]?.team_name : teams?.team_name;
      initialTeamId = data.team_id;
      initialTeamName = name ?? null;
      initialUserRole = data.role;
    }
  }

  return (
    <html lang="en" className="h-full">
      <body
        style={{
          minHeight: "100dvh",
          backgroundColor: "var(--color-surface-base)",
          color: "var(--color-text-primary)",
        }}
      >
        <TeamProvider
          initialTeamId={initialTeamId}
          initialTeamName={initialTeamName}
          initialUserRole={initialUserRole}
        >
          {children}
        </TeamProvider>
      </body>
    </html>
  );
}
