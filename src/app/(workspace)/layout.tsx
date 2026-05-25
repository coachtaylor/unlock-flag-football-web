// Workspace route group: post-onboarding dashboards (user home, league,
// team, add-team). Each page renders its own `.uff-web` shell with a
// context-aware sidebar (user-context vs league-context), so this
// layout adds no chrome of its own — just the backfill mount so the
// modal can appear over any workspace page.

import BackfillMount from "@/components/BackfillMount";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <BackfillMount />
    </>
  );
}
