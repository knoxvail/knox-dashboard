-- CREST: add an editable "estimated value" field to assets.
-- Run once in the Supabase SQL editor:
-- https://yzwpdjlhfljeeodkywqv.supabase.co  ->  SQL Editor  ->  New query  ->  paste  ->  Run

alter table public.assets
  add column if not exists estimated_value numeric;
