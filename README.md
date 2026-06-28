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
| **Standalone booking calendar** | `src/components/booking/BookingCalendar.tsx` — a self-contained, copy-paste-ready widget (service dropdown, custom 7–30 day calendar, time slots, customer/vehicle form, live summary, ceramic upsell, "Book & Pay Now"). No Supabase/Stripe deps yet — wire them via the `onSubmit` prop. View it at `/calendar`. |
| **Technician dashboard** | `src/components/dashboard/TechnicianDashboard.tsx` — mobile-first daily dashboard: header, today's stats, jobs list with Start/End/Complete actions, Details + Complete-Job modals (photo upload preview), 30s auto-refresh with new-booking/cancellation notifications, and an empty state. Ships with mock data; pass a `fetchJobs` prop for real data. View it at `/dashboard`. |
| **Owner/admin dashboard** | `src/components/dashboard/OwnerDashboard.tsx` — tabbed admin console (Dashboard / Customers / Bookings / Settings) with desktop sidebar + mobile scrolling tabs, KPI cards, a hand-drawn SVG revenue chart, searchable customers, date-filtered bookings with a details modal, and editable settings + services CRUD with a success toast. All mock data. View it at `/admin`. |

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

Open the dev URL. Routes:

- `/` (or `/<business-slug>`) — Supabase-backed public booking page.
- `/calendar` — standalone booking calendar widget (no backend needed).
- `/dashboard` — technician dashboard with mock data (no backend needed).
- `/admin` — owner/admin dashboard with tabs + mock data (no backend needed).
- `/pay` — Stripe card payment demo.
- `/login`, `/signup` — auth pages; `/account` — protected (requires login).
- `/landing.html` — standalone marketing landing page (static HTML, no framework).

The booking page loads the business identified by the URL path
(e.g. `/demo-detailing`), falling back to `VITE_DEFAULT_BUSINESS_SLUG`.

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
      BookingFlow.tsx    # orchestrates the steps + submission (Supabase-backed)
      StepIndicator.tsx
      ServiceStep.tsx
      DateTimeStep.tsx
      DetailsStep.tsx
      ConfirmationStep.tsx
      BookingCalendar.tsx # standalone calendar widget (route: /calendar)
  dashboard/
    TechnicianDashboard.tsx # mobile-first tech dashboard (route: /dashboard)
    OwnerDashboard.tsx      # tabbed owner/admin console (route: /admin)
  App.tsx                # public booking page shell
supabase/
  schema.sql             # tables, RLS, RPCs, seed data
