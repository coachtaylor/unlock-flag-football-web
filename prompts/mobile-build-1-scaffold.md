# Mobile Build 1: Project Scaffolding + Design System

## Context

We're building a React Native (Expo) version of Unlock Flag Football. The Supabase backend is already built and doesn't change. This build scaffolds the project, installs all dependencies, configures the design system, creates reusable UI primitives, and sets up tab navigation with placeholder screens.

The app should be created as a NEW directory called `unlock-mobile` at the same level as `unlock-app` (inside `qb_supabase_database/`).

## Step 1: Create the Expo project

```bash
cd qb_supabase_database
npx create-expo-app@latest unlock-mobile --template blank-typescript
cd unlock-mobile
```

## Step 2: Install dependencies

```bash
# Navigation (Expo Router)
npx expo install expo-router expo-linking expo-constants expo-status-bar

# UI essentials
npx expo install react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated

# NativeWind (Tailwind for React Native)
npm install nativewind tailwindcss

# Supabase
npm install @supabase/supabase-js

# Secure storage for auth tokens
npx expo install expo-secure-store

# Async storage for preferences
npx expo install @react-native-async-storage/async-storage

# SVG (for diagram builder later)
npx expo install react-native-svg

# Icons
npx expo install @expo/vector-icons

# Haptics
npx expo install expo-haptics
```

## Step 3: Configure Expo Router

Update `app.json` (or create `app.config.ts`):

