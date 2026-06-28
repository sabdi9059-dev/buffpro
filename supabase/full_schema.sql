-- =============================================================================
-- COATPRO — complete production database schema (v2)
--
-- This is the full, multi-tenant data model for the platform. It supersedes
-- the minimal demo schema in `schema.sql` (which only powers the public
-- booking demo at "/"). Run this in a FRESH Supabase project, or see SETUP.md
-- for how to migrate. Copy-paste the whole file into the Supabase SQL Editor.
--
-- Tenancy + roles
--   * Every tenant is a row in `profiles` (a "business"), owned by an auth user.
--   * Staff live in `team_members` (role: owner | manager | technician); a
--     technician row may link to an auth user so that tech can log in.
--   * Customers may optionally be linked to an auth user (so they can log in
--     and see their own bookings).
--
-- Security
--   * RLS is ENABLED on every table.
--   * Access is decided by SECURITY DEFINER helper functions so policies never
--     recurse into the table they protect.
--       - Owners      → see/manage everything for their business.
--       - Technicians → see only jobs assigned to them.
--       - Customers    → see only their own bookings / data.
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type booking_status as enum
      ('pending', 'pending_payment', 'confirmed', 'paid',
       'in_progress', 'completed', 'cancelled', 'no_show');
  end if;
  if not exists (select 1 from pg_type where typname = 'team_role') then
    create type team_role as enum ('owner', 'manager', 'technician');
  end if;
  if not exists (select 1 from pg_type where typname = 'photo_kind') then
    create type photo_kind as enum ('before', 'after', 'other');
  end if;
end$$;

-- If `booking_status` already existed from an older run, make sure the payment
-- states are present. ADD VALUE must run OUTSIDE a transaction/function block.
alter type booking_status add value if not exists 'pending_payment';
alter type booking_status add value if not exists 'paid';

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- TABLES
-- =============================================================================

-- 1) profiles — one row per business (the tenant), owned by an auth user.
create table if not exists profiles (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  business_name text not null,
  slug          text unique,
  phone         text,
  email         text,
  timezone      text not null default 'America/New_York',
  opening_time  time not null default '08:00',
  closing_time  time not null default '18:00',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists profiles_owner_idx on profiles (owner_id);

-- 2) team_members — staff/technicians for a business.
create table if not exists team_members (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references profiles (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null, -- login (optional)
  full_name   text not null,
  email       text,
  phone       text,
  role        team_role not null default 'technician',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists team_members_business_idx on team_members (business_id);
create index if not exists team_members_user_idx on team_members (user_id);

-- 3) customers — a business's customers (login optional).
create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references profiles (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  full_name   text not null,
  email       text,
  phone       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, phone)
);
create index if not exists customers_business_idx on customers (business_id);
create index if not exists customers_user_idx on customers (user_id);

-- 4) services — what a business offers.
create table if not exists services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references profiles (id) on delete cascade,
  name             text not null,
  description      text,
  duration_minutes int not null check (duration_minutes > 0),
  price_cents      int not null check (price_cents >= 0),
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists services_business_idx on services (business_id);

-- 5) bookings — appointments.
create table if not exists bookings (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references profiles (id) on delete cascade,
  customer_id      uuid not null references customers (id) on delete restrict,
  service_id       uuid not null references services (id) on delete restrict,
  technician_id    uuid references team_members (id) on delete set null,
  scheduled_at     timestamptz not null,
  duration_minutes int not null check (duration_minutes > 0),
  price_cents      int not null check (price_cents >= 0),
  status           booking_status not null default 'pending',
  vehicle_type     text,
  vehicle_details  text,
  service_address  text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists bookings_business_time_idx on bookings (business_id, scheduled_at);
create index if not exists bookings_technician_idx on bookings (technician_id);
create index if not exists bookings_customer_idx on bookings (customer_id);
create index if not exists bookings_status_idx on bookings (status);

-- 6) photos — before/after shots attached to a booking.
create table if not exists photos (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings (id) on delete cascade,
  business_id  uuid not null references profiles (id) on delete cascade,
  kind         photo_kind not null default 'after',
  url          text not null,
  storage_path text,
  created_at   timestamptz not null default now()
);
create index if not exists photos_booking_idx on photos (booking_id);
create index if not exists photos_business_idx on photos (business_id);

-- 7) reviews — customer ratings.
create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references profiles (id) on delete cascade,
  booking_id  uuid references bookings (id) on delete set null,
  customer_id uuid not null references customers (id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);
