# Build 1b: Drill Create + Detail Pages

Read `CLAUDE.md` for design system and patterns. Read `../CLAUDE.md` for product context (Coach/Team Management MVP section, specifically "1. Drill Library" under MVP Features). Read `../qb_supabase_full_package/docs/coach_mvp_schema_spec.md` for the `team_drills` and `drill_categories` table schemas.

Look at how `/drills/page.tsx` works (server component + client component pattern) as a reference for the architecture.

## Task: Build two pages

### 1. Create Drill Page (`/drills/new/page.tsx`)

A form to create a new drill. Single scrollable page, not multi-screen.

**Fields:**
- Drill name (required text input)
- Category (pill selector, populated from `drill_categories` table sorted by display_order)
- Description (textarea, placeholder: "How to run this drill, coaching cues...")
- Source URL (optional text input, placeholder: "Paste a TikTok, Instagram, or YouTube link")
- Benchmark type (pills: "None", "Timed", "Rated". Default "None")
- Equipment (optional text input, placeholder: "e.g., agility ladder, resistance bands")

**Buttons at bottom:**
- "Save as Draft" (secondary style: surface-raised background, border-default border, text-primary text)
- "Publish" (primary: orange-500 background, white text)

**On submit:**
- Insert into `team_drills`: team_id (from team context), created_by (current user id), drill_name, category_id, description, source_url, benchmark_type (null if "None", otherwise "timed" or "rated"), equipment (store as jsonb: `{"other": ["agility ladder"]}` or null if empty), status ("draft" or "published" based on which button was clicked)
- On success: redirect to `/drills`
- On error: show inline error message

**Architecture:**
- Server component wrapper that fetches categories and passes them as props
- Client component for the form with state management
- Use the same auth + team membership check pattern as the drills list page

### 2. Drill Detail Page (`/drills/[id]/page.tsx`)

A read-only view of a single drill.

**Layout:**
- Back link at top: "← Back to Drills" (links to `/drills`, use text-secondary color)
- Drill name as large heading (text-title, font-medium)
- Row of badges: category pill + benchmark type pill (if set) + "Draft" badge (if draft status)
- Description section (text-body, text-secondary for the label, text-primary for content)
- Source URL (if present): tappable link with external icon, opens in new tab. Style as orange-400 text.
- Equipment (if present): listed below description
- Setup instructions placeholder: dashed border card saying "Diagram builder coming soon"
- "Edit" button at bottom (full-width, primary orange style) → navigates to `/drills/[id]/edit`

**Data fetching:**
- Server component
- Query: `supabase.from('team_drills').select('*, drill_categories(category_name)').eq('id', params.id).single()`
- Verify the drill belongs to the user's team (compare team_id). If not, redirect to /drills.

### 3. Edit Drill Page (`/drills/[id]/edit/page.tsx`)

Same form as create, but pre-populated with existing drill data.

**Differences from create:**
- Page title: "Edit Drill" instead of "Create Drill"
- Fields pre-filled with existing values
- If currently published: show "Unpublish" button (secondary style) that sets status to "draft", and "Save" button (primary) that keeps current status
- If currently draft: show "Save Draft" and "Publish" buttons (same as create page)
- Uses `supabase.from('team_drills').update({...}).eq('id', drillId)` instead of insert

## Design rules reminder
- Dark mode always. Cards: surface-raised. Background: surface-base.
- Two font weights: normal (400) and medium (500). Never bold.
- Orange = interactive. Touch targets 44px minimum.
- Pills selected state: bg #5C3308, text #F0B870, border #D48A30.
- Pills unselected: bg rgba(255,255,255,0.04), text rgba(255,255,255,0.45), border rgba(255,255,255,0.08).
- Screen padding: px-xl (20px).
