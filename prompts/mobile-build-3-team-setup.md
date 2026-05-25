# Mobile Build 3: Team Setup + Team Context

Read `unlock-mobile/CLAUDE.md` for project context and design system. Read `unlock-app/src/app/team-setup/page.tsx` and `unlock-app/src/lib/team-context.tsx` for the web implementations to port.

## Context

Authenticated users need a team before they can use the app. This build adds the team creation flow and the shared team context provider that every screen depends on. After this build, a new user signs up, creates a team, and lands on the dashboard with their team context loaded.

## Task 1: Team context provider

Create `lib/team-context.tsx`:

Port the web version's team context. This provides `teamId`, `teamName`, and `userRole` to all screens.

On mount:
1. Get the current user from `supabase.auth.getUser()`
2. Query `team_members` joined with `teams` to find the user's team:
   ```typescript
   const { data } = await supabase
     .from("team_members")
     .select("team_id, role, teams(team_name)")
     .eq("user_id", user.id)
     .limit(1)
     .single();
   ```
3. If found, set teamId, teamName, userRole in state
4. If not found, set a `hasTeam: false` flag
5. Expose a `loading` boolean while the query runs
6. Expose a `refreshTeam()` function that re-runs the query (called after team creation)

Wrap the tab layout with this provider.

## Task 2: Auth-to-team routing

Update `app/_layout.tsx` to add a team check after auth:

The flow should be:
1. No session → show auth screens (login/signup)
2. Session exists, checking team → show loading screen
3. Session exists, no team → show team-setup screen
4. Session exists, has team → show tabs

One clean way to do this: the root layout handles auth (session vs no session). The `(tabs)/_layout.tsx` wraps with TeamProvider and handles the team check internally (redirect to team-setup if no team).

Alternatively, add `team-setup` as a screen in the root Stack that shows when `hasTeam` is false.

Pick whichever pattern is simpler with Expo Router. The key requirement: a user without a team membership always lands on team-setup, never on the tabs.

## Task 3: Team setup screen

Create `app/team-setup.tsx`:

Single screen with:
- Header: "Create Your Team" (text-title, font-medium)
- Subtitle: "Set up your team to start tracking players and running benchmarks." (text-body, text-secondary)
- Team name input (Input component, label: "Team Name", placeholder: "e.g., Miami Thunder")
- "Create Team" primary button (orange-500, full width, 52px height)
- Loading state on button while creating
- Error message display

On submit:
```typescript
const { data, error } = await supabase.rpc("create_team_with_member", {
  p_team_name: teamName,
});
```

This RPC function already exists in the database. It creates the team and adds the current user as a "captain" member in one transaction.

On success:
- Call `refreshTeam()` from the team context to reload team data
- Navigate to the main tabs (dashboard)

## Task 4: Sign out

Add a temporary sign-out mechanism so we can test the full auth flow. Simplest option: add a small "Sign Out" button on the dashboard placeholder screen (we'll move it to a proper settings screen later).

```typescript
const handleSignOut = async () => {
  await supabase.auth.signOut();
  // Auth state change listener handles redirect to login
};
```

## Design rules

- Dark mode. surface-base background, surface-raised card for the form area.
- Team setup should feel welcoming and simple. One input, one button.
- Keep the same card-centered layout used on login/signup for visual consistency.
- Screen padding: 20px horizontal.
- KeyboardAvoidingView so the input stays visible when keyboard opens.

## Testing

1. Sign up with a new account. Should be redirected to team-setup (not tabs).
2. Enter a team name and tap "Create Team". Should create the team and land on the dashboard.
3. Close and reopen the app. Should go straight to the dashboard (session persisted, team exists).
4. Tap sign out on the dashboard. Should go back to login.
5. Sign in again. Should go straight to dashboard (team already exists, skip team-setup).
6. Sign up with another new account. Should land on team-setup again (new user, no team).
7. Try creating a team with an empty name. Should show validation error.