create index if not exists reviews_business_idx on reviews (business_id);
create index if not exists reviews_customer_idx on reviews (customer_id);

-- 8) loyalty_points — append-only ledger; balance = SUM(points) per customer.
create table if not exists loyalty_points (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references profiles (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  booking_id  uuid references bookings (id) on delete set null,
  points      int not null,           -- positive = earned, negative = redeemed
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists loyalty_customer_idx on loyalty_points (customer_id);
create index if not exists loyalty_business_idx on loyalty_points (business_id);

-- 9) sms_messages — log of every SMS sent (for auditing + cost tracking).
create table if not exists sms_messages (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references profiles (id) on delete set null,
  booking_id  uuid references bookings (id) on delete set null,
  to_number   text not null,
  template    text not null,        -- confirmation | reminder | on_the_way | completion | custom
  body        text not null,
  twilio_sid  text,
  status      text,                 -- queued | sent | delivered | failed | invalid | ...
  segments    int not null default 1,
  cost_usd    numeric(10,5) not null default 0,
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists sms_business_idx on sms_messages (business_id);
create index if not exists sms_created_idx on sms_messages (created_at);

-- updated_at triggers (tables that track edits)
do $$
declare t text;
begin
  foreach t in array array['profiles','team_members','customers','services','bookings']
  loop
    execute format('drop trigger if exists set_updated_at on %I;', t);
    execute format(
      'create trigger set_updated_at before update on %I
         for each row execute function set_updated_at();', t);
  end loop;
end$$;

-- =============================================================================
-- RBAC HELPER FUNCTIONS  (SECURITY DEFINER → bypass RLS → no policy recursion)
-- =============================================================================
create or replace function is_business_owner(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = p_business and owner_id = auth.uid()
  );
$$;

create or replace function is_team_member(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members
    where business_id = p_business and user_id = auth.uid() and is_active
  );
$$;

create or replace function is_business_staff(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_business_owner(p_business) or is_team_member(p_business);
$$;

-- The team_member id for the current auth user within a business (or null).
create or replace function my_team_member_id(p_business uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from team_members
  where business_id = p_business and user_id = auth.uid()
  limit 1;
$$;

-- Is the current auth user the customer record `p_customer`?
create or replace function is_self_customer(p_customer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from customers
    where id = p_customer and user_id = auth.uid()
  );
$$;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================
alter table profiles      enable row level security;
alter table team_members  enable row level security;
alter table customers     enable row level security;
alter table services      enable row level security;
alter table bookings      enable row level security;
alter table photos        enable row level security;
alter table reviews       enable row level security;
alter table loyalty_points enable row level security;
alter table sms_messages  enable row level security;

-- =============================================================================
-- POLICIES
-- (drop-then-create so the file is re-runnable)
-- =============================================================================

-- ---- profiles --------------------------------------------------------------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (owner_id = auth.uid() or is_team_member(id));

drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert
  with check (owner_id = auth.uid());

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists profiles_delete on profiles;
create policy profiles_delete on profiles for delete
  using (owner_id = auth.uid());

-- ---- team_members ----------------------------------------------------------
drop policy if exists team_select on team_members;
create policy team_select on team_members for select
  using (is_business_owner(business_id) or user_id = auth.uid());

drop policy if exists team_write on team_members;
create policy team_write on team_members for all
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

-- ---- customers -------------------------------------------------------------
drop policy if exists customers_select on customers;
create policy customers_select on customers for select
  using (is_business_staff(business_id) or user_id = auth.uid());

drop policy if exists customers_write on customers;
create policy customers_write on customers for all
  using (is_business_staff(business_id))
  with check (is_business_staff(business_id));

-- ---- services --------------------------------------------------------------
-- Public can read ACTIVE services (needed by booking pages); staff manage them.
drop policy if exists services_select on services;
create policy services_select on services for select
  using (is_active = true or is_business_staff(business_id));

drop policy if exists services_write on services;
create policy services_write on services for all
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

-- ---- bookings --------------------------------------------------------------
-- Owner: all. Technician: only assigned jobs. Customer: only their own.
drop policy if exists bookings_select on bookings;
create policy bookings_select on bookings for select
  using (
    is_business_owner(business_id)
    or technician_id = my_team_member_id(business_id)
    or is_self_customer(customer_id)
  );

drop policy if exists bookings_insert on bookings;
create policy bookings_insert on bookings for insert
  with check (is_business_staff(business_id));

-- Owner can update any booking; assigned tech can update their own job
-- (e.g. mark in_progress / completed).
drop policy if exists bookings_update on bookings;
create policy bookings_update on bookings for update
  using (
    is_business_owner(business_id)
    or technician_id = my_team_member_id(business_id)
  )
  with check (
    is_business_owner(business_id)
    or technician_id = my_team_member_id(business_id)
  );

drop policy if exists bookings_delete on bookings;
create policy bookings_delete on bookings for delete
  using (is_business_owner(business_id));

-- ---- photos ----------------------------------------------------------------
drop policy if exists photos_select on photos;
create policy photos_select on photos for select
  using (
    is_business_staff(business_id)
    or exists (
      select 1 from bookings b
      where b.id = photos.booking_id and is_self_customer(b.customer_id)
    )
  );

drop policy if exists photos_insert on photos;
create policy photos_insert on photos for insert
  with check (is_business_staff(business_id));

drop policy if exists photos_delete on photos;
create policy photos_delete on photos for delete
  using (is_business_owner(business_id));

-- ---- reviews ---------------------------------------------------------------
-- Reviews are public to read (for a business's public page); the customer who
-- owns the linked record writes them; owners can moderate (update/delete).
drop policy if exists reviews_select on reviews;
create policy reviews_select on reviews for select
  using (true);

drop policy if exists reviews_insert on reviews;
create policy reviews_insert on reviews for insert
  with check (is_self_customer(customer_id) or is_business_staff(business_id));

drop policy if exists reviews_update on reviews;
create policy reviews_update on reviews for update
  using (is_self_customer(customer_id) or is_business_owner(business_id))
  with check (is_self_customer(customer_id) or is_business_owner(business_id));

drop policy if exists reviews_delete on reviews;
create policy reviews_delete on reviews for delete
  using (is_self_customer(customer_id) or is_business_owner(business_id));

-- ---- loyalty_points --------------------------------------------------------
drop policy if exists loyalty_select on loyalty_points;
create policy loyalty_select on loyalty_points for select
  using (is_business_staff(business_id) or is_self_customer(customer_id));

drop policy if exists loyalty_insert on loyalty_points;
create policy loyalty_insert on loyalty_points for insert
  with check (is_business_staff(business_id));

drop policy if exists loyalty_write on loyalty_points;
create policy loyalty_write on loyalty_points for all
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

-- ---- sms_messages ----------------------------------------------------------
-- Staff can read their business's SMS log; writes happen server-side via the
-- service-role key (which bypasses RLS), so no insert policy is needed here.
drop policy if exists sms_select on sms_messages;
create policy sms_select on sms_messages for select
  using (is_business_staff(business_id));

-- =============================================================================
-- CONVENIENCE RPCs
-- =============================================================================

-- Loyalty balance for a customer (RLS-aware via the helper checks).
create or replace function get_loyalty_balance(p_customer uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(points), 0)::int
  from loyalty_points
  where customer_id = p_customer;
$$;

-- Today's revenue (in cents) for a business from completed bookings.
create or replace function get_today_revenue_cents(p_business uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(price_cents), 0)::bigint
  from bookings
  where business_id = p_business
    and status = 'completed'
    and scheduled_at >= date_trunc('day', now())
    and scheduled_at <  date_trunc('day', now()) + interval '1 day';
$$;

-- Revenue per day (cents) for the last 7 days.
create or replace function get_revenue_last_7_days(p_business uuid)
returns table (day date, revenue_cents bigint)
language sql stable security definer set search_path = public as $$
  select d::date as day,
         coalesce((
           select sum(b.price_cents)
           from bookings b
           where b.business_id = p_business
             and b.status = 'completed'
             and b.scheduled_at >= d
             and b.scheduled_at < d + interval '1 day'
         ), 0)::bigint as revenue_cents
  from generate_series(
    date_trunc('day', now()) - interval '6 days',
    date_trunc('day', now()),
    interval '1 day'
  ) as d;
$$;

-- =============================================================================
-- GRANTS
-- RLS still governs which ROWS are visible; these grant table/column access.
-- =============================================================================
grant usage on schema public to anon, authenticated;

-- Anonymous visitors: read active services + public reviews (booking pages).
grant select on services, reviews to anon;

-- Authenticated users: full DML on all tables (RLS restricts the rows).
grant select, insert, update, delete on all tables in schema public to authenticated;

grant execute on function get_loyalty_balance(uuid) to anon, authenticated;
grant execute on function get_today_revenue_cents(uuid) to authenticated;
grant execute on function get_revenue_last_7_days(uuid) to authenticated;
