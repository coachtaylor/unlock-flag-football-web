import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { TeamProvider } from "@/lib/team-context";
import { createClient } from "@/lib/supabase/server";

// PWA metadata — this sets the app name, description, and theme color
// that show up when someone installs the app to their home screen.
export const metadata: Metadata = {
  title: "Unlock Flag Football",
  description:
    "Track your development. Know what to focus on. Become a better QB.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Unlock FF",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
        className="flex flex-col"
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
          <main
            className="flex-1 overflow-y-auto px-xl"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom:
                "calc(72px + env(safe-area-inset-bottom) + var(--spacing-2xl))",
            }}
          >
            {children}
          </main>
          <BottomNav />
        </TeamProvider>
      </body>
    </html>
  );
}
