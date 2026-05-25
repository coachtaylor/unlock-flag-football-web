# Build 2a: Roster List + Add Player

Read `CLAUDE.md` for design system and patterns. Read `../CLAUDE.md` for product context (Coach/Team Management MVP section, specifically "2. Roster" under MVP Features). Read `../qb_supabase_full_package/docs/coach_mvp_schema_spec.md` for the `team_players` table schema.

Look at how `/drills/page.tsx` works (server component fetches data, passes to client component) as a reference.

## Context

The roster is a simple player list. Players are NOT app users. They're people who show up to practice. Captains add them manually. Positions are stored as a text array because flag football players often play multiple positions. All three captains are also players and need roster records so they can be benchmarked.

## Task: Build two pages

### 1. Roster List Page (`/roster/page.tsx`)

**Layout:**
- Header: "Roster" title + "Add Player" button (orange-500, right-aligned)
- Player count subtitle: "15 players" (text-caption, text-secondary)
- Player cards: one outlined card per player from `team_players` where team_id matches and status = 'active'
  - Each card shows: player_name (text-heading, font-medium), positions as small pills (use text-micro size, muted style), jersey number if set (right-aligned, text-muted)
  - Tap a card → navigate to `/roster/[id]`
- Inactive players section: if any players have status = 'inactive', show them below in a collapsed section with a "Show inactive" toggle. Dimmed styling.
- Empty state: "No players on the roster yet. Add your first player." with an "Add Player" button.

**Data query:**
```
supabase.from('team_players')
  .select('id, player_name, positions, jersey_number, status')
  .eq('team_id', teamId)
  .order('player_name')
```

**Architecture:**
- Server component for auth + team check + data fetching
- Client component for the list (handles the inactive toggle)

### 2. Add Player Page (`/roster/new/page.tsx`)

A simple form to add a player to the roster.

**Fields:**
- Player name (required text input)
- Positions (multi-select pills). Options: QB, WR, RB, C, CB, S, LB, DE, Rusher. Multiple can be selected.
- Jersey number (optional text input, short width)
- Notes (optional textarea, placeholder: "Any notes about this player...")

**Button:**
- "Add Player" (primary orange CTA, full-width)
- After successful add: redirect back to `/roster`

**On submit:**
```
supabase.from('team_players').insert({
  team_id: teamId,
  player_name: name,
  positions: selectedPositions, // text array like ["WR", "CB"]
  jersey_number: jerseyNumber || null,
  notes: notes || null,
  status: 'active'
})
```

**Architecture:**
- Server component wrapper (auth + team check)
- Client component for the form

## Design rules reminder
- Dark mode always. Cards: surface-raised. Outlined cards: surface-base + border-subtle.
- Two font weights: normal (400) and medium (500). Never bold.
- Orange = interactive. Touch targets 44px minimum.
- Multi-select pills: selected = orange (bg #5C3308, text #F0B870, border #D48A30). Unselected = muted.
- Screen padding: px-xl (20px).
- Position pills on player cards should be small (text-micro or text-caption) and use the unselected/muted pill style since they're informational, not interactive.
