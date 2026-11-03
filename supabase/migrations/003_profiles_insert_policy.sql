-- Allow authenticated users to insert their own profile row
-- (needed for upsert, and as a safety net if the signup trigger misfires)
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- Tighten the existing update policy to also include a WITH CHECK
-- (belt-and-suspenders; prevents a user from changing another user's user_id)
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
