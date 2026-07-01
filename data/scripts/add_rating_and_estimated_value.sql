-- CREST: add editable "rating" (1–10, decimals) and "estimated_value" to assets.
-- Run once in the Supabase SQL editor:
-- https://yzwpdjlhfljeeodkywqv.supabase.co  ->  SQL Editor  ->  New query  ->  paste  ->  Run

alter table public.assets add column if not exists rating numeric;
alter table public.assets add column if not exists estimated_value numeric;
