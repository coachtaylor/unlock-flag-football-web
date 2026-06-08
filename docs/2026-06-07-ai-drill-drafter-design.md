# AI Drill Drafter — Design Spec

**Date:** 2026-06-07
**Status:** Approved (brainstorm) — pre-implementation
**Branch:** `build-11-ai-drill-drafter`
**Repos affected:** `unlock-web`, `unlock-mobile`, Supabase (migrations)

---

## 1. Summary

A Pro-gated feature for coaches: **paste a drill video link (or upload a file) and the AI drafts a structured, source-credited drill** — name, description, coaching cues, equipment, and taxonomy tags (phase + skills). The coach reviews the draft in the existing drill edit form and publishes. One link = one drill.

This is the "Paste a link. It becomes a drill." pattern (reference: playossports.com), built for flag football and constrained to the team's existing drill taxonomy.

**One-line UX:** Paste a link → "Read it in →" → review a pre-filled draft → Publish.

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Video sources | YouTube (native caption fast-path), TikTok, Instagram Reels, uploaded files, generic URLs (best-effort) |
| Signal extraction | Transcript **+ on-screen text (OCR)** fusion. **No full-video vision.** |
| Extraction architecture | **Approach A** — extraction vendor + one cheap multimodal call; YouTube native captions when available |
| Processing model | **Async** job (`ai_drill_jobs`) + Supabase Realtime live status |
| Draft materialization | **Materialize-on-save** — AI output lives on the job row; the `team_drills` row is created when the coach saves (respects "phase required to save", no orphan draft rows) |
| Review UX | Pre-fill the **existing drill edit form**; coach edits → Publish |
| Source crediting | First-class + visible: store + display platform & original author; **never strip the source link, never re-host** |
| Pro gating | Simple **entitlement flag** on the team (`teams.plan`), enforced in server action **and** RLS; Stripe deferred |
| Fair-use cap | ~50 AI jobs / team / month, counted against `ai_drill_jobs` |
| AI diagram generation | **Out of MVP — Phase 2 fast-follow** (see §10) |

---

## 3. Architecture & data flow

```
Coach pastes URL / uploads file  (unlock-web + unlock-mobile)
   │  server action: assertPro(team) + dedupe + fair-use check
   │                 → insert ai_drill_jobs(status=queued)
   ▼
ai_drill_jobs row ──(Supabase Realtime subscribe)──► client shows live status
   │
   ▼  worker picks up job (Edge Function on insert, or pg_cron poll)
   1. resolve URL → platform (youtube|tiktok|instagram|upload|other)
   2. YouTube? → native caption fetch
      else      → extraction vendor → transcript + sampled frames
      upload?   → read file from Supabase Storage
   3. ONE multimodal call: {system(flag-football + taxonomy) + transcript + frames}
        → forced structured output (draft_drill tool)
   4. validate tags against live taxonomy → store draft JSON on the job row
   5. job.status = ready | no_signal | failed ; store cost/tokens
   ▼
client: on `ready` → route to existing edit form PRE-FILLED FROM THE JOB
         on `no_signal`/`failed` → friendly message → manual edit form
   ▼
coach edits → Save  → team_drills row created (status=draft/published)
                      + activity_event logged (attribution)
```

**The job table is the seam.** Swapping the extraction vendor for a self-hosted worker (yt-dlp/ffmpeg/Whisper) later never touches the client.

---

## 4. Data model

Additive only. Reuses `team_drills`; no parallel drill table.

```sql
-- Entitlement (per team, matches per-team pricing)
alter table teams add column plan text not null default 'free';   -- 'free' | 'pro'

-- Drill provenance + visible source credit + coaching cues as a first-class field
alter table team_drills add column source text not null default 'manual';  -- 'manual' | 'ai'
alter table team_drills add column source_platform text;   -- youtube|tiktok|instagram|upload
alter table team_drills add column source_author text;     -- '@handle' / channel name
-- NOTE: source_url already exists on team_drills (confirm at build time).
-- coaching_cues: add only if not already present:
alter table team_drills add column coaching_cues text[] default '{}';

-- The job = queue + provenance + draft payload + feedback, one table
create table ai_drill_jobs (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams(id),
  created_by    uuid not null references profiles(id),   -- ACTOR (resolve via profiles, never team_players)
  source_kind   text not null,                           -- youtube|tiktok|instagram|upload|other
  source_url    text,
  storage_path  text,                                    -- for uploads (one of source_url/storage_path)
  status        text not null default 'queued',
        -- queued | extracting | drafting | ready | no_signal | failed
  draft_json    jsonb,                                   -- the AI's structured output (pre-materialization)
  drill_id      uuid references team_drills(id),         -- set once the coach saves a real drill
  -- provenance / cost
  raw_transcript text,
  raw_ocr        text,
  signal_sources text[],                                 -- which inputs fired
  model          text,
  input_tokens   int,
  output_tokens  int,
  cost_usd       numeric(8,4),
  field_confidence jsonb,                                -- {phase:0.6, skills:0.9, ...}
  -- feedback loop (collect from day 1, act later)
  user_feedback  smallint,                               -- -1 / +1 thumbs
  error_detail   text,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);
```

