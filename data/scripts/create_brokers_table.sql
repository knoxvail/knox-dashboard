-- Brokers table: contact rolodex grouped by region
create table if not exists public.brokers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  firm text,
  address text,
  phone text,
  phone2 text,
  email text,
  website text,
  region text,
  notes text,
  created_at timestamptz default now()
);

-- Allow the anon/service roles to use it (matches the rest of the app's tables)
alter table public.brokers enable row level security;

create policy "brokers_all" on public.brokers
  for all using (true) with check (true);
