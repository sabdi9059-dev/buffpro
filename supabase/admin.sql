-- =============================================================================
-- COATPRO — owner/admin dashboard layer (v1)
--
-- Run this AFTER `schema.sql` (Supabase SQL editor or `psql`). It adds the
-- server-side reads/writes the owner dashboard needs plus a demo seed so the
-- dashboard shows realistic numbers immediately.
--
-- SECURITY NOTE (important):
--   These functions are SECURITY DEFINER and currently GRANTed to `anon` so the
--   dashboard works before authentication is built (the booking app has no
--   login yet — see the roadmap in README). They expose customer/booking data,
--   so once staff auth lands you MUST revoke them from `anon` and gate access on
--   `auth.uid()` (e.g. a `business_members` table). They are deliberately
--   read/aggregate or owner-write only and never leak data across businesses
--   because every function is scoped by `p_business_id`.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- RPC: admin_dashboard_stats
-- One row of headline KPIs (+ the previous-period values used for trend deltas).
-- All "today/month" boundaries are computed in the business's local timezone.
-- ----------------------------------------------------------------------------
create or replace function admin_dashboard_stats(p_business_id uuid)
returns table (
  today_revenue_cents       bigint,
  yesterday_revenue_cents   bigint,
  month_bookings            int,
  last_month_bookings       int,
  total_customers           int,
  new_customers_this_month  int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz         text;
  v_today      date;
  v_month_start date;
begin
  select timezone into v_tz from businesses where id = p_business_id;
  if v_tz is null then
    raise exception 'Business not found';
  end if;

  v_today       := (now() at time zone v_tz)::date;
  v_month_start := date_trunc('month', v_today)::date;

  return query
  select
    -- Revenue counts everything that isn't cancelled / no-show.
    coalesce((
      select sum(b.price_cents) from bookings b
      where b.business_id = p_business_id
        and b.status not in ('cancelled', 'no_show')
        and (b.scheduled_at at time zone v_tz)::date = v_today
    ), 0)::bigint,
    coalesce((
      select sum(b.price_cents) from bookings b
      where b.business_id = p_business_id
        and b.status not in ('cancelled', 'no_show')
        and (b.scheduled_at at time zone v_tz)::date = v_today - 1
    ), 0)::bigint,
    (
      select count(*) from bookings b
      where b.business_id = p_business_id
        and b.status not in ('cancelled', 'no_show')
        and (b.scheduled_at at time zone v_tz)::date >= v_month_start
    )::int,
    (
      select count(*) from bookings b
      where b.business_id = p_business_id
        and b.status not in ('cancelled', 'no_show')
        and (b.scheduled_at at time zone v_tz)::date
            >= (v_month_start - interval '1 month')::date
        and (b.scheduled_at at time zone v_tz)::date < v_month_start
    )::int,
    (
      select count(*) from customers c where c.business_id = p_business_id
    )::int,
    (
      select count(*) from customers c
      where c.business_id = p_business_id
        and (c.created_at at time zone v_tz)::date >= v_month_start
    )::int;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: admin_revenue_last_7_days
-- Daily booked revenue for the trailing 7 days (oldest → newest), with a short
-- weekday label for the chart's x-axis. Days with no bookings return 0.
-- ----------------------------------------------------------------------------
create or replace function admin_revenue_last_7_days(p_business_id uuid)
returns table (
  day            date,
  dow            text,
  revenue_cents  bigint
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
    d.day::date,
    to_char(d.day, 'Dy') as dow,
    coalesce(sum(b.price_cents), 0)::bigint
  from generate_series(v_today - 6, v_today, interval '1 day') as d(day)
  left join bookings b
    on b.business_id = p_business_id
   and b.status not in ('cancelled', 'no_show')
   and (b.scheduled_at at time zone v_tz)::date = d.day::date
  group by d.day
  order by d.day;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: admin_list_bookings
-- Every booking for a business, joined to its customer + service, newest first.
-- The dashboard filters / slices this client-side (recent, this week, etc.).
-- ----------------------------------------------------------------------------
create or replace function admin_list_bookings(p_business_id uuid)
returns table (
  booking_id        uuid,
  scheduled_at      timestamptz,
  created_at        timestamptz,
  status            booking_status,
  price_cents       int,
  duration_minutes  int,
  customer_name     text,
  customer_phone    text,
  service_name      text,
  vehicle_type      text,
  vehicle_details   text,
  service_address   text,
  notes             text
)
language sql
security definer
set search_path = public
as $$
  select
    b.id, b.scheduled_at, b.created_at, b.status, b.price_cents, b.duration_minutes,
    c.full_name, c.phone, s.name,
    b.vehicle_type, b.vehicle_details, b.service_address, b.notes
  from bookings b
  join customers c on c.id = b.customer_id
  join services  s on s.id = b.service_id
  where b.business_id = p_business_id
  order by b.scheduled_at desc;
$$;

-- ----------------------------------------------------------------------------
-- RPC: admin_list_customers
-- One row per customer with their booking count + last visit, name-sorted.
-- ----------------------------------------------------------------------------
create or replace function admin_list_customers(p_business_id uuid)
returns table (
  customer_id     uuid,
  full_name       text,
  phone           text,
  email           text,
  bookings_count  int,
  last_visit      timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    c.id, c.full_name, c.phone, c.email,
    count(b.id)::int as bookings_count,
    max(b.scheduled_at) as last_visit
  from customers c
  left join bookings b on b.customer_id = c.id
  where c.business_id = p_business_id
  group by c.id
  order by c.full_name;
$$;

-- ----------------------------------------------------------------------------
-- RPC: admin_update_business
-- Owner edits to the business profile + working hours. Returns the fresh row.
-- ----------------------------------------------------------------------------
create or replace function admin_update_business(
  p_business_id  uuid,
  p_name         text,
  p_phone        text,
  p_email        text,
  p_opening_time time,
  p_closing_time time
)
returns businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row businesses%rowtype;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Business name is required' using errcode = 'check_violation';
  end if;
  if p_closing_time <= p_opening_time then
    raise exception 'Closing time must be after opening time'
      using errcode = 'check_violation';
  end if;

  update businesses set
    name         = trim(p_name),
    phone        = nullif(trim(p_phone), ''),
    email        = nullif(trim(p_email), ''),
    opening_time = p_opening_time,
    closing_time = p_closing_time
  where id = p_business_id
  returning * into v_row;

  if not found then
    raise exception 'Business not found';
  end if;
  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: admin_upsert_service
-- Create (p_service_id null) or update a service. Returns the saved row.
-- ----------------------------------------------------------------------------
create or replace function admin_upsert_service(
  p_business_id      uuid,
  p_service_id       uuid,
  p_name             text,
  p_description      text,
  p_duration_minutes int,
  p_price_cents      int
)
returns services
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row services%rowtype;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Service name is required' using errcode = 'check_violation';
  end if;
  if p_duration_minutes <= 0 then
    raise exception 'Duration must be greater than zero' using errcode = 'check_violation';
  end if;
  if p_price_cents < 0 then
    raise exception 'Price cannot be negative' using errcode = 'check_violation';
  end if;

  if p_service_id is null then
    insert into services (business_id, name, description, duration_minutes, price_cents, sort_order)
    values (
      p_business_id, trim(p_name), nullif(trim(p_description), ''),
      p_duration_minutes, p_price_cents,
      coalesce((select max(sort_order) + 1 from services where business_id = p_business_id), 0)
    )
    returning * into v_row;
  else
    update services set
      name             = trim(p_name),
      description      = nullif(trim(p_description), ''),
      duration_minutes = p_duration_minutes,
      price_cents      = p_price_cents
    where id = p_service_id and business_id = p_business_id
    returning * into v_row;

    if not found then
      raise exception 'Service not found';
    end if;
  end if;

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: admin_delete_service
-- Hard-delete when the service has no bookings; otherwise archive it
-- (is_active = false) so historical bookings keep their FK. Returns whether the
-- row was physically removed.
-- ----------------------------------------------------------------------------
create or replace function admin_delete_service(
  p_business_id uuid,
  p_service_id  uuid
)
returns table (hard_deleted boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from bookings where service_id = p_service_id) then
    update services set is_active = false
    where id = p_service_id and business_id = p_business_id;
    hard_deleted := false;
  else
    delete from services
    where id = p_service_id and business_id = p_business_id;
    hard_deleted := true;
  end if;
  return next;
end;
$$;

-- ----------------------------------------------------------------------------
-- Grants — see SECURITY NOTE at the top of this file.
-- ----------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_dashboard_stats(uuid)',
    'admin_revenue_last_7_days(uuid)',
    'admin_list_bookings(uuid)',
    'admin_list_customers(uuid)',
    'admin_update_business(uuid, text, text, text, time, time)',
    'admin_upsert_service(uuid, uuid, text, text, int, int)',
    'admin_delete_service(uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public', fn);
    execute format('grant execute on function %s to anon, authenticated', fn);
  end loop;
end$$;

-- ============================================================================
-- Demo seed — extra customers + bookings so the dashboard isn't empty.
-- Idempotent: only runs when the demo business has very few bookings.
-- ============================================================================
do $$
declare
  v_biz       uuid;
  v_existing  int;
  v_names     text[] := array[
    'Olivia Bennett','Liam Carter','Emma Diaz','Noah Foster','Ava Greene',
    'Mason Hughes','Sophia Ingram','Lucas Jensen','Mia Kelly','Ethan Lowe',
    'Isabella Munoz','James Novak','Charlotte Owens','Benjamin Reyes'
  ];
  v_svc_ids   uuid[];
  v_svc_price int[];
  v_svc_dur   int[];
  v_cust_ids  uuid[];
  v_cust      uuid;
  v_sched     timestamptz;
  v_status    booking_status;
  v_si        int;
  i           int;
  v_offset    int;
begin
  select id into v_biz from businesses where slug = 'demo-detailing';
  if v_biz is null then return; end if;

  select count(*) into v_existing from bookings where business_id = v_biz;
  if v_existing >= 10 then return; end if; -- already seeded

  -- Active services to draw from.
  select array_agg(id order by sort_order),
         array_agg(price_cents order by sort_order),
         array_agg(duration_minutes order by sort_order)
    into v_svc_ids, v_svc_price, v_svc_dur
  from services where business_id = v_biz and is_active = true;

  if v_svc_ids is null then return; end if;

  -- Customers.
  for i in 1..array_length(v_names, 1) loop
    insert into customers (business_id, full_name, phone, email)
    values (
      v_biz, v_names[i],
      '+1555' || lpad(i::text, 7, '0'),
      lower(replace(v_names[i], ' ', '.')) || '@example.test'
    )
    on conflict (business_id, phone) do nothing;
  end loop;

  select array_agg(id) into v_cust_ids from customers where business_id = v_biz;

  -- ~26 bookings spread across the last 16 days and the next 7.
  for i in 1..26 loop
    v_cust   := v_cust_ids[1 + floor(random() * array_length(v_cust_ids, 1))::int];
    v_si     := 1 + floor(random() * array_length(v_svc_ids, 1))::int;
    v_offset := floor(random() * 24)::int - 16;  -- -16 .. +7 days
    v_sched  := date_trunc('day', now())
                + make_interval(days => v_offset)
                + make_interval(hours => 9 + floor(random() * 7)::int);

    if v_sched < now() then
      v_status := case when random() < 0.82 then 'completed' else 'cancelled' end;
    else
      v_status := case when random() < 0.5 then 'confirmed' else 'pending' end;
    end if;

    insert into bookings (
      business_id, service_id, customer_id, scheduled_at,
      duration_minutes, price_cents, status
    )
    values (
      v_biz, v_svc_ids[v_si], v_cust, v_sched,
      v_svc_dur[v_si], v_svc_price[v_si], v_status
    );
  end loop;

  -- Guarantee some revenue *today* so the headline KPI is non-zero.
  for i in 1..3 loop
    v_cust := v_cust_ids[1 + floor(random() * array_length(v_cust_ids, 1))::int];
    v_si   := 1 + floor(random() * array_length(v_svc_ids, 1))::int;
    insert into bookings (
      business_id, service_id, customer_id, scheduled_at,
      duration_minutes, price_cents, status
    )
    values (
      v_biz, v_svc_ids[v_si], v_cust,
      date_trunc('day', now()) + make_interval(hours => 9 + i*2),
      v_svc_dur[v_si], v_svc_price[v_si], 'completed'
    );
  end loop;
end$$;
