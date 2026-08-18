-- Paste this in the Supabase SQL Editor if tables already exist.
-- Safe to re-run (IF NOT EXISTS). Does not drop data.
-- Project SQL Editor: https://supabase.com/dashboard/project/bczoviifrxmenunipeqd/sql
--
-- Company name already lives on public.businesses.name (from schema.sql).
-- Password is Auth, not a table column.
-- Display name: employee_profiles.display_name was always there;
-- profiles.display_name is added here so Settings can save it too.

alter table public.businesses add column if not exists logo_url text;
alter table public.businesses add column if not exists tagline text;
alter table public.profiles add column if not exists display_name text;
alter table public.work_entries add column if not exists end_date date;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-logos',
  'brand-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists brand_logos_public_read on storage.objects;
create policy brand_logos_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'brand-logos');
