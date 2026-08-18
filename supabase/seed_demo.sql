-- =============================================================================
-- TocoLabs demo seed — paste this entire file in the SQL Editor and click Run.
-- Project: bczoviifrxmenunipeqd
-- SQL Editor: https://supabase.com/dashboard/project/bczoviifrxmenunipeqd/sql/new
--
-- Safe to re-run: demo work rows for demoadmin / demoemployee (and demo2 if
-- that profile already exists) are deleted, then reinserted.
--
-- Auth users demoadmin and demoemployee MUST already exist (created via Admin
-- API). This script never invents auth.users UUIDs — it joins
-- public.profiles.username.
--
-- After you click Run, wait for Vercel Ready and refresh the admin dashboard.
-- Production reads these tables (not SQLite) when NEXT_PUBLIC_SUPABASE_URL
-- and the service role key are set. Add a second password teammate from
-- Admin → Team (this script does not create auth.users).
-- =============================================================================

alter table public.businesses add column if not exists logo_url text;
alter table public.businesses add column if not exists tagline text;
alter table public.work_entries add column if not exists end_date date;

-- Settings UI stores the visible name on employee_profiles.display_name.
-- Keep a matching column on profiles so profile/settings forms stay safe.
alter table public.profiles add column if not exists display_name text;

insert into public.businesses (name, slug, tagline)
values (
  'TocoLabs',
  'tocolabs',
  'Team sheets, operational clarity.'
)
on conflict (slug) do update
set
  name = excluded.name,
  tagline = coalesce(public.businesses.tagline, excluded.tagline);

do $$
declare
  biz_id uuid;
  admin_id uuid;
  emp_id uuid;
  emp2_id uuid;
  day_id uuid;
  seeded_entries int := 0;
