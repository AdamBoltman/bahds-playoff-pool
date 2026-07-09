# Bahds Playoff Pool — Claude Code Context

## What this is

A year-round NHL companion web app for a friend group, built around an annual playoff pick'em pool. During the regular season it serves live scores, standings, and news. During playoffs it becomes the pool — pick submission, scoring, and leaderboard.

## Tech stack

- **Frontend:** React + Vite
- **Language:** TypeScript/JSX
- **Hosting:** Vercel (frontend + serverless API routes in `/api`)
- **Database + Auth:** Supabase (Postgres + Supabase Auth)
- **DB migrations:** Managed via GitHub Actions — any new `.sql` file added to `supabase/migrations/` and pushed to `main` is automatically deployed to the live DB

## Project structure

```
/api
  nhl.js              # Vercel serverless function — proxies NHL API calls to avoid CORS
/src
  /components
    NavBar.jsx
    TopBar.jsx
  /hooks
    useAuth.jsx
  /lib
    nhl.js            # All NHL + ESPN API fetch functions
    scoring.js        # Pick scoring logic
    supabase.js       # Supabase client, ROUNDS bracket config, constants
  /pages
    AdminPage.jsx     # Commissioner tools — enter results, override matchups, recalculate scores
    HomePage.jsx      # Live scores, stat leaders, news feed
    LeaderboardPage.jsx
    LoginPage.jsx
    PicksPage.jsx     # Pick submission UI
    ScoringPage.jsx
/supabase
  /migrations
    001_init.sql      # Full DB schema
  /functions
    /notify-series-result  # Supabase edge function for notifications
  config.toml         # Supabase CLI config
/.github
  /workflows
    supabase-migrations.yml  # Auto-deploys migrations on push to main
```

## Database schema (Supabase/Postgres)

- **profiles** — one row per user (user_id, email, display_name)
- **picks** — one row per user per matchup (user_id, matchup_id, team 't1'|'t2', games 4-7)
- **results** — admin-entered series results (matchup_id, winner abbrev, games)
- **scores** — denormalized leaderboard (user_id, r1, r2, r3, r4, total)
- **matchup_overrides** — admin can update team names/abbrevs without code changes
- **series_scores** — live win counts per series (score1, score2)
- **commissioner_note** — single editable message shown on home page

## Key constants (src/lib/supabase.js)

- `ROUNDS` — hardcoded bracket with Round 1 teams + TBD placeholders for rounds 2-4. **Update each April** when the playoff bracket is announced.
- `PICKS_DEADLINE` — datetime when pick submission closes
- `PLAYOFFS_START` — gates `isPlayoffs()` which switches the app between regular season and playoff modes
- `ROUND_POINTS` — `{ 1: 5, 2: 10, 3: 15, 4: 20 }`
- `seasonId` — e.g. `'20252026'`
- `ADMIN_EMAIL` — set via env var, controls who sees the admin panel

## NHL API

All NHL API calls go through the Vercel proxy at `/api/nhl.js` to avoid CORS. The proxy allowlist currently permits:
- `skater/summary` — stat leaders
- `goalie/summary` — goalie leaders  
- `score/now` — today's live scores

**Planned additions** (part of Bahds 2.0 redesign):
- `schedule/` — weekly schedule
- `standings/` — live standings
- `gamecenter/` — game recaps + highlights
- `playoff-bracket/` and `playoff-series/` — auto-populate bracket

ESPN news is fetched client-side directly (no proxy needed): `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/news`

## NHL CDN (team logos, no API key needed)

```
https://assets.nhle.com/logos/nhl/svg/{ABBREV}_light.svg
https://assets.nhle.com/logos/nhl/svg/{ABBREV}_dark.svg
```

## Environment variables

Set in Vercel dashboard and `.env.local` for local dev:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_EMAIL`

## Known issues / carry-forward notes

- Scoring and matchup-override logic has been the most fragile part. Manual SQL corrections were needed at one point. Hardening this is a priority before next season.
- Round 1 picks are scored correctly; override propagation to scores was previously buggy (fixed, but worth regression testing).

## Bahds 2.0 — Redesign goals (next session)

See `bahds-2.0-plan.md` in the selected Cowork folder for the full plan. Summary:

**New pages to build:**
1. **Schedule page** — day-by-day game cards with scores, recaps, embedded highlights
2. **Standings page** — live conference/division standings from NHL API

**Auto bracket + auto scoring:**
- New Vercel cron job (`api/sync-bracket.js`) fetches NHL playoff bracket and upserts `results` + `matchup_overrides` automatically — no more manual admin entry
- Score recalculation runs automatically after each bracket sync

**Design refresh:**
- Dark theme (#0f1117 bg, #C8102E accent)
- Team logos via NHL CDN
- Tighter, more editorial layout

**Implementation order:** Proxy expansion → Standings → Schedule → Highlights → Auto bracket/scoring → Design

## GitHub Actions (migration workflow)

Workflow: `.github/workflows/supabase-migrations.yml`
Trigger: any push to `main` that changes files under `supabase/migrations/**`
Secrets required in GitHub repo: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`

To make a DB change: add a new numbered `.sql` file to `supabase/migrations/` and push. The Action handles deployment automatically.

## Season reset SQL (run in Supabase when opening new season's pool)

```sql
delete from public.picks;
delete from public.results;
delete from public.series_scores;
delete from public.matchup_overrides;
update public.scores set r1=0, r2=0, r3=0, r4=0, total=0;
-- Do NOT delete scores rows — names should persist on leaderboard
```
