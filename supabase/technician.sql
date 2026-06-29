-- =============================================================================
-- COATPRO — technician dashboard layer (v1)
--
-- Run AFTER `schema.sql` (and it pairs with `admin.sql`). Adds:
--   * an `in_progress` booking status,
--   * job-completion columns on `bookings`,
--   * the `tech_*` RPCs the technician dashboard reads/writes through,
--   * a public `job-photos` Storage bucket + policies for "after" photos,
--   * a small demo seed of today's jobs (with vehicle info) so the dashboard
--     has actionable work to show.
--
-- SECURITY NOTE: like admin.sql these functions are SECURITY DEFINER and granted
-- to `anon` only because the app has no auth yet. Once technician login exists,
-- revoke from `anon` and gate writes on the signed-in tech.
-- =============================================================================

-- `in_progress` must be added outside a transaction and before it is used, so
-- this runs as its own top-level statement (psql autocommits each statement).
alter type booking_status add value if not exists 'in_progress';

-- Completion metadata captured by the technician when finishing a job.
alter table bookings
  add column if not exists started_at        timestamptz,
  add column if not exists completed_at      timestamptz,
  add column if not exists completion_notes  text,
  add column if not exists after_photo_path  text,
  add column if not exists customer_approved boolean not null default false;

-- ----------------------------------------------------------------------------
-- RPC: tech_list_today_jobs
-- Today's jobs (in the business timezone), joined to customer + service.
-- Cancelled / no-show jobs are excluded so they "disappear" from the tech's day.
-- ----------------------------------------------------------------------------
create or replace function tech_list_today_jobs(p_business_id uuid)
returns table (
  job_id            uuid,
  scheduled_at      timestamptz,
  duration_minutes  int,
  status            booking_status,
  price_cents       int,
  customer_name     text,
  customer_phone    text,
  customer_email    text,
  service_name      text,
  vehicle_type      text,
  vehicle_details   text,
  service_address   text,
  notes             text,
  after_photo_path  text,
  completion_notes  text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz    text;
  v_today date;
begin
  select timezone into v_tz from businesses where id = p_business_id;
  if v_tz is null then
    raise exception 'Business not found';
  end if;
  v_today := (now() at time zone v_tz)::date;

  return query
  select
    b.id, b.scheduled_at, b.duration_minutes, b.status, b.price_cents,
    c.full_name, c.phone, c.email, s.name,
    b.vehicle_type, b.vehicle_details, b.service_address, b.notes,
    b.after_photo_path, b.completion_notes
  from bookings b
  join customers c on c.id = b.customer_id
  join services  s on s.id = b.service_id
  where b.business_id = p_business_id
    and b.status not in ('cancelled', 'no_show')
    and (b.scheduled_at at time zone v_tz)::date = v_today
  order by b.scheduled_at;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: tech_start_job  →  status = in_progress
-- ----------------------------------------------------------------------------
create or replace function tech_start_job(p_business_id uuid, p_booking_id uuid)
returns table (booking_id uuid, status booking_status)
language plpgsql
security definer
set search_path = public
as $$
begin
  update bookings set
    status     = 'in_progress',
    started_at = coalesce(started_at, now())
  where id = p_booking_id
    and business_id = p_business_id
    and status not in ('cancelled', 'no_show', 'completed');

  if not found then
    raise exception 'Job not found or cannot be started';
  end if;

  return query select p_booking_id, 'in_progress'::booking_status;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: tech_complete_job  →  status = completed (+ notes / photo / approval)
-- ----------------------------------------------------------------------------
create or replace function tech_complete_job(
  p_business_id      uuid,
  p_booking_id       uuid,
  p_notes            text default null,
  p_photo_path       text default null,
  p_customer_approved boolean default false
)
returns table (booking_id uuid, status booking_status)
language plpgsql
security definer
set search_path = public
as $$
begin
  update bookings set
    status            = 'completed',
    completed_at      = now(),
    completion_notes  = nullif(trim(p_notes), ''),
    after_photo_path  = nullif(trim(p_photo_path), ''),
    customer_approved = coalesce(p_customer_approved, false)
  where id = p_booking_id
    and business_id = p_business_id
    and status not in ('cancelled', 'no_show');

  if not found then
    raise exception 'Job not found';
  end if;

  return query select p_booking_id, 'completed'::booking_status;
end;
$$;

-- ----------------------------------------------------------------------------
-- Grants — see SECURITY NOTE at top.
-- ----------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'tech_list_today_jobs(uuid)',
    'tech_start_job(uuid, uuid)',
    'tech_complete_job(uuid, uuid, text, text, boolean)'
  ]
  loop
    execute format('revoke all on function %s from public', fn);
    execute format('grant execute on function %s to anon, authenticated', fn);
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- Storage: public "job-photos" bucket for "after" photos.
-- Public so the dashboard can render the photo via its public URL. Uploads are
-- open to anon for now (no auth) — tighten once technician login lands.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;

drop policy if exists "job_photos_insert" on storage.objects;
create policy "job_photos_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'job-photos');

drop policy if exists "job_photos_select" on storage.objects;
create policy "job_photos_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'job-photos');

-- ============================================================================
-- Demo seed — a handful of today's jobs with vehicle info + mixed statuses so
-- the tech dashboard has actionable work. Idempotent: skipped once any of
-- today's jobs already carries vehicle info.
-- ============================================================================
do $$
declare
  v_biz   uuid;
  v_tz    text;
  v_today date;
  v_cust  uuid[];
  v_svc   uuid[];
  v_price int[];
  v_dur   int[];
begin
  select id, timezone into v_biz, v_tz from businesses where slug = 'demo-detailing';
  if v_biz is null then return; end if;
  v_today := (now() at time zone v_tz)::date;

  if exists (
    select 1 from bookings
    where business_id = v_biz
      and vehicle_type is not null
      and (scheduled_at at time zone v_tz)::date = v_today
  ) then
    return; -- already seeded
  end if;

  select array_agg(id order by full_name) into v_cust
  from customers where business_id = v_biz;

  select array_agg(id order by sort_order),
         array_agg(price_cents order by sort_order),
         array_agg(duration_minutes order by sort_order)
    into v_svc, v_price, v_dur
  from services where business_id = v_biz and is_active = true;

  if v_cust is null or array_length(v_cust, 1) < 4 or v_svc is null then
    return;
  end if;

  insert into bookings (
    business_id, service_id, customer_id, scheduled_at,
    duration_minutes, price_cents, status,
    vehicle_type, vehicle_details, service_address, notes
  )
  values
    (v_biz, v_svc[1], v_cust[1], (v_today + time '09:00') at time zone v_tz,
     v_dur[1], v_price[1], 'confirmed',
     'Honda Civic', '2022 · Silver', '12 Maple St', 'Gate code #4821. Friendly dog in yard.'),
    (v_biz, v_svc[2], v_cust[2], (v_today + time '11:00') at time zone v_tz,
     v_dur[2], v_price[2], 'in_progress',
     'Tesla Model 3', '2023 · Midnight Blue', '88 Ocean Ave', 'Please avoid the touchscreen.'),
    (v_biz, v_svc[3], v_cust[3], (v_today + time '13:30') at time zone v_tz,
     v_dur[3], v_price[3], 'pending',
     'Ford F-150', '2021 · Black', '5 Industrial Pkwy', 'Heavy mud on the floor mats.'),
    (v_biz, v_svc[1], v_cust[4], (v_today + time '15:00') at time zone v_tz,
     v_dur[1], v_price[1], 'confirmed',
     'Toyota Camry', '2020 · White', '230 Birch Rd', null);
end$$;
