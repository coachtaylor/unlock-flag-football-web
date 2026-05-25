import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/app/Sidebar";
import BackfillMount from "@/components/BackfillMount";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100dvh" }}>
      <Sidebar />

      <main
        className="md:ml-[240px] md:pb-3xl"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom:
            "calc(72px + env(safe-area-inset-bottom) + var(--spacing-2xl))",
        }}
      >
        <div
          className="mx-auto px-xl md:px-[32px]"
          style={{ maxWidth: "1280px" }}
        >
          {children}
        </div>
      </main>

      <BottomNav />
      <BackfillMount />
    </div>
  );
}
