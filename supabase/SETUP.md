# COATPRO — Supabase setup

This guide sets up the **full production database** (`full_schema.sql`): 8 tables,
foreign keys, indexes, `updated_at` triggers, Row Level Security (RLS), and a few
convenience RPCs.

> **Two schemas, on purpose.**
> - `schema.sql` — the minimal demo schema that powers the public booking page at `/`.
> - `full_schema.sql` — the complete, multi-tenant model described here.
>
> They both define tables named `services`, `customers`, and `bookings` but with
> different columns. **Do not run both in the same database.** Use a fresh
> Supabase project for `full_schema.sql` (or drop the demo tables first).

---

## 1. Run the schema

1. Open your project at [supabase.com](https://supabase.com) → **SQL Editor** → **New query**.
2. Paste the **entire** contents of [`full_schema.sql`](./full_schema.sql).
3. Click **Run**.

The script is re-runnable: it uses `create ... if not exists`, `create or replace`
for functions, and `drop policy if exists` before each `create policy`. RLS is
**enabled inside the script** (`alter table ... enable row level security`), and all
policies + grants are created — there is nothing else to toggle in the dashboard.

### What gets created

| Table | Purpose |
| --- | --- |
| `profiles` | One row per **business** (tenant), owned by an auth user. |
| `team_members` | Staff/technicians (`owner` / `manager` / `technician`). |
| `customers` | A business's customers (optional auth login). |
| `services` | Offerings (name, price, duration). |
| `bookings` | Appointments (links customer + service + optional technician). |
| `photos` | Before/after photos attached to a booking. |
| `reviews` | 1–5 star customer ratings. |
| `loyalty_points` | Append-only points ledger (balance = `SUM(points)`). |

All tables use **UUID primary keys**, foreign keys with sensible
`on delete` behavior, `created_at`/`updated_at` timestamps, `CHECK` constraints
(e.g. `rating between 1 and 5`, `price_cents >= 0`), and indexes on every
frequently-queried column (`business_id`, `scheduled_at`, `technician_id`, …).

---

## 2. Row Level Security model

RLS is on for every table. Access is decided by `SECURITY DEFINER` helper
functions (`is_business_owner`, `is_team_member`, `is_business_staff`,
`my_team_member_id`, `is_self_customer`) so policies never recurse.

| Role | Can see / do |
| --- | --- |
| **Owner** (`profiles.owner_id = auth.uid()`) | Everything for their business. |
| **Technician** (`team_members.user_id = auth.uid()`) | Only bookings assigned to them; can update their own jobs (e.g. mark completed). |
| **Customer** (`customers.user_id = auth.uid()`) | Only their own bookings, photos, loyalty, and reviews. |
| **Anonymous** (`anon`) | Read **active services** and **reviews** only. |

Because tenancy is keyed on `business_id`, **one business can never read another
business's data** — there is no policy path that returns rows across tenants.

---

## 3. Use it from the app

```ts
import { createCoatproClient, getTodayRevenue } from '@/lib/queries';

const db = createCoatproClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

const revenue = await getTodayRevenue(db, businessId); // dollars
```

`src/lib/queries.ts` ships typed, error-handled implementations of all the
common queries (today's jobs, today's revenue, customer count, insert booking,
complete booking, booking history, 7-day revenue trend, add photo, list
reviews, add loyalty points). `src/types/coatpro-db.ts` has a TypeScript
interface for every table.

### Regenerate types from the live schema (optional)

```bash
npx supabase gen types typescript --project-id <ref> > src/types/coatpro-db.ts
```

---

## 4. Test the queries in the SQL Editor

After running the schema you can sanity-check the data model. Replace the UUIDs
with real ones from your tables.

```sql
-- Create a business owned by the currently signed-in user (run while authed),
-- or insert a test row directly:
insert into profiles (owner_id, business_name, slug)
values (auth.uid(), 'Test Detailing', 'test-detailing')
returning id;

-- Add a service + a customer for that business (use the id from above):
insert into services (business_id, name, duration_minutes, price_cents)
values ('<business_id>', 'Exterior Wash', 60, 2999) returning id;

insert into customers (business_id, full_name, phone)
values ('<business_id>', 'Maria Lopez', '+12025550123') returning id;

-- Book it:
insert into bookings
  (business_id, customer_id, service_id, scheduled_at, duration_minutes, price_cents, status)
values
  ('<business_id>', '<customer_id>', '<service_id>', now(), 60, 2999, 'completed');

-- Convenience RPCs:
select get_today_revenue_cents('<business_id>');   -- bigint cents
select * from get_revenue_last_7_days('<business_id>');
select get_loyalty_balance('<customer_id>');
```

> **Note on RLS while testing:** the SQL Editor runs as a privileged role and
> bypasses RLS, so all rows are visible there. To verify policies behave as a
> real user, test from the client with the **anon key** and an authenticated
> session (e.g. via `supabase.auth.signInWithPassword`), or use the dashboard's
> "Run as role" option.
