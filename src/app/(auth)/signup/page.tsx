"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/team-setup`,
      },
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    window.location.assign("/team-setup");
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
        <h1 className="text-title mb-xs">Create your account</h1>
        <p className="text-caption mb-2xl" style={{ color: "var(--color-text-secondary)" }}>
          Track workouts, throws, games, and football IQ in one place.
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
              autoComplete="new-password"
              required
              minLength={6}
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
            <p className="text-micro" style={{ color: "var(--color-text-muted)" }}>
              At least 6 characters.
            </p>
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
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-caption mt-xl text-center" style={{ color: "var(--color-text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--color-orange-400)" }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
