"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    if (!data.session) {
      setError("Sign in succeeded but no session was returned. Try again.");
      setSubmitting(false);
      return;
    }

    const userId = data.user?.id;
    let destination = "/team-setup";
    if (userId) {
      try {
        const { data: membership, error: membershipError } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        if (membershipError) {
          console.error("[login] membership lookup failed", membershipError);
        } else if (membership) {
          destination = "/dashboard";
        }
      } catch (err) {
        console.error("[login] membership lookup threw", err);
      }
    }

    window.location.assign(destination);
  }

  return (
    <div className="min-h-full flex items-center justify-center py-3xl">
      <div
        className="rounded-lg p-2xl"
        style={{
          backgroundColor: "var(--color-surface-raised)",
          width: "100%",
          maxWidth: "384px",
        }}
      >
        <h1 className="text-title mb-xs">Welcome back</h1>
        <p className="text-caption mb-2xl" style={{ color: "var(--color-text-secondary)" }}>
          Log in to keep tracking your development.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <div className="flex flex-col gap-xs">
            <label htmlFor="email" className="label-micro" style={{ color: "var(--color-text-secondary)" }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md px-md text-body outline-none transition-colors"
              style={{
                height: "44px",
                backgroundColor: "var(--color-surface-base)",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="password" className="label-micro" style={{ color: "var(--color-text-secondary)" }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md px-md text-body outline-none transition-colors"
              style={{
                height: "44px",
                backgroundColor: "var(--color-surface-base)",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>

          {error && (
            <p className="text-caption" style={{ color: "var(--color-error-light)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-lg rounded-xl text-body font-medium tracking-wide transition-opacity"
            style={{
              backgroundColor: "var(--color-orange-500)",
              color: "#FFFFFF",
              letterSpacing: "0.3px",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="text-caption mt-xl text-center" style={{ color: "var(--color-text-secondary)" }}>
          New here?{" "}
          <Link href="/signup" style={{ color: "var(--color-orange-400)" }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
