-- Add favourite_team column to profiles
-- Stores the NHL team abbreviation the user wants to follow (e.g. 'EDM', 'TOR')
alter table public.profiles add column if not exists favourite_team text;
