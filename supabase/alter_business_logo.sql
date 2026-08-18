-- Run this in the Supabase SQL Editor if the businesses table already exists
-- without brand columns. Safe to re-run.
-- Project SQL Editor: https://supabase.com/dashboard/project/bczoviifrxmenunipeqd/sql

alter table public.businesses
  add column if not exists logo_url text;

alter table public.businesses
  add column if not exists tagline text;
