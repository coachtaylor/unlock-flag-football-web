import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideOnboarding, isOnboardingPath } from "@/lib/onboarding/state";

// Public paths: every signed-out user is allowed in.
const PUBLIC_PATHS = new Set<string>([
  "/",
  "/login",
  "/signup",
  "/check-email",
]);

// Routes that bounce a signed-in user back to /dashboard.
const AUTH_BOUNCE_PATHS = new Set<string>(["/login", "/signup"]);

// Stale legacy routes — redirect to their new equivalents.
const LEGACY_REDIRECTS: Record<string, string> = {
  "/team-setup": "/onboarding/scope",
  "/onboarding": "/dashboard", // legacy QB onboarding lives under _paused
};

// Paths that bypass the per-request profile fetch. Onboarding routes
// need the check (they decide whether to bounce); marketing/auth do not.
const SKIP_PROFILE_CHECK = (path: string) =>
  PUBLIC_PATHS.has(path) ||
  path.startsWith("/auth/") ||
  path.startsWith("/_next/") ||
  path === "/favicon.ico";

function isPublic(path: string) {
  if (PUBLIC_PATHS.has(path)) return true;
  if (path.startsWith("/auth/")) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  // Legacy URL redirects — handled before any auth work, so even
  // signed-out users land on the new equivalents (then /login bounces
  // them if they need auth).
  if (LEGACY_REDIRECTS[path]) {
    const url = request.nextUrl.clone();
    url.pathname = LEGACY_REDIRECTS[path];
    url.search = "";
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isPublic(path)) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Signed-in user on /login or /signup → bounce to /dashboard.
  if (AUTH_BOUNCE_PATHS.has(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (SKIP_PROFILE_CHECK(path)) return supabaseResponse;

  // Cached short-circuit: once a user has completed onboarding, set a
  // cookie so we don't hit the profile table on every authenticated
  // request. Cleared when the user re-enters onboarding via legacy
  // redirect (above) or by signing out (cookies flushed).
  const onbCookie = request.cookies.get("uff_onb")?.value;
  if (onbCookie === "done" && !isOnboardingPath(path)) {
    return supabaseResponse;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, onboarding_step, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  const decision = decideOnboarding(profile);

  if (decision.kind === "needs-onboarding") {
    // Allow the user to navigate freely WITHIN /onboarding/*. Only
    // bounce when they're trying to reach something outside it.
    if (isOnboardingPath(path)) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = decision.nextPath;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Onboarding complete. Re-entering /onboarding/* is a defensive no-op
  // (each onboarding page does its own redirect to /dashboard).
  // Set the short-circuit cookie so future requests skip the DB hit.
  supabaseResponse.cookies.set("uff_onb", "done", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