- `coaching_cues` is a real column so **manual and AI-drafted drills render cues identically** (one field, one display component — DRY). Not an AI-only sidecar.
- Source credit (`source_platform` + `source_author` + existing `source_url`) drives the visible **"VIA {PLATFORM} · {author}"** line. The pipeline is forbidden from ever dropping `source_url`.
- **Materialize-on-save:** the AI's output sits in `ai_drill_jobs.draft_json`. No `team_drills` row exists until the coach saves — so the "phase required to save" constraint is honored naturally and there are no orphan draft rows to clean up.

### RLS
- `ai_drill_jobs`: team-scoped via the **SETOF** pattern — `team_id in (select get_my_team_ids())` for read, `team_id in (select get_my_writable_team_ids())` for write. Never `= ANY(...)`.
- Insert policy additionally requires the team's `plan = 'pro'` (defense in depth with the server-action check).
- `created_by = auth.uid()`.

---

## 5. The pipeline (worker)

1. **Resolve** — detect platform from URL; `upload`/`other` handled explicitly.
2. **Extract**
   - YouTube → native caption track (free, fast).
   - TikTok / Instagram / other → extraction vendor returns transcript + N sampled frames.
   - Upload → pull file from Supabase Storage.
   - **Long-video guard:** 1 link = 1 drill. Cap transcript length and frame count (e.g. ≤6 frames) so a 30-min video doesn't blow up cost. No attempt to split a video into multiple drills.
   - If neither usable transcript nor readable frames → `no_signal`.
3. **Generate** — single multimodal call. System prompt is **flag-football-aware** and embeds the **live taxonomy** (prompt-cached). Model reads on-screen text from frames *and* transcript in one pass.
4. **Validate & store** — drop any tag not in the taxonomy, lower its confidence, write `draft_json` + confidence to the job, set status.

---

## 6. Taxonomy-constrained generation

The model never invents tags. The `draft_drill` tool schema is **built at call time from the live taxonomy** so it can't drift.

```jsonc
{
  "name": "string",
  "description": "string (<=600 chars)",
  "coaching_cues": ["string", ...],         // <=5
  "category": "enum(offense|defense|conditioning|footwork|...)",
  "phase": "enum(<phase_id>...)",           // REQUIRED — phase gates saving
  "skills": ["enum(<skill_id>...)"],        // server keeps only skills valid for the chosen phase
  "equipment": ["string", ...],
  "source_author": "string|null",           // creator handle if detectable
  "confidence": { "<field>": 0.0-1.0 }
}
```

Rules:
- **Phase-then-skill**, mirroring the guided UI: model picks a phase; server accepts only skills scoped to that phase, drops the rest.
- **Domain grounding:** the system prompt forces flag-football-specific cues and taxonomy usage — no generic/other-sport content.
- Low confidence on phase/skills → still drafted, but **flagged into the existing needs-review state** rather than shown as confident.
- `no_signal` → draft carries only `name` (from title) + source; **never fabricate a phase**. The coach picks phase at save.
- Prompt-cache the static taxonomy + system prompt (resent every call → obvious cost win).

---

## 7. UX surface (web + mobile parity)

Mirrors the PlayOS interaction, in UFF voice (End Zone Orange / dark).

1. **Entry points:** Drills list "Add a drill" → choose **"Paste a link"** vs **"Build by hand"**; plus a dashboard quick action.
2. **Paste-a-link card:** URL input with **auto-detected platform badge** (YOUTUBE / TIKTOK / IG / UPLOAD); primary button **"Read it in →"**. Upload variant accepts a video file.
3. **Live status** while the job runs (subscribes to the job row): "Reading the clip… → Drafting…".
4. **Result → review:** on `ready`, route to the existing edit form pre-filled from `draft_json`, including the **"VIA {platform} · {author}"** credit and coaching-points bullets. Coach edits → Save/Publish → "✓ Added to your library · eligible for practice sessions."
5. **Not-a-drill state:** `no_signal` / `failed` → friendly message ("This link doesn't look like a drill — want to add it by hand?") → manual edit form. ("If a link isn't a drill, it tells you.")
6. **"Build one by hand"** = the existing manual create flow, unchanged. AI and manual converge on the same library + edit form (DRY).
7. **Feedback:** thumbs up/down on the drafted drill writes `ai_drill_jobs.user_feedback`.
8. **Retry:** one "re-run" affordance on a bad/failed draft.

"Eligible for practice sessions" = a published drill is automatically usable in the **practice planner** — no extra scope.

---

## 8. Error handling & states

