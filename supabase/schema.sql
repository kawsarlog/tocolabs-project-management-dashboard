-- =============================================================================
-- TocoLabs / dashboard-app — run this in the Supabase SQL Editor
-- Project: bczoviifrxmenunipeqd
-- Dashboard: https://supabase.com/dashboard/project/bczoviifrxmenunipeqd
--
-- HOW TO RUN
-- 1. Open SQL Editor in that project.
-- 2. Paste this entire file and click Run.
-- 3. Safe to re-run (idempotent): existing types/tables/policies are reused.
--
-- REQUIRED AUTH SETTING (do this in the dashboard, not SQL)
-- Authentication → Sign In / Providers → Email → turn OFF "Confirm email".
-- The app does not wait for a confirmation link. After admin signup it redirects
-- as if the account is already confirmed.
--
-- Product rules this schema supports:
--   PLATFORM_ADMIN, BUSINESS_ADMIN, EMPLOYEE
--   Public register is admin-only in the app. Employees are created by admins.
--
-- After the first admin register, promote a platform admin if needed:
--   update public.profiles
--   set role = 'PLATFORM_ADMIN'
--   where username = 'superadmin';
-- =============================================================================

create extension if not exists pgcrypto;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role, authenticated, anon;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('PLATFORM_ADMIN', 'BUSINESS_ADMIN', 'EMPLOYEE');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.user_status as enum ('ACTIVE', 'INACTIVE');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables (maps the current Prisma/SQLite product onto Postgres)
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  tagline text,
  created_at timestamptz not null default now()
);

alter table public.businesses add column if not exists logo_url text;
alter table public.businesses add column if not exists tagline text;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  email text,
  role public.user_role not null default 'EMPLOYEE',
  status public.user_status not null default 'ACTIVE',
  business_id uuid references public.businesses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_len check (char_length(username) >= 3)
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create index if not exists profiles_business_id_idx
  on public.profiles (business_id);

create table if not exists public.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  display_name text,
  department text,
  designation text,
  manager_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_profiles_business_id_idx
  on public.employee_profiles (business_id);

create table if not exists public.work_days (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  employee_user_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  shift_label text,
  summary_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, employee_user_id, work_date)
);

create index if not exists work_days_business_date_idx
  on public.work_days (business_id, work_date);

create index if not exists work_days_employee_date_idx
  on public.work_days (employee_user_id, work_date);

create table if not exists public.work_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  work_day_id uuid not null references public.work_days (id) on delete cascade,
  employee_user_id uuid not null references public.profiles (id) on delete cascade,
  row_order integer not null default 0,
  order_id text,
  client text,
  order_value_usd numeric,
  order_value_bdt numeric,
  new_clients integer,
  status text,
  notes text,
  extra text,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.work_entries add column if not exists end_date date;

create index if not exists work_entries_business_employee_idx
  on public.work_entries (business_id, employee_user_id);

create index if not exists work_entries_work_day_order_idx
  on public.work_entries (work_day_id, row_order);

create table if not exists public.admin_comments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  admin_user_id uuid not null references public.profiles (id) on delete cascade,
  work_day_id uuid references public.work_days (id) on delete cascade,
  work_entry_id uuid references public.work_entries (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_comments_business_created_idx
  on public.admin_comments (business_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

drop trigger if exists employee_profiles_set_updated_at on public.employee_profiles;
create trigger employee_profiles_set_updated_at
  before update on public.employee_profiles
  for each row execute function private.set_updated_at();

drop trigger if exists work_days_set_updated_at on public.work_days;
create trigger work_days_set_updated_at
  before update on public.work_days
  for each row execute function private.set_updated_at();

drop trigger if exists work_entries_set_updated_at on public.work_entries;
create trigger work_entries_set_updated_at
  before update on public.work_entries
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Signup trigger: create a profile row for every auth.users insert
-- Role is NEVER taken from raw_user_meta_data (that claim is user-editable).
-- Role may come from raw_app_meta_data (admin API only) or defaults to EMPLOYEE.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_username text;
  new_role public.user_role;
  base_username text;
  suffix text;
begin
  base_username := lower(coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  ));
  base_username := regexp_replace(base_username, '[^a-z0-9._-]', '', 'g');
  if char_length(base_username) < 3 then
    base_username := 'user' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  new_username := base_username;
  suffix := substr(replace(new.id::text, '-', ''), 1, 4);
  if exists (select 1 from public.profiles p where p.username = new_username) then
    new_username := left(base_username, 20) || '_' || suffix;
  end if;

  new_role := coalesce(
    (new.raw_app_meta_data->>'role')::public.user_role,
    'EMPLOYEE'
  );

  insert into public.profiles (id, username, email, role, status)
  values (
    new.id,
    new_username,
    new.email,
    new_role,
    'ACTIVE'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers (private + security definer). Initplan-friendly wrappers.
-- ---------------------------------------------------------------------------
create or replace function private.uid()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid();
$$;

create or replace function private.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'PLATFORM_ADMIN'
      and p.status = 'ACTIVE'
  );
$$;

create or replace function private.is_business_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('BUSINESS_ADMIN', 'PLATFORM_ADMIN')
      and p.status = 'ACTIVE'
  );
