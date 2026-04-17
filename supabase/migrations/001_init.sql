-- ============================================================
-- Stanley Pool 2026 — Supabase Database Setup
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- 1. PROFILES — one row per user, stores display name
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  display_name text,
  created_at timestamptz default now()
);

-- Auto-create profile on first sign-in
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. PICKS — one row per user per matchup
create table if not exists public.picks (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  matchup_id text not null,
  team       text,        -- 't1' or 't2'
  games      int,         -- 4, 5, 6, or 7
  updated_at timestamptz default now(),
  unique(user_id, matchup_id)
);

-- 3. RESULTS — admin enters these after each series
create table if not exists public.results (
  matchup_id text primary key,
  winner     text,        -- team abbreviation e.g. 'COL'
  games      int,         -- 4, 5, 6, or 7
  updated_at timestamptz default now()
);

-- 4. SCORES — denormalized scores per user, recalculated by admin
create table if not exists public.scores (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  r1           int default 0,
  r2           int default 0,
  r3           int default 0,
  r4           int default 0,
  total        int default 0,
  updated_at   timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.picks       enable row level security;
alter table public.results     enable row level security;
alter table public.scores      enable row level security;

-- Profiles: users can read all, update only their own
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = user_id);

-- Picks: users can read/write only their own
create policy "picks_select" on public.picks for select using (auth.uid() = user_id);
create policy "picks_insert" on public.picks for insert with check (auth.uid() = user_id);
create policy "picks_update" on public.picks for update using (auth.uid() = user_id);

-- Results: everyone can read, only admin can write (enforced in app)
create policy "results_select" on public.results for select using (true);
create policy "results_all"    on public.results for all   using (true);

-- Scores: everyone can read (it's a leaderboard)
create policy "scores_select" on public.scores for select using (true);
create policy "scores_all"    on public.scores for all   using (true);

-- ============================================================
-- Done! Your database is ready.
-- ============================================================

-- 5. COMMISSIONER NOTE — single editable message on home page
create table if not exists public.commissioner_note (
  id    int primary key default 1,
  note  text,
  updated_at timestamptz default now()
);
alter table public.commissioner_note enable row level security;
create policy "note_select" on public.commissioner_note for select using (true);
create policy "note_all"    on public.commissioner_note for all   using (true);

-- 6. MATCHUP OVERRIDES — admin can update team names/abbrevs without code changes
create table if not exists public.matchup_overrides (
  matchup_id text primary key,
  t1 text, a1 text,
  t2 text, a2 text,
  updated_at timestamptz default now()
);
alter table public.matchup_overrides enable row level security;
create policy "overrides_select" on public.matchup_overrides for select using (true);
create policy "overrides_all"    on public.matchup_overrides for all   using (true);

-- 7. SERIES SCORES — admin enters live series scores (e.g. CAR 2 OTT 1)
create table if not exists public.series_scores (
  matchup_id  text primary key,
  score1      int default 0,  -- wins for team 1
  score2      int default 0,  -- wins for team 2
  updated_at  timestamptz default now()
);
alter table public.series_scores enable row level security;
create policy "series_select" on public.series_scores for select using (true);
create policy "series_all"    on public.series_scores for all   using (true);
