-- CREST: drawings table for hand-drawn map areas (polygons)
-- Run this once in the Supabase SQL editor:
-- https://yzwpdjlhfljeeodkywqv.supabase.co  ->  SQL Editor  ->  New query  ->  paste  ->  Run

create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  paths jsonb not null,            -- array of { "lat": number, "lng": number }
  color text default '#6366f1',
  created_at timestamptz default now()
);

-- Match the access model used by the rest of the app (anon key reads/writes).
alter table public.drawings enable row level security;

drop policy if exists "drawings_all_access" on public.drawings;
create policy "drawings_all_access"
  on public.drawings
  for all
  using (true)
  with check (true);
