# COATPRO

Booking & management platform for auto detailers — built for solo mobile
detailers and small shops (2–15 people).

**Stack:** React 18 + TypeScript (Vite) · Tailwind CSS · Supabase (PostgreSQL)
· Stripe (payments, planned) · Twilio (SMS, planned).

This repository currently ships the **foundation + the first feature**: a
public, mobile-first **customer booking flow** wired end-to-end to Supabase.

---

## What's included

| Area | Details |
| --- | --- |
| **Booking wizard** | 4-step flow: choose service → pick date/time → enter details → confirmation. Full validation, loading & error states, mobile-first. |
| **Database** | `supabase/schema.sql` — `businesses`, `services`, `customers`, `bookings` with Row Level Security, plus two secure RPCs. |
| **Availability** | `get_available_slots` RPC computes open time slots server-side from business hours + existing bookings (no booking data leaks to the client). |
| **Atomic booking** | `create_booking` RPC upserts the customer and creates the booking in one transaction, rejecting double-bookings. |
| **Type safety** | Hand-written `src/types/database.ts` typing the Supabase client end-to-end. |
| **Owner dashboard** | `/admin` — KPIs, a 7-day revenue chart, customer & booking management, and editable business settings/services. Backed by `admin_*` RPCs in `supabase/admin.sql`. |

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **SQL Editor** and run the contents of
   [`supabase/schema.sql`](./supabase/schema.sql). This creates the tables,
   RLS policies, RPCs, and a `demo-detailing` business with sample services.
3. Copy your credentials from **Project Settings → API**.

```bash
cp .env.example .env
```

Then fill in `.env`:

```env
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key"
VITE_DEFAULT_BUSINESS_SLUG="demo-detailing"
```

> The app shows a friendly setup screen until these are set, so it never
> crashes on a fresh clone.

### 3. Run it

```bash
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
npm run lint     # ESLint
```

Open the dev URL. The booking page loads the business identified by the URL
path (e.g. `/demo-detailing`), falling back to `VITE_DEFAULT_BUSINESS_SLUG`.

### 4. Owner dashboard (`/admin`)

The owner dashboard lives at `/admin` (also `/dashboard`). It needs the
server-side admin RPCs, so run [`supabase/admin.sql`](./supabase/admin.sql)
**after** `schema.sql` (it also seeds extra demo bookings/customers so the
dashboard isn't empty):

```bash
# hosted: paste into the Supabase SQL editor. local CLI:
psql "$DB_URL" -f supabase/admin.sql
```

> Security: the `admin_*` RPCs are currently granted to `anon` because the app
> has no login yet. Once staff auth lands, revoke them from `anon` and gate on
> `auth.uid()` — see the note at the top of `supabase/admin.sql`.

---

## Project structure

```
src/
  lib/
    supabase.ts          # typed Supabase client (+ config guard)
    format.ts            # price/date/duration formatting helpers
    validation.ts        # form validation helpers + messages
  hooks/
    useBusiness.ts       # load business + active services by slug
    useAvailableSlots.ts # fetch open time slots via RPC
  components/
    ui/                  # Spinner + hand-rolled SVG icons (no icon lib)
    booking/             # the booking wizard
      BookingFlow.tsx    # orchestrates the steps + submission
      StepIndicator.tsx
      ServiceStep.tsx
      DateTimeStep.tsx
      DetailsStep.tsx
      ConfirmationStep.tsx
  App.tsx                # public booking page shell
supabase/
  schema.sql             # tables, RLS, RPCs, seed data
```

---

## Security model

- Every table has **RLS enabled**. The browser uses the public `anon` key.
- Anonymous visitors can **only read** business profiles and *active* services.
- They **cannot** read or write `customers`/`bookings` directly.
- All writes go through the `SECURITY DEFINER` `create_booking` RPC, which
  validates input and prevents double-booking inside one transaction.

This keeps the public booking page fully functional without exposing any
customer data.

---

## Roadmap (next features)

- **Auth + staff dashboard** — owners manage services, view/confirm bookings.
- **Stripe** — deposits & payments on booking.
- **Twilio** — SMS confirmations and reminders (triggered after `create_booking`).
- **Calendar / availability rules** — per-staff schedules, blackout dates.

To regenerate database types once the schema stabilises:

```bash
npx supabase gen types typescript --project-id <ref> > src/types/database.ts
```