```json
{
  "expo": {
    "name": "Unlock Flag Football",
    "slug": "unlock-flag-football",
    "version": "1.0.0",
    "scheme": "unlock",
    "platforms": ["ios", "android"],
    "ios": {
      "bundleIdentifier": "com.unlockflagfootball.app",
      "supportsTablet": false
    },
    "android": {
      "package": "com.unlockflagfootball.app",
      "adaptiveIcon": {
        "backgroundColor": "#0D1117"
      }
    },
    "plugins": [
      "expo-router",
      "expo-secure-store"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

Update `package.json` to set the entry point:
```json
{
  "main": "expo-router/entry"
}
```

## Step 4: Configure NativeWind + Tailwind

Create `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Surfaces
        "surface-base": "#0D1117",
        "surface-raised": "#161C24",
        "surface-overlay": "#1E2530",

        // Text
        "text-primary": "rgba(255, 255, 255, 0.92)",
        "text-secondary": "rgba(255, 255, 255, 0.60)",
        "text-muted": "rgba(255, 255, 255, 0.35)",

        // Borders
        "border-subtle": "rgba(255, 255, 255, 0.06)",
        "border-default": "rgba(255, 255, 255, 0.10)",
        "border-strong": "rgba(255, 255, 255, 0.20)",

        // Orange (primary accent)
        "orange-400": "#F0B870",
        "orange-500": "#D48A30",
        "orange-600": "#5C3308",

        // Green (positive)
        "green-400": "#4ADE80",
        "green-600": "#16A34A",
        "green-800": "#14532D",

        // Blue (data)
        "blue-400": "#60A5FA",
        "blue-600": "#2563EB",
        "blue-800": "#1E3A5F",

        // Indigo (education)
        "indigo-400": "#818CF8",
        "indigo-800": "#312E81",

        // Error
        "error": "#EF4444",
        "error-light": "#FCA5A5",
      },
      spacing: {
        "xs": "4px",
        "sm": "8px",
        "md": "12px",
        "lg": "16px",
        "xl": "20px",
        "2xl": "24px",
        "3xl": "32px",
      },
      borderRadius: {
        "sm": "6px",
        "md": "8px",
        "lg": "12px",
        "xl": "14px",
        "pill": "20px",
      },
      fontSize: {
        "micro": ["11px", { lineHeight: "14px", letterSpacing: "0.5px" }],
        "caption": ["13px", { lineHeight: "18px" }],
        "body": ["15px", { lineHeight: "22px" }],
        "heading": ["17px", { lineHeight: "24px" }],
        "title": ["20px", { lineHeight: "28px" }],
        "stat": ["28px", { lineHeight: "34px" }],
        "display": ["24px", { lineHeight: "30px" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

Create `global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `nativewind-env.d.ts`:

```typescript
/// <reference types="nativewind/types" />
```

Update `metro.config.js` for NativeWind:

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

Create `babel.config.js`:

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-reanimated/plugin",
    ],
  };
};
```

## Step 5: Design tokens as JS constants

Create `constants/design.ts`:

```typescript
export const colors = {
  surface: {
    base: "#0D1117",
    raised: "#161C24",
    overlay: "#1E2530",
  },
  text: {
    primary: "rgba(255, 255, 255, 0.92)",
    secondary: "rgba(255, 255, 255, 0.60)",
    muted: "rgba(255, 255, 255, 0.35)",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.06)",
    default: "rgba(255, 255, 255, 0.10)",
    strong: "rgba(255, 255, 255, 0.20)",
  },
  orange: {
    400: "#F0B870",
    500: "#D48A30",
    600: "#5C3308",
  },
  green: {
    400: "#4ADE80",
    600: "#16A34A",
    800: "#14532D",
  },
  blue: {
    400: "#60A5FA",
    600: "#2563EB",
    800: "#1E3A5F",
  },
  error: "#EF4444",
  errorLight: "#FCA5A5",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 14,
  pill: 20,
  full: 9999,
} as const;

// Two weights only: 400 and 500. Never use bold.
export const fontWeight = {
  normal: "400" as const,
  medium: "500" as const,
};
```

## Step 6: Reusable UI components

Create `components/ui/Button.tsx`:
- Primary variant: orange-500 background, white text, full width, 52px height, rounded-xl
- Secondary variant: surface-raised background, text-primary, border-default
- Destructive variant: transparent background, error color text
- All variants: font-medium, text-body, 44px minimum touch target
- Press state: opacity 0.9

Create `components/ui/Card.tsx`:
- Surface variant: surface-raised background, rounded-lg, padding-lg
- Outlined variant: surface-base background, border-subtle border, rounded-lg, padding-lg
- Accent variant: accepts a color prop (green, blue, orange), uses the 800-shade background + 600-shade border

Create `components/ui/Tag.tsx`:
- Unselected: rgba(255,255,255,0.04) background, rgba(255,255,255,0.45) text, rgba(255,255,255,0.08) border, rounded-pill
- Selected: orange-600 background, orange-400 text, orange-500 border, rounded-pill
- 44px minimum height, horizontal padding 14px
- onPress prop, aria/accessibility labels

Create `components/ui/Input.tsx`:
- TextInput wrapper: surface-base background, border-default border, rounded-md, text-body, text-primary color
- Placeholder color: text-muted
- Label prop rendered above as label-micro style (11px, uppercase, letter-spacing, text-secondary)
- 44px minimum height

Create `components/ui/TextArea.tsx`:
- Same styling as Input but multiline, minimum height 88px

## Step 7: Root layout

Create `app/_layout.tsx`:

```typescript
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import "../global.css";

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0D1117" }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0D1117" },
          animation: "slide_from_right",
        }}
      />
    </View>
  );
}
```

## Step 8: Tab navigation

Create `app/(tabs)/_layout.tsx`:

Bottom tab navigator with 4 tabs:
1. **Dashboard** — icon: `home-outline` / `home` (active), route: `index`
2. **Drills** — icon: `football-outline` / `football` (active), route: `drills`
3. **Roster** — icon: `people-outline` / `people` (active), route: `roster`
4. **Practice** — icon: `clipboard-outline` / `clipboard` (active), route: `practice`

Tab bar styling:
- Background: surface-raised (#161C24)
- Border top: border-subtle
- Active tint: orange-500 (#D48A30)
- Inactive tint: text-muted (rgba(255,255,255,0.35))
- Labels: 11px, font-medium
- Tab bar height: ~60px (enough for icon + label + safe area)

## Step 9: Placeholder screens

Create placeholder screens for each tab that just show the tab name centered in text-title style on a surface-base background:

- `app/(tabs)/index.tsx` — "Dashboard"
- `app/(tabs)/drills/index.tsx` — "Drills"
- `app/(tabs)/roster/index.tsx` — "Roster"
- `app/(tabs)/practice/index.tsx` — "Practice"

Also create placeholder auth screens:
- `app/(auth)/_layout.tsx` — Stack layout, no header
- `app/(auth)/login.tsx` — "Login" placeholder
- `app/(auth)/signup.tsx` — "Signup" placeholder

## Step 10: Create CLAUDE.md for the mobile project

Create `unlock-mobile/CLAUDE.md` with:
- Project context (React Native Expo port of the web app)
- Tech stack summary
- Project structure
- Design system quick reference (referencing constants/design.ts and tailwind.config.ts)
- Supabase connection info (env vars: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)
- Note that the database schema is documented in `../qb_supabase_full_package/docs/coach_mvp_schema_spec.md`
- Build order reference (link to mobile-build-plan.md)

## Testing

After this build:
1. `npx expo start` should launch the dev server
2. Opening on iOS simulator or Android emulator shows the tab navigator with 4 tabs
3. Each tab shows its placeholder text centered on the dark background
4. The tab bar has the correct colors and icons
5. NativeWind classes work (test by adding `className="bg-surface-raised"` to a View)
