import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh" }}>
      <header
        className="sticky top-0 z-40"
        style={{
          backgroundColor: "rgba(13, 17, 23, 0.85)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <div
          className="mx-auto flex items-center justify-between"
          style={{
            maxWidth: "1200px",
            paddingInline: "20px",
            height: "64px",
          }}
        >
          <Link
            href="/"
            className="text-heading font-medium no-underline"
            style={{ color: "var(--color-text-primary)" }}
          >
            Unlock Flag Football
          </Link>
          <nav className="flex items-center gap-md">
            {user ? (
              <Link
                href="/dashboard"
                className="px-lg py-sm rounded-pill text-caption font-medium no-underline"
                style={{
                  backgroundColor: "var(--color-orange-500)",
                  color: "var(--color-text-primary)",
                }}
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-caption font-medium no-underline"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="px-lg py-sm rounded-pill text-caption font-medium no-underline"
                  style={{
                    backgroundColor: "var(--color-orange-500)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer
        style={{
          borderTop: "1px solid var(--color-border-subtle)",
          backgroundColor: "var(--color-surface-base)",
        }}
      >
        <div
          className="mx-auto py-xl text-caption"
          style={{
            maxWidth: "1200px",
            paddingInline: "20px",
            color: "var(--color-text-muted)",
          }}
        >
          © {new Date().getFullYear()} Unlock Flag Football
        </div>
      </footer>
    </div>
  );
}