```

---

## Full production database (v2)

Beyond the minimal demo schema, the repo ships the **complete multi-tenant data
model** the platform is built around:

| File | What it is |
| --- | --- |
| `supabase/full_schema.sql` | 8 tables (`profiles`, `team_members`, `customers`, `services`, `bookings`, `photos`, `reviews`, `loyalty_points`) with UUID PKs, FKs, indexes, `updated_at` triggers, role-based RLS (owner / technician / customer), and convenience RPCs. |
| `supabase/SETUP.md` | Step-by-step setup, the RLS model, and copy-paste test queries. |
| `src/types/coatpro-db.ts` | TypeScript interface for every table + a typed `CoatproDatabase`. |
| `src/lib/queries.ts` | Typed, error-handled implementations of the common queries (today's jobs, revenue, customer count, insert/complete booking, history, 7-day revenue trend, photos, reviews, loyalty points). |

> The demo `schema.sql` and `full_schema.sql` both define `services`/`customers`/
> `bookings` with different columns — run them in **separate** Supabase projects.
> See `supabase/SETUP.md`.

## Payments (Stripe)

End-to-end card payments for a booking:

| File | Role |
| --- | --- |
| `src/components/payment/BookingPaymentForm.tsx` | Frontend card form (Stripe `<CardElement/>`), loading/error/success states, validation. Demo at `/pay`. |
| `src/lib/stripe.ts` | Browser Stripe.js loader (publishable key). |
| `api/create-payment-intent.ts` | `POST /api/create-payment-intent` — validates the amount against the booking and returns a `clientSecret`. |
| `api/webhook.ts` | `POST /api/webhook` — verifies the Stripe signature, marks the booking `paid`, and sends the Twilio SMS confirmation. |
| `api/_lib/clients.ts` | Server-only Stripe / Supabase (service role) / Twilio clients. |

**Flow:** create booking (`pending_payment`) → `create-payment-intent` → customer pays with the card form → Stripe `payment_intent.succeeded` webhook → booking → `paid` + SMS sent.

**Required env** (see `.env.example`): `VITE_STRIPE_PUBLISHABLE_KEY` (client) and, server-only, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

**Local webhook testing:**

```bash
stripe listen --forward-to localhost:3000/api/webhook   # prints the whsec_… secret
```

**Test cards:** success `4242 4242 4242 4242` · decline `4000 0000 0000 0002` · any future expiry (e.g. `12/25`) · any 3-digit CVC.

The `/api` routes deploy as Vercel serverless functions; `vercel.json` keeps the SPA fallback from swallowing them.

## SMS (Twilio)

Transactional + scheduled texts, all server-side:

| File | Role |
| --- | --- |
| `api/_lib/sms.ts` | Twilio sender core: E.164 validation, message templates, retry with backoff, logging + **cost tracking**, budget alert, and the four senders (`sendConfirmation`, `sendReminder`, `sendOnTheWay`, `sendCompletion`). |
| `api/notify.ts` | `POST /api/notify` — event trigger ({ type, booking_id, … }) for confirmation / on-the-way / completion / reminder. |
| `api/cron/daily-reminders.ts` | Scheduled job: finds tomorrow's bookings and texts each customer. Wired to a Vercel cron in `vercel.json` (08:00 UTC). |
| `sms_messages` table | Every send is logged (template, segments, `cost_usd`, status) in `full_schema.sql` for auditing + budgeting. |

**Triggers**
1. Booking confirmed / paid → confirmation (the Stripe webhook calls `sendConfirmation`).
2. 24h before → reminder (the daily cron).
3. Tech starts job → on-the-way with ETA (`POST /api/notify` `type: on_the_way`).
4. Job completed → completion with review link (`type: completion`).
5. Daily 08:00 cron → reminders for next-day bookings.

**Cost tracking:** each send records estimated cost (`SMS_COST_PER_MESSAGE`, ~$0.0079/segment) to `sms_messages`; `checkMonthlyBudget()` warns when month-to-date spend exceeds `SMS_MONTHLY_BUDGET_USD`.

**Reliability:** invalid numbers are rejected before calling Twilio; transient failures (rate limit / 5xx / network) retry up to 3× with exponential backoff; everything is logged and senders never throw.

**Required env** (see `.env.example`): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, plus optional `SMS_COST_PER_MESSAGE`, `SMS_MONTHLY_BUDGET_USD`, `CRON_SECRET`, `INTERNAL_API_SECRET`, `APP_URL`.

**Dev test numbers** (Twilio magic numbers): `+15005550006` succeeds · `+15005550001` invalid · `+15005550009` can't receive.

## Marketing landing page

`public/landing.html` is a **standalone**, copy-pasteable marketing page (no React) served at **`/landing.html`**: hero, 6 feature cards, 3-tier pricing (Pro highlighted), testimonials, an accessible FAQ accordion (native `<details>`), a beta-signup form, and a footer. It uses the Tailwind Play CDN + a little vanilla JS, and posts the beta form to `POST /api/beta-signup` (`api/beta-signup.ts` → `beta_signups` table). Brand gradient purple `#667eea` → blue `#764ba2`, accent green `#10b981`, system fonts.

> For best production performance, compile Tailwind instead of the CDN — the markup is unchanged.

## Authentication & multi-tenancy

Email/password auth with Supabase, scoped per business:

| File | Role |
| --- | --- |
| `src/auth/AuthContext.tsx` | `AuthProvider` + `useAuth()` → `{ user, session, businessId, role, isLoading, signUp, signIn, logout, isOwner, isTechnician }`. Checks the session on load and subscribes to auth changes; resolves tenancy via the `get_my_membership` RPC. |
| `src/auth/ProtectedRoute.tsx` | Gate routes by auth (and optional `roles`): spinner while checking, redirect to `/login`, access-denied for wrong role. |
| `src/pages/LoginPage.tsx` | Email + password + remember me, validation, errors. Route `/login`. |
| `src/pages/SignUpPage.tsx` | Email + password + business name; handles the email-confirmation case. Route `/signup`. |
| `src/pages/AccountPage.tsx` | Protected demo page showing user, business, role + permissions. Route `/account`. |

**Sign-up flow:** `signUp` passes `business_name` as user metadata. The `handle_new_user` trigger in `full_schema.sql` then auto-creates the business `profiles` row and an `owner` `team_members` row — so a new owner is fully provisioned the moment their auth user exists.

**Roles & isolation** (enforced by RLS in `full_schema.sql`, not just the UI):
- **Owner** — edit settings, manage staff, see all of their business's data.
- **Technician** — see only jobs assigned to them; mark them complete.
- **Customer** — see only their own bookings.
- No policy path lets one business read another's data.

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
