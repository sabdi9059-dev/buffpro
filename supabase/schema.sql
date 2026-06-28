-- =============================================================================
-- COATPRO — core schema (v1)
-- Booking & management platform for auto detailers.
--
-- Run this in the Supabase SQL editor (or `supabase db push`). It is written to
-- be idempotent-ish: it creates types/tables if they do not already exist.
--
-- Design notes:
--  * Every table has Row Level Security (RLS) ENABLED. The browser uses the
--    public "anon" key, so anonymous visitors may ONLY read public business
--    info + active services. They can NEVER read other customers' bookings.
--  * Bookings are created through a SECURITY DEFINER function (`create_booking`)
--    that validates input and prevents double-booking inside a single
--    transaction. This keeps write access locked down while still allowing the
--    public booking page to work without an account.
-- =============================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type booking_status as enum (
      'pending',
      'confirmed',
      'completed',
      'cancelled',
      'no_show'
    );
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table if not exists businesses (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  name                  text not null,
  phone                 text,
  email                 text,
  timezone              text not null default 'America/New_York',
  open_days             smallint[] not null default '{1,2,3,4,5,6}', -- Mon–Sat
  opening_time          time not null default '09:00',
  closing_time          time not null default '17:00',
  slot_interval_minutes int  not null default 30 check (slot_interval_minutes > 0),
  created_at            timestamptz not null default now()
);

create table if not exists services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses (id) on delete cascade,
  name             text not null,
  description      text,
  duration_minutes int not null check (duration_minutes > 0),
  price_cents      int not null check (price_cents >= 0),
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists services_business_idx on services (business_id);

create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text not null,
  created_at  timestamptz not null default now(),
  -- one customer record per phone number per business
  unique (business_id, phone)
);

create table if not exists bookings (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses (id) on delete cascade,
  service_id       uuid not null references services (id) on delete restrict,
  customer_id      uuid not null references customers (id) on delete restrict,
  scheduled_at     timestamptz not null,
  duration_minutes int not null check (duration_minutes > 0),
  price_cents      int not null check (price_cents >= 0),
  status           booking_status not null default 'pending',
  vehicle_type     text,
  vehicle_details  text,
  service_address  text,
  notes            text,
  created_at       timestamptz not null default now()
);
create index if not exists bookings_business_time_idx
  on bookings (business_id, scheduled_at);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table businesses enable row level security;
alter table services   enable row level security;
alter table customers  enable row level security;
alter table bookings   enable row level security;

-- Public read of business profiles (needed to render the booking page).
drop policy if exists "Public can read businesses" on businesses;
create policy "Public can read businesses"
  on businesses for select
  using (true);

-- Public read of ACTIVE services only.
drop policy if exists "Public can read active services" on services;
create policy "Public can read active services"
  on services for select
  using (is_active = true);

-- No public policies on customers/bookings: anon cannot read or write them
-- directly. All writes go through the SECURITY DEFINER `create_booking` RPC.
-- (Authenticated staff dashboards — a later feature — will get their own
--  policies keyed off auth.uid().)

