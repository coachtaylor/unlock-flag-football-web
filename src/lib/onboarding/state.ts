// Onboarding state helpers. The single source of truth for "where should
// this user be next?" — used by middleware (proxy.ts) and by individual
// onboarding pages as a defensive double-check.
//
// Schema (already applied, migrations 47-52):
//   profiles.first_name              text     nullable
//   profiles.last_name               text     nullable
//   profiles.onboarding_step         smallint NOT NULL default 0
//   profiles.onboarding_completed_at timestamptz nullable

export type OnboardingProfile = {
  first_name: string | null;
  onboarding_step: number | null;
  onboarding_completed_at: string | null;
};

export type OnboardingDecision =
  | { kind: "needs-onboarding"; nextPath: string }
  | { kind: "needs-backfill" } // onboarding done but first_name is null
  | { kind: "done" };

// Pick the onboarding path the user should be on, given their profile.
// `nextPath` is always a route under `/onboarding/`. Branch choices that
// live in the URL (scope, role) cannot be reconstructed from the DB, so
// we always send mid-flow users back to /onboarding/scope to re-pick.
export function decideOnboarding(
  profile: OnboardingProfile | null
): OnboardingDecision {
  if (!profile) {
    return { kind: "needs-onboarding", nextPath: "/onboarding/name" };
  }
  if (profile.onboarding_completed_at) {
    if (!profile.first_name) return { kind: "needs-backfill" };
    return { kind: "done" };
  }
  const step = profile.onboarding_step ?? 0;
  if (step < 1) return { kind: "needs-onboarding", nextPath: "/onboarding/name" };
  // step 1 = name done, scope next
  // step 2 = scope done, but scope choice is URL-only, so always re-pick
  // step 3 = role done, but role + scope live in URL, so re-pick scope
  return { kind: "needs-onboarding", nextPath: "/onboarding/scope" };
}

// All routes that are valid onboarding destinations. Used in proxy.ts to
// detect when the user has wandered off the flow.
export const ONBOARDING_PATHS = [
  "/onboarding/name",
  "/onboarding/scope",
  "/onboarding/role",
  "/onboarding/new-team",
  "/onboarding/create-league",
] as const;

export function isOnboardingPath(path: string): boolean {
  return path.startsWith("/onboarding/");
}