begin
  select b.id into biz_id
  from public.businesses b
  where b.slug = 'tocolabs';

  if biz_id is null then
    raise exception 'business slug tocolabs is missing';
  end if;

  select p.id into admin_id
  from public.profiles p
  where lower(p.username) = 'demoadmin';

  select p.id into emp_id
  from public.profiles p
  where lower(p.username) = 'demoemployee';

  select p.id into emp2_id
  from public.profiles p
  where lower(p.username) = 'demo2';

  if admin_id is null then
    raise exception 'profiles.username demoadmin not found. Create that Auth user first (Admin API), then re-run.';
  end if;

  if emp_id is null then
    raise exception 'profiles.username demoemployee not found. Create that Auth user first (Admin API), then re-run.';
  end if;

  -- demoadmin → BUSINESS_ADMIN on TocoLabs (can see the team).
  update public.profiles
  set
    role = 'BUSINESS_ADMIN',
    status = 'ACTIVE',
    business_id = biz_id,
    display_name = coalesce(nullif(trim(display_name), ''), 'Demo Admin'),
    updated_at = now()
  where id = admin_id;

  -- demoemployee → EMPLOYEE on the same workspace.
  update public.profiles
  set
    role = 'EMPLOYEE',
    status = 'ACTIVE',
    business_id = biz_id,
    display_name = coalesce(nullif(trim(display_name), ''), 'Nisa'),
    updated_at = now()
  where id = emp_id;

  -- Keep Auth app_metadata role in sync (profiles.role is the source of truth).
  update auth.users
  set
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'BUSINESS_ADMIN'),
    updated_at = now()
  where id = admin_id;

  update auth.users
  set
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'EMPLOYEE'),
    updated_at = now()
  where id = emp_id;

  insert into public.employee_profiles (
    business_id, user_id, display_name, department, designation, manager_user_id
  )
  values (
    biz_id, admin_id, 'Demo Admin', 'Admin', 'Business Admin', null
  )
  on conflict (user_id) do update
  set
    business_id = excluded.business_id,
    display_name = excluded.display_name,
    department = excluded.department,
    designation = excluded.designation,
    updated_at = now();

  insert into public.employee_profiles (
    business_id, user_id, display_name, department, designation, manager_user_id
  )
  values (
    biz_id, emp_id, 'Nisa', 'Operations', 'Team Member', admin_id
  )
  on conflict (user_id) do update
  set
    business_id = excluded.business_id,
    display_name = excluded.display_name,
    department = excluded.department,
    designation = excluded.designation,
    manager_user_id = excluded.manager_user_id,
    updated_at = now();

  if emp2_id is not null then
    update public.profiles
    set
      role = 'EMPLOYEE',
      status = 'ACTIVE',
      business_id = biz_id,
      display_name = coalesce(nullif(trim(display_name), ''), 'Ishrat'),
      updated_at = now()
    where id = emp2_id;

    update auth.users
    set
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'EMPLOYEE'),
      updated_at = now()
    where id = emp2_id;

    insert into public.employee_profiles (
      business_id, user_id, display_name, department, designation, manager_user_id
    )
    values (
      biz_id, emp2_id, 'Ishrat', 'Operations', 'Team Member', admin_id
    )
    on conflict (user_id) do update
    set
      business_id = excluded.business_id,
      display_name = excluded.display_name,
      department = excluded.department,
      designation = excluded.designation,
      manager_user_id = excluded.manager_user_id,
      updated_at = now();
  end if;

  -- Wipe previous demo seed rows for these users, then reinsert.
  delete from public.admin_comments
  where business_id = biz_id
    and (
      admin_user_id in (admin_id, emp_id, emp2_id)
      or work_day_id in (
        select d.id from public.work_days d
        where d.employee_user_id in (admin_id, emp_id, emp2_id)
      )
      or work_entry_id in (
        select e.id from public.work_entries e
        where e.employee_user_id in (admin_id, emp_id, emp2_id)
      )
    );

  delete from public.work_entries
  where employee_user_id in (admin_id, emp_id, emp2_id);

  delete from public.work_days
  where employee_user_id in (admin_id, emp_id, emp2_id);

  -- -------------------------------------------------------------------------
  -- demoemployee sheet (Nisa-style old Fiverr rows + extra days so charts
  -- look alive). Dates sit in August 2026 so the default month filter shows them.
  -- USD only. Optional end_date on finished rows.
  -- -------------------------------------------------------------------------

  -- 2026-08-03  (from Prisma seed: nisa 2026-08-01)
  insert into public.work_days (business_id, employee_user_id, work_date, shift_label)
  values (biz_id, emp_id, date '2026-08-03', '6PM-2AM')
  returning id into day_id;

  insert into public.work_entries (
    business_id, work_day_id, employee_user_id, row_order,
    order_id, client, order_value_usd, status, extra, end_date
  )
  values
    (biz_id, day_id, emp_id, 1, '1049', 'jwalsworth', 75, 'Assigned', null, null),
    (biz_id, day_id, emp_id, 2, '1050', 'scjorda', 75, 'Complete', null, date '2026-08-04');

  -- 2026-08-04  (from Prisma seed: nisa 2026-08-02)
  insert into public.work_days (business_id, employee_user_id, work_date, shift_label)
  values (biz_id, emp_id, date '2026-08-04', '6PM-2AM')
  returning id into day_id;

  insert into public.work_entries (
    business_id, work_day_id, employee_user_id, row_order,
    order_id, client, order_value_usd, status, notes, extra
  )
  values
    (biz_id, day_id, emp_id, 1, '1053', 'michellestrz', 140, 'Assigned', null, null),
    (biz_id, day_id, emp_id, 2, '825', 'marksasaki (2nd Order)', 150, 'Assigned', null, 'Return order'),
    (biz_id, day_id, emp_id, 3, null, 'komedisgmbh', null, 'Pending', 'Waiting for response', null);

  -- 2026-08-05  (from Prisma seed: ishrat 2026-08-01, logged on Nisa for a full sheet)
  insert into public.work_days (business_id, employee_user_id, work_date, shift_label)
  values (biz_id, emp_id, date '2026-08-05', '9AM-5PM')
  returning id into day_id;

  insert into public.work_entries (
    business_id, work_day_id, employee_user_id, row_order,
    order_id, client, order_value_usd, status
  )
  values
    (biz_id, day_id, emp_id, 1, '1052', 'Nicolasdecrouy', 125, 'Assigned'),
    (biz_id, day_id, emp_id, 2, '825', 'marksasaki', null, 'Pending');

  -- 2026-08-06  (from Prisma seed: anika)
  insert into public.work_days (business_id, employee_user_id, work_date, shift_label)
  values (biz_id, emp_id, date '2026-08-06', '4AM-10:30AM')
  returning id into day_id;

  insert into public.work_entries (
    business_id, work_day_id, employee_user_id, row_order,
    order_id, client, order_value_usd, new_clients, status, end_date
  )
  values
    (biz_id, day_id, emp_id, 1, '1063', 'mariaples', 85, 3, 'Complete', date '2026-08-06');

  -- 2026-08-08  (from Prisma seed: anika)
  insert into public.work_days (business_id, employee_user_id, work_date, shift_label)
  values (biz_id, emp_id, date '2026-08-08', '4AM-10:30AM')
  returning id into day_id;

  insert into public.work_entries (
    business_id, work_day_id, employee_user_id, row_order,
    order_id, client, order_value_usd, new_clients, status, notes, extra, end_date
  )
  values
    (biz_id, day_id, emp_id, 1, '972', 'finest79', 20, 2, 'Complete', 'Return client, gave changes to previous work', null, date '2026-08-08'),
    (biz_id, day_id, emp_id, 2, '1065', 'sachiimusic', 50, null, 'Delivered', null, null, date '2026-08-08'),
    (biz_id, day_id, emp_id, 3, '1064', 'norsemedical', 150, null, 'Complete', null, null, date '2026-08-09');

  -- 2026-08-11  week 2 — keeps daily charts moving
  insert into public.work_days (business_id, employee_user_id, work_date, shift_label, summary_notes)
  values (biz_id, emp_id, date '2026-08-11', '6PM-2AM', 'Busy night shift; two new briefs.')
  returning id into day_id;

  insert into public.work_entries (
    business_id, work_day_id, employee_user_id, row_order,
    order_id, client, order_value_usd, new_clients, status, extra, end_date
  )
  values
    (biz_id, day_id, emp_id, 1, '1071', 'brightpixel', 95, 1, 'Delivered', null, date '2026-08-11'),
    (biz_id, day_id, emp_id, 2, '1072', 'oakandember', 110, null, 'Assigned', 'Source files pending', null);

  -- 2026-08-12
  insert into public.work_days (business_id, employee_user_id, work_date, shift_label)
  values (biz_id, emp_id, date '2026-08-12', '9AM-5PM')
  returning id into day_id;

  insert into public.work_entries (
    business_id, work_day_id, employee_user_id, row_order,
    order_id, client, order_value_usd, status, notes, end_date
  )
  values
    (biz_id, day_id, emp_id, 1, '1074', 'helixstudio', 60, 'Pending', 'Client reviewing draft', null),
    (biz_id, day_id, emp_id, 2, '1075', 'nordicframe', 180, 'Complete', null, date '2026-08-13');

  -- 2026-08-14
  insert into public.work_days (business_id, employee_user_id, work_date, shift_label)
  values (biz_id, emp_id, date '2026-08-14', '6PM-2AM')
  returning id into day_id;

  insert into public.work_entries (
    business_id, work_day_id, employee_user_id, row_order,
    order_id, client, order_value_usd, status, extra, end_date
  )
  values
    (biz_id, day_id, emp_id, 1, '1078', 'coastalink', 45, 'Delivered', null, date '2026-08-14'),
    (biz_id, day_id, emp_id, 2, '1080', 'paperlane.co', 70, 'Assigned', 'Rush delivery requested', null);

  insert into public.admin_comments (business_id, admin_user_id, work_day_id, body)
  select biz_id, admin_id, d.id, 'Follow up on pending client rows before shift end.'
  from public.work_days d
  where d.employee_user_id = emp_id
    and d.work_date = date '2026-08-04';

  -- Optional second teammate (only if demo2 already exists as an Auth/profile user).
  if emp2_id is not null then
    insert into public.work_days (business_id, employee_user_id, work_date, shift_label)
    values (biz_id, emp2_id, date '2026-08-05', '9AM-5PM')
    returning id into day_id;

    insert into public.work_entries (
      business_id, work_day_id, employee_user_id, row_order,
      order_id, client, order_value_usd, status
    )
    values
      (biz_id, day_id, emp2_id, 1, '1052', 'Nicolasdecrouy', 125, 'Assigned'),
      (biz_id, day_id, emp2_id, 2, '825', 'marksasaki', null, 'Pending');

    insert into public.work_days (business_id, employee_user_id, work_date, shift_label)
    values (biz_id, emp2_id, date '2026-08-06', '10-06:40')
    returning id into day_id;

    insert into public.work_entries (
      business_id, work_day_id, employee_user_id, row_order,
      client, status, notes
    )
    values
      (biz_id, day_id, emp2_id, 1, 'No Order', 'No Order', 'No confirmed work in this shift');

    insert into public.work_days (business_id, employee_user_id, work_date, shift_label)
    values (biz_id, emp2_id, date '2026-08-13', '9AM-5PM')
    returning id into day_id;

    insert into public.work_entries (
      business_id, work_day_id, employee_user_id, row_order,
      order_id, client, order_value_usd, status, end_date
    )
    values
      (biz_id, day_id, emp2_id, 1, '1082', 'lumenandco', 90, 'Delivered', date '2026-08-13'),
      (biz_id, day_id, emp2_id, 2, '1083', 'atelierwest', 130, 'Complete', date '2026-08-14');
  end if;

  select count(*) into seeded_entries
  from public.work_entries
  where employee_user_id in (emp_id, emp2_id);

  raise notice 'Demo seed complete. demoadmin is BUSINESS_ADMIN on TocoLabs. Seeded % work_entries on demoemployee%.',
    seeded_entries,
    case when emp2_id is null
      then ' (no demo2 auth user — add a second member from Admin → Team)'
      else ' + demo2'
    end;
end $$;