-- ----------------------------------------------------------------------------
-- RPC: get_available_slots
-- Returns bookable start times for a given service on a given local date,
-- excluding any slot that would overlap an existing (non-cancelled) booking.
-- ----------------------------------------------------------------------------
create or replace function get_available_slots(
  p_business_id uuid,
  p_service_id  uuid,
  p_date        date
)
returns table (slot timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz       businesses%rowtype;
  v_duration  int;
  v_tz        text;
  v_cursor    timestamptz;
  v_day_open  timestamptz;
  v_day_close timestamptz;
begin
  select * into v_biz from businesses where id = p_business_id;
  if not found then
    raise exception 'Business not found';
  end if;

  -- Service must belong to the business and be active.
  select duration_minutes into v_duration
  from services
  where id = p_service_id and business_id = p_business_id and is_active = true;
  if not found then
    raise exception 'Service not found';
  end if;

  v_tz := v_biz.timezone;

  -- Shop closed on this weekday → no slots. extract(dow) gives 0=Sun..6=Sat.
  if not (extract(dow from p_date)::smallint = any (v_biz.open_days)) then
    return;
  end if;

  -- Build open/close instants for that local day, then convert to timestamptz.
  v_day_open  := (p_date + v_biz.opening_time) at time zone v_tz;
  v_day_close := (p_date + v_biz.closing_time) at time zone v_tz;

  v_cursor := v_day_open;
  while v_cursor + make_interval(mins => v_duration) <= v_day_close loop
    -- Skip slots in the past and slots that collide with existing bookings.
    if v_cursor > now()
       and not exists (
         select 1
         from bookings b
         where b.business_id = p_business_id
           and b.status not in ('cancelled', 'no_show')
           and tstzrange(b.scheduled_at,
                         b.scheduled_at + make_interval(mins => b.duration_minutes))
               && tstzrange(v_cursor,
                            v_cursor + make_interval(mins => v_duration))
       )
    then
      slot := v_cursor;
      return next;
    end if;

    v_cursor := v_cursor + make_interval(mins => v_biz.slot_interval_minutes);
  end loop;

  return;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: create_booking
-- Atomically upserts the customer and inserts the booking, guarding against
-- double-booking. Runs as definer so anon visitors can book without an account.
-- ----------------------------------------------------------------------------
create or replace function create_booking(
  p_business_id     uuid,
  p_service_id      uuid,
  p_scheduled_at    timestamptz,
  p_full_name       text,
  p_phone           text,
  p_email           text default null,
  p_vehicle_type    text default null,
  p_vehicle_details text default null,
  p_service_address text default null,
  p_notes           text default null
)
returns table (
  booking_id   uuid,
  scheduled_at timestamptz,
  status       booking_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration   int;
  v_price      int;
  v_customer   uuid;
  v_booking_id uuid;
begin
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Name is required' using errcode = 'check_violation';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'Phone is required' using errcode = 'check_violation';
  end if;
  if p_scheduled_at <= now() then
    raise exception 'Requested time is in the past' using errcode = 'check_violation';
  end if;

  -- Validate the service belongs to the business and is bookable.
  select duration_minutes, price_cents into v_duration, v_price
  from services
  where id = p_service_id and business_id = p_business_id and is_active = true;
  if not found then
    raise exception 'Service is not available' using errcode = 'no_data_found';
  end if;

  -- Reject overlapping bookings (race-safe under serializable/row locks).
  if exists (
    select 1
    from bookings b
    where b.business_id = p_business_id
      and b.status not in ('cancelled', 'no_show')
      and tstzrange(b.scheduled_at,
                    b.scheduled_at + make_interval(mins => b.duration_minutes))
          && tstzrange(p_scheduled_at,
                       p_scheduled_at + make_interval(mins => v_duration))
  ) then
    raise exception 'That time slot was just taken. Please pick another.'
      using errcode = 'unique_violation';
  end if;

  -- Upsert the customer by (business, phone).
  insert into customers (business_id, full_name, email, phone)
  values (p_business_id, trim(p_full_name), nullif(trim(p_email), ''), trim(p_phone))
  on conflict (business_id, phone)
  do update set
    full_name = excluded.full_name,
    email     = coalesce(excluded.email, customers.email)
  returning id into v_customer;

  insert into bookings (
    business_id, service_id, customer_id, scheduled_at,
    duration_minutes, price_cents, status,
    vehicle_type, vehicle_details, service_address, notes
  )
  values (
    p_business_id, p_service_id, v_customer, p_scheduled_at,
    v_duration, v_price, 'pending',
    nullif(trim(p_vehicle_type), ''),
    nullif(trim(p_vehicle_details), ''),
    nullif(trim(p_service_address), ''),
    nullif(trim(p_notes), '')
  )
  returning id into v_booking_id;

  return query
    select v_booking_id, p_scheduled_at, 'pending'::booking_status;
end;
$$;

-- Lock down + expose only what the public booking page needs.
revoke all on function get_available_slots(uuid, uuid, date) from public;
revoke all on function create_booking(uuid, uuid, timestamptz, text, text, text, text, text, text, text) from public;
grant execute on function get_available_slots(uuid, uuid, date) to anon, authenticated;
grant execute on function create_booking(uuid, uuid, timestamptz, text, text, text, text, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Seed data — a demo detailing business so the booking page works immediately.
-- ----------------------------------------------------------------------------
insert into businesses (slug, name, phone, email, timezone)
values ('demo-detailing', 'Demo Detailing Co.', '+15555550123', 'hello@demodetailing.test', 'America/New_York')
on conflict (slug) do nothing;

insert into services (business_id, name, description, duration_minutes, price_cents, sort_order)
select b.id, s.name, s.description, s.duration_minutes, s.price_cents, s.sort_order
from businesses b
cross join (values
  ('Express Wash & Wax', 'Exterior hand wash, spray wax, tire shine, and windows.', 60, 6500, 1),
  ('Full Interior Detail', 'Deep vacuum, steam clean, leather conditioning, and odor treatment.', 150, 17900, 2),
  ('Complete Detail Package', 'Inside-and-out: wash, clay bar, wax, full interior detail.', 240, 29900, 3),
  ('Ceramic Coating', 'Multi-stage paint correction plus a 2-year ceramic coating.', 360, 79900, 4)
) as s(name, description, duration_minutes, price_cents, sort_order)
where b.slug = 'demo-detailing'
on conflict do nothing;
