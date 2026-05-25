"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import AuthField from "@/components/auth/AuthField";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
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

    // If Supabase email confirmation is OFF (local dev convention), signUp
    // returns a session immediately — send straight to team setup.
    // If confirmation is ON (production), no session is returned — show the
    // check-email confirmation state.
    if (data.session) {
      window.location.assign("/team-setup");
    } else {
      window.location.assign(`/check-email?email=${encodeURIComponent(email.trim())}`);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 460 }}>
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--accent)",
          letterSpacing: 2,
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        Coach early access · free
      </div>
      <h1
        style={{
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: -1,
          textAlign: "center",
          lineHeight: 1.1,
          marginBottom: 12,
        }}
        className="uff-auth-headline"
      >
        Start planning practices in{" "}
        <span style={{ color: "var(--accent)" }}>30 minutes.</span>
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-secondary)",
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        No card. No setup fee. The next captain meeting is gonna be a flex.
      </p>

      <div className="card-canonical" style={{ padding: 28 }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          <AuthField
            label="Email"
            type="email"
            placeholder="you@captains.fm"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
          <AuthField
            label="Password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            minLength={6}
          />
          <AuthField
            label="Confirm password"
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            required
            minLength={6}
          />

          {error && (
            <p
              style={{
                fontSize: 13,
                color: "var(--uff-red)",
                marginTop: -4,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{
              width: "100%",
              marginTop: 4,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting ? "Creating account…" : "Create account →"}
          </button>

          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              lineHeight: 1.5,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            By creating an account you agree to our{" "}
            <a href="#" style={{ color: "var(--text-secondary)" }}>Terms</a> and{" "}
            <a href="#" style={{ color: "var(--text-secondary)" }}>Privacy</a>.
          </p>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            paddingTop: 20,
            borderTop: "1px solid var(--border-subtle-uff)",
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          Already have an account?{" "}
          <Link
            href="/login"
            style={{
              color: "var(--accent)",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          marginTop: 24,
          fontSize: 11,
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: 1,
          flexWrap: "wrap",
        }}
      >
        <span>● Mobile sync</span>
        <span>● Same data</span>
        <span>● Cancel any time</span>
      </div>
    </div>
  );
}