| Case | Behavior |
|---|---|
| Private / geoblocked / unresolvable | `failed` → "couldn't read this clip, add it manually" → manual form |
| No transcript & no readable frames | `no_signal` → name-only draft, coach fills the rest |
| Vendor / AI timeout | retry once with backoff → `failed` |
| Invalid tag from model | dropped server-side, confidence lowered → needs-review |
| Not Pro / over fair-use cap | 403 before any spend; friendly "Pro / monthly limit" message |
| Duplicate link (already in team library by `source_url`) | surface "already in your library" instead of a dupe job |
| Double-submit ("Read it in" tapped twice) | debounce + dedupe by (team, url, recent window) |
| Stale job (worker died mid-run) | reaper marks jobs `failed` after N minutes — no infinite spinner |

---

## 9. Attribution & activity

- `created_by` = the coach who pasted (actor; resolve via `profiles`, never `team_players`).
- On save, log an `activity_event`: "**{coach} drafted a drill via {platform}**" → appears in the team activity feed / bylines (reuses existing attribution infra).

---

## 10. Phase 2 fast-follow — AI diagram generation

Deferred from MVP. Documented so it's a planned phase, not a gap.

- **Approach A:** the AI emits a **structured `diagram` object** matching the existing diagram-builder data model (cones at yard positions + path segments with movement types + yard labels). Rendered by the existing SVG renderer; setup instructions and cone equipment auto-derive; the coach edits in the existing builder. Fully editable, low risk — it's structured data, not an image.
- **Confidence tiers:** (1) text-derivable from transcript/OCR, (2) known-drill template match (seed with 5–6 drills the team already runs), (3) can't tell → no diagram, manual fallback (today's behavior). Only tiers 1–2 emit a diagram.
- **Cost:** same single AI call, ~+150–400 output tokens ≈ +$0.005–0.01/drill. No new extraction or vision spend.
- **"Never redrawn"** applies to the *source video* (credited + linked, never re-hosted); the setup diagram is generated fresh.

---

## 11. Cost model

| Item | Cost |
|---|---|
| YouTube captions (native) | ~$0 |
| Vendor extraction (TikTok/IG/other) | ~$0.01–0.03 |
| Multimodal draft call (cached taxonomy) | ~$0.01–0.02 |
| **All-in per drill (MVP)** | **~$0.03–0.05** (Phase 2 diagram adds ~$0.005–0.01) |

A heavy team at 50 drills/mo ≈ ~$2.50 COGS — negligible against a per-team Pro plan (~$15/mo target). Price is value-based, not cost-based; the fair-use cap protects the tail.

---

## 12. Out of scope (MVP)

- AI diagram generation (Phase 2 — §10)
- AI suggesting **benchmark type** (timed/rated) — deliberate coach action
- **Full-video vision** / re-hosting source video
- **Splitting** a long video into multiple drills
- **Acting on** thumbs feedback (collect now, tune later)
- **Stripe / billing** (entitlement flag only)

---

## 13. To verify at build time

- Exact `team_drills` columns: does `source_url` exist (yes per product docs)? does `coaching_cues` already exist? how are **skills** stored (join table vs array column)?
- Current migration number (latest ≈ 101 on `build-10`) → new migrations start at 102+.
- Chosen extraction vendor: current pricing, ToS, and whether it returns frames as well as transcript.
- Edge Function insert-trigger vs `pg_cron` poll — which is cleaner for the worker trigger.
- Mobile parity surface for the paste-a-link entry + live-status component.

## 14. Field priority (decided 2026-06-08)

The AI draft's value is **not** evenly weighted. Build/verify in this order:

1. **Description + coaching cues — the core value.** These are why the feature exists; they must be good. Handled in the MVP (text fields, no taxonomy dependency).
2. **Diagram** (Phase 2 fast-follow, §10).
3. **Phase + skills — lowest priority.** It's acceptable if the AI mis-tags or omits phase/skills; the coach sets them in the form. Do **not** block or over-invest here.

## 15. Follow-up — phase/skill data model (deferred, low priority)

Discovered during migration apply (2026-06-08): **a drill's phase is NOT a `team_drills` column.** Phases are `drill_categories` rows with `category_type='phase'`, linked to a drill via the **`team_drill_categories(drill_id, category_id)` junction**. Skills are the `skills` table joined via **`drill_skills`**. The migration 105 RPC was corrected to read phases from `drill_categories` (committed `8c9f9ea`).

**Not yet verified:** the end-to-end phase-**save** path — edge `draft.ts` returns a phase id → `from-link` → `DrillForm.save()` must persist it as a `team_drill_categories` junction row (and skills as `drill_skills` rows), not a column write. This is a **low-priority** follow-up per §14 — the coach can set phase/skills in the form regardless. Verify in a fresh session before relying on auto-tagging; until then, treat AI phase/skills as best-effort suggestions, not guaranteed saves.