$$;

create or replace function private.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.business_id
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Username availability for the public register form (does not leak emails).
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.profiles p
    where p.username = lower(trim(p_username))
  );
$$;

grant execute on function private.uid() to authenticated, anon, service_role;
grant execute on function private.current_profile() to authenticated, service_role;
grant execute on function private.is_platform_admin() to authenticated, service_role;
grant execute on function private.is_business_admin() to authenticated, service_role;
grant execute on function private.current_business_id() to authenticated, service_role;
grant execute on function public.username_available(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Employees: own rows. Business admins: their workspace. Platform admin: all.
-- ---------------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.work_days enable row level security;
alter table public.work_entries enable row level security;
alter table public.admin_comments enable row level security;

drop policy if exists businesses_select on public.businesses;
create policy businesses_select
  on public.businesses
  for select
  to authenticated
  using (
    (select private.is_platform_admin())
    or id = (select private.current_business_id())
  );

drop policy if exists businesses_insert_admin on public.businesses;
create policy businesses_insert_admin
  on public.businesses
  for insert
  to authenticated
  with check ((select private.is_platform_admin()) or (select private.is_business_admin()));

drop policy if exists businesses_update_admin on public.businesses;
create policy businesses_update_admin
  on public.businesses
  for update
  to authenticated
  using (
    (select private.is_platform_admin())
    or id = (select private.current_business_id())
  )
  with check (
    (select private.is_platform_admin())
    or id = (select private.current_business_id())
  );

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using (
    id = (select private.uid())
    or (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id is not null
      and business_id = (select private.current_business_id())
    )
  );

-- Users may update their own non-role fields. Role/status/business stay admin-only
-- (enforced by with-check matching the existing privileged columns).
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = (select private.uid()))
  with check (
    id = (select private.uid())
    and role = (select p.role from public.profiles p where p.id = (select private.uid()))
    and status = (select p.status from public.profiles p where p.id = (select private.uid()))
    and business_id is not distinct from (
      select p.business_id from public.profiles p where p.id = (select private.uid())
    )
  );

drop policy if exists profiles_update_admins on public.profiles;
create policy profiles_update_admins
  on public.profiles
  for update
  to authenticated
  using (
    (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  )
  with check (
    (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
      and role <> 'PLATFORM_ADMIN'
    )
  );

drop policy if exists employee_profiles_select on public.employee_profiles;
create policy employee_profiles_select
  on public.employee_profiles
  for select
  to authenticated
  using (
    user_id = (select private.uid())
    or (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  );

drop policy if exists employee_profiles_write_admin on public.employee_profiles;
create policy employee_profiles_write_admin
  on public.employee_profiles
  for all
  to authenticated
  using (
    (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  )
  with check (
    (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  );

drop policy if exists work_days_select on public.work_days;
create policy work_days_select
  on public.work_days
  for select
  to authenticated
  using (
    employee_user_id = (select private.uid())
    or (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  );

drop policy if exists work_days_write_own on public.work_days;
create policy work_days_write_own
  on public.work_days
  for all
  to authenticated
  using (
    employee_user_id = (select private.uid())
    or (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  )
  with check (
    employee_user_id = (select private.uid())
    or (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  );

drop policy if exists work_entries_select on public.work_entries;
create policy work_entries_select
  on public.work_entries
  for select
  to authenticated
  using (
    employee_user_id = (select private.uid())
    or (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  );

drop policy if exists work_entries_write_own on public.work_entries;
create policy work_entries_write_own
  on public.work_entries
  for all
  to authenticated
  using (
    employee_user_id = (select private.uid())
    or (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  )
  with check (
    employee_user_id = (select private.uid())
    or (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  );

drop policy if exists admin_comments_select on public.admin_comments;
create policy admin_comments_select
  on public.admin_comments
  for select
  to authenticated
  using (
    (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
    or exists (
      select 1
      from public.work_days d
      where d.id = admin_comments.work_day_id
        and d.employee_user_id = (select private.uid())
    )
    or exists (
      select 1
      from public.work_entries e
      where e.id = admin_comments.work_entry_id
        and e.employee_user_id = (select private.uid())
    )
  );

drop policy if exists admin_comments_write_admin on public.admin_comments;
create policy admin_comments_write_admin
  on public.admin_comments
  for all
  to authenticated
  using (
    (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  )
  with check (
    (select private.is_platform_admin())
    or (
      (select private.is_business_admin())
      and business_id = (select private.current_business_id())
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.businesses to authenticated;
grant insert, update on public.businesses to authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.employee_profiles to authenticated;
grant select, insert, update, delete on public.work_days to authenticated;
grant select, insert, update, delete on public.work_entries to authenticated;
grant select, insert, update, delete on public.admin_comments to authenticated;

-- ---------------------------------------------------------------------------
-- Default workspace so new employees can attach somewhere
-- ---------------------------------------------------------------------------
insert into public.businesses (name, slug)
values ('TocoLabs', 'tocolabs')
on conflict (slug) do nothing;
