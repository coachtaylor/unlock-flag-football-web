import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function MarketingHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div
      className="mx-auto flex flex-col items-center justify-center text-center"
      style={{
        maxWidth: "720px",
        paddingInline: "20px",
        paddingBlock: "96px",
        minHeight: "calc(100dvh - 64px - 64px)",
      }}
    >
      <p
        className="label-micro"
        style={{ color: "var(--color-orange-300)" }}
      >
        [PLACEHOLDER] Coming soon
      </p>
      <h1
        className="text-display font-medium mt-md"
        style={{ color: "var(--color-text-primary)" }}
      >
        Train smarter. Track everything that matters.
      </h1>
      <p
        className="text-body mt-lg"
        style={{ color: "var(--color-text-secondary)", maxWidth: "520px" }}
      >
        [PLACEHOLDER] Unlock Flag Football helps captains run better
        practices and helps QBs become better players — workouts, throwing
        health, game performance, and football IQ in one place.
      </p>

      <div className="flex items-center gap-md mt-2xl">
        {user ? (
          <Link
            href="/dashboard"
            className="px-2xl py-md rounded-pill text-body font-medium no-underline"
            style={{
              backgroundColor: "var(--color-orange-500)",
              color: "var(--color-text-primary)",
              minHeight: "44px",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Go to dashboard →
          </Link>
        ) : (
          <>
            <Link
              href="/signup"
              className="px-2xl py-md rounded-pill text-body font-medium no-underline"
              style={{
                backgroundColor: "var(--color-orange-500)",
                color: "var(--color-text-primary)",
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="px-2xl py-md rounded-pill text-body font-medium no-underline"
              style={{
                backgroundColor: "transparent",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Log in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
