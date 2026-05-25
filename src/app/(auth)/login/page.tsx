"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import AuthField from "@/components/auth/AuthField";

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
    <div style={{ width: "100%", maxWidth: 440 }}>
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
        Welcome back
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
        Log in to keep
        <br />
        tracking your team.
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-secondary)",
          textAlign: "center",
          marginBottom: 36,
        }}
      >
        Same login as the mobile app.
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
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
            rightLabel={
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  letterSpacing: 0,
                }}
              >
                Forgot?
              </span>
            }
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
            {submitting ? "Signing in…" : "Sign in"}
          </button>
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
          Don&rsquo;t have an account?{" "}
          <Link
            href="/signup"
            style={{
              color: "var(--accent)",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Create one
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <a
          href="#"
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            textDecoration: "none",
          }}
        >
          Forgot your password?
        </a>
      </div>
    </div>
  );
}
