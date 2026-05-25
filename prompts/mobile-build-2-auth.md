# Mobile Build 2: Supabase Client + Auth Screens

Read `unlock-mobile/CLAUDE.md` for project context and design system. Read `unlock-app/src/lib/supabase/client.ts` and `unlock-app/src/app/login/page.tsx` and `unlock-app/src/app/signup/page.tsx` for the web implementations to port.

## Context

The Expo project is scaffolded with tab navigation and the design system. This build adds the Supabase client (configured for React Native with expo-secure-store for token persistence), an auth context provider, and the login/signup screens. After this build, users can create accounts and sign in.

## Task 1: Supabase client for React Native

Create `lib/supabase.ts`:

```typescript
import "react-native-url-polyfill/dist/setup";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

Install the URL polyfill if not already installed:
```bash
npm install react-native-url-polyfill
```

Create `.env` (gitignored) with placeholder values:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Task 2: Auth context provider

Create `lib/auth-context.tsx`:

- Create an AuthContext that provides: `session` (Session | null), `user` (User | null), `loading` (boolean), `signOut` function
- On mount, call `supabase.auth.getSession()` to check for existing session
- Subscribe to `supabase.auth.onAuthStateChange` to react to login/logout/token refresh
- Clean up the subscription on unmount
- While loading (checking initial session), show nothing or a loading indicator

Wrap the root layout (`app/_layout.tsx`) with the AuthProvider.

## Task 3: Auth-gated routing

Update `app/_layout.tsx` to handle auth routing:

- If `loading` is true: show a full-screen loading view (surface-base background, optional spinner or app logo)
- If no session: render the `(auth)` group (login/signup screens)
- If session exists: render the `(tabs)` group (main app)

Use Expo Router's `<Redirect>` component or `router.replace()` for navigation based on auth state. The simplest pattern:

```typescript
import { useAuth } from "@/lib/auth-context";
import { Redirect, Stack } from "expo-router";

export default function RootLayout() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {session ? (
        <Stack.Screen name="(tabs)" />
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
}
```

Note: The team-setup check (does user have a team?) comes in Build 3. For now, any authenticated user goes straight to tabs.

## Task 4: Login screen

Create `app/(auth)/login.tsx`:

- Centered card on surface-base background (same layout as web login)
- App name "Unlock Flag Football" at top (text-title, font-medium, text-primary)
- Email input (use the Input component from Build 1)
- Password input (secureTextEntry prop on TextInput)
- "Sign In" primary button (orange-500, full width)
- Loading state on button while auth request is in flight (disable button, show "Signing in...")
- Error message display below the form (text-caption, error color) for wrong password, user not found, etc.
- "Don't have an account? Sign up" link at bottom, navigates to signup screen
- KeyboardAvoidingView wrapper so the form stays visible when the keyboard opens

On submit:
```typescript
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) setError(error.message);
// Auth state change listener in the context handles the redirect automatically
```

## Task 5: Signup screen

Create `app/(auth)/signup.tsx`:

- Same card layout as login
- App name at top
- Email input
- Password input (secureTextEntry)
- Confirm password input (secureTextEntry) — validate match before submitting
- "Create Account" primary button
- Loading state while request is in flight
- Error message display
- "Already have an account? Sign in" link at bottom

On submit:
```typescript
const { error } = await supabase.auth.signUp({ email, password });
if (error) setError(error.message);
// On success, the auth state change fires and the root layout redirects to tabs
```

## Task 6: Auth group layout

Create `app/(auth)/_layout.tsx`:

- Stack navigator with no header
- surface-base background
- Screens: login, signup

## Design rules

- Dark mode. surface-base background, surface-raised card.
- Two font weights only: normal (400) and medium (500).
- Orange-500 for the primary CTA button.
- Error messages in error color (#EF4444), text-caption size.
- Screen padding: 20px horizontal (px-xl).
- Card padding: 16px (p-lg).
- Inputs: 44px minimum height.
- Buttons: 52px height, full width.
- Use `KeyboardAvoidingView` with `behavior="padding"` on iOS, `behavior="height"` on Android.

## Testing

1. Run `npx expo start`. Open on simulator/emulator.
2. App should show the login screen (no session yet).
3. Tap "Sign up" link. Should navigate to signup screen.
4. Create an account. On success, should redirect to the tab navigator (dashboard placeholder).
5. Close and reopen the app. Should still be logged in (session persisted via secure store).
6. Sign out (we'll add a sign out button later, but test by clearing secure store or calling `supabase.auth.signOut()` from a temporary button).
7. After sign out, should redirect back to login.
8. Try signing in with wrong password. Error message should appear.
9. Try signing up with mismatched passwords. Client-side validation should catch it.
