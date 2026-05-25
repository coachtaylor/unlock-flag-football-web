# Build 5a: Dashboard SQL Views

Read `../CLAUDE.md` for product context (Coach/Team Management MVP section, "Dashboard (the payoff)"). Read `../qb_supabase_full_package/docs/coach_mvp_schema_spec.md` for the planned dashboard views section at the bottom.

## Context

The team dashboard needs aggregated data from benchmark results, practice logs, and roster. Right now the home page shows simple counts. We need SQL views in Supabase that power real insights. This build creates the SQL migration file — no frontend changes yet.

## Task: Write a SQL migration file

Create `../qb_supabase_full_package/sql/08_coach_dashboard_views.sql` with these views:

### 1. vw_team_player_benchmarks

Latest benchmark result per player per drill, plus averages.

```sql
-- For each player on a team, show their most recent result on each benchmark drill
-- Include: player_name, drill_name, benchmark_type, latest time_seconds or rating,
--          assessment_date, tags, avg rating or avg time across all their attempts
-- Used for: player detail cards, team overview comparisons
```

Key columns: team_id, player_id, player_name, drill_id, drill_name, benchmark_type, latest_time, latest_rating, latest_date, latest_tags, avg_time, avg_rating, attempt_count

### 2. vw_team_strength_weakness

Aggregated benchmark scores by drill category across all players.

```sql
-- For each drill category (offense, defense, conditioning, etc.), calculate
-- the team's average rating and average time across all benchmark results
-- Include: number of players assessed, number of drills in category
-- Used for: team strengths/weaknesses overview on dashboard
```

Key columns: team_id, category_name, avg_rating, avg_time, players_assessed, drills_in_category, total_assessments

### 3. vw_player_progression

Benchmark results over time for individual players showing improvement or regression.

```sql
-- For each player + drill combo, show all results ordered by date
-- Include: the delta from their first result to their latest
-- Positive delta on rating = improvement, negative delta on time = improvement (faster)
-- Used for: player progression charts, "most improved" insights
```

Key columns: team_id, player_id, player_name, drill_id, drill_name, benchmark_type, assessment_date, time_seconds, rating, first_time, first_rating, latest_time, latest_rating, time_delta, rating_delta

### 4. vw_practice_history

Summary of all completed practices.

```sql
-- For each completed practice plan that has a practice log, show summary stats
-- Include: date, drills planned vs completed vs skipped, attendance, energy level,
--          highlights and areas to improve
-- Used for: practice history timeline on dashboard
```

Key columns: team_id, practice_date, title, drills_planned, drills_completed_count, drills_skipped_count, attendance_count, energy_level, highlights, areas_to_improve

### 5. vw_drill_usage

Which drills are used most/least in practice plans and benchmarks.

```sql
-- Count how many times each drill appears in practice plans and benchmark sessions
-- Used for: identifying overused/underused drills, informing practice planning
```

Key columns: team_id, drill_id, drill_name, category_name, times_in_practice_plans, times_benchmarked, total_usage, last_used_date

## Important notes

- All views must be filtered by team_id so RLS works (or create them as functions that take team_id as a parameter).
- Actually, since views in Supabase respect RLS on the underlying tables, and all underlying tables have RLS policies using get_my_team_ids(), the views should work automatically. But test this assumption — if views don't inherit RLS, we may need security definer functions instead.
- Use LEFT JOINs where data might not exist yet (e.g., a drill with no benchmark results).
- Handle NULLs gracefully (COALESCE for counts, etc.).
- The migration should be idempotent: use CREATE OR REPLACE VIEW.
