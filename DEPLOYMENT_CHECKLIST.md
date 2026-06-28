# COATPRO — Production Deployment Checklist

A practical, print-friendly go-live checklist for **COATPRO** (Vite + React SPA · Supabase · Stripe · Twilio · Vercel serverless functions + cron).

**How to use it**
- Work top-to-bottom. Everything marked **P0** is a launch blocker.
- Tick each box as you verify it in the *production* environment (not just locally).
- Print/export: this is plain Markdown — open in any viewer and "Print to PDF", or paste into Notion/Confluence/GitHub.

**Legend**
- **Priority:** `P0` = blocks launch · `P1` = do at launch · `P2` = fast-follow after launch.
- **Effort:** `Quick` (config/toggle) · `Moderate` (some code/setup) · `Involved` (multi-step or cross-team).

> ℹ️ This checklist uses **priority + effort** rather than calendar estimates — they're more reliable than "X days," which varies wildly by team and environment.

---

## COATPRO-specific quick status (from this repo)

A few items are already in good shape; a few need action before launch:

- ✅ **No hardcoded secrets** in `src/` — all keys come from env (`VITE_*` client, non-`VITE_` server). Verified by scan.
- ✅ **RLS defined** on every table in `supabase/full_schema.sql` (owner/technician/customer isolation).
- ✅ **Stripe webhook signature verification** implemented (`api/webhook.ts`).
- ✅ **Server-side input validation** in every `api/*` function.
- ✅ **Privacy/Terms links + support email** referenced in `public/landing.html` (pages still need to be written — see C).
- ⚠️ **Remove the demo `console.log`** in `src/components/booking/BookingCalendar.tsx` (~line 253) before shipping. `console.warn` in `src/lib/supabase.ts` and `console.error` in `src/auth/AuthContext.tsx` are acceptable but ideally routed to Sentry.
- ⚠️ **Two Supabase schemas exist** — `schema.sql` (demo) and `full_schema.sql` (production). Deploy **only `full_schema.sql`** to the production project (see `supabase/SETUP.md`).
- ⚠️ **Dashboards/booking calendar still use mock data** — wire them to `src/lib/queries.ts` + `/api` before relying on them in production.

---

## A) Frontend

- [ ] **Remove demo `console.log` statements** — `P0` · `Quick`
  - *Why:* leaks internal data to the browser console and looks unprofessional.
  - *How:* delete the payload log in `BookingCalendar.tsx`. To catch the rest, add the Vite esbuild drop: in `vite.config.ts`, `esbuild: { drop: ['console', 'debugger'] }` (strips them from the production bundle while keeping dev logs).
  - *Tool:* `rg "console\." src` to find them.
- [ ] **No hardcoded API keys** — `P0` · `Quick`
  - *Why:* committed secrets get scraped within minutes.
  - *How:* only `VITE_*` keys may reach the client, and only *publishable*/anon keys (`VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`). Verify with `rg "sk_live|sk_test|whsec_|SERVICE_ROLE" src`.
- [ ] **Test all forms / validation** — `P0` · `Moderate`
  - *Why:* the booking, payment, signup, login, and beta forms are your funnel.
  - *How:* submit empty, invalid, and valid inputs for each; confirm inline error messages clear on fix.
- [ ] **Test on a real iPhone + Android** — `P0` · `Moderate`
  - *Why:* emulators miss iOS Safari quirks (input zoom, safe-area, tap targets).
  - *Tool:* BrowserStack / real devices. Check at 375px width.
- [ ] **Payment flow end-to-end** — `P0` · `Moderate` (see E).
- [ ] **SMS delivery** — `P0` · `Moderate` (see E).
- [ ] **Photo upload** — `P1` · `Moderate`
  - *Why:* before/after proof is a core feature.
  - *How:* once wired to **Supabase Storage**, verify upload + preview + the `photos` row; check file-size/type limits.
- [ ] **Lighthouse performance > 80** — `P1` · `Moderate`
  - *Tool:* Chrome DevTools → Lighthouse, or [PageSpeed Insights](https://pagespeed.web.dev/).
  - *How:* the landing page uses the Tailwind **Play CDN** — compile Tailwind for production to cut JS/CSS. Code-split heavy routes if needed.
- [ ] **Accessibility audit** — `P1` · `Moderate`
  - *Tool:* [WAVE](https://wave.webaim.org/), axe DevTools, Lighthouse a11y. Test keyboard nav + screen reader on the booking flow.
- [ ] **Optimize bundle size** — `P2` · `Moderate`
  - *Tool:* `npx vite-bundle-visualizer`. Lazy-load `BookingPaymentForm` (Stripe) and dashboards with `React.lazy`.
- [ ] **Remove unused imports / dead code** — `P2` · `Quick`
  - *Tool:* `npm run lint` (the repo already runs `eslint` with `noUnusedLocals` in tsconfig). Keep CI green.

---

## B) Backend / Database

- [ ] **All env vars set in the platform** — `P0` · `Quick`
  - *Why:* missing vars cause runtime 500s.
  - *How:* in Vercel → Project → Settings → Environment Variables, set everything in `.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, and server-only `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `CRON_SECRET`, `INTERNAL_API_SECRET`, `APP_URL`, plus optional `SMS_*`.
- [ ] **Database backups enabled** — `P0` · `Quick`
  - *Tool:* Supabase → Database → Backups. Daily backups + Point-in-Time Recovery (PITR) on paid plans.
- [ ] **RLS policies tested** — `P0` · `Involved`
  - *Why:* RLS is the only thing stopping cross-tenant data leaks.
  - *How:* the SQL editor bypasses RLS — test as a real user. Sign in as Owner A and confirm you **cannot** read Business B's bookings/customers; confirm a technician sees only assigned jobs. See "test queries" in `supabase/SETUP.md`.
- [ ] **Stripe keys are PRODUCTION (live) keys** — `P0` · `Quick`
  - *Why:* test keys won't charge real cards; live test cards won't work in prod.
  - *How:* swap `sk_test_…`/`pk_test_…` for `sk_live_…`/`pk_live_…` in env. Remove the test-card hint text from the live payment form.
- [ ] **Webhook URL updated to the production domain** — `P0` · `Quick`
  - *How:* Stripe Dashboard → Developers → Webhooks → add `https://yourdomain.com/api/webhook`, subscribe to `payment_intent.succeeded`, copy the new **`whsec_…`** into `STRIPE_WEBHOOK_SECRET`.
- [ ] **Error logging set up** — `P1` · `Moderate`
  - *Tool:* [Sentry](https://sentry.io) (frontend + serverless), or Logflare/Better Stack for logs. Capture the `console.error`s currently in `api/*` and the auth context.
- [ ] **Rate limiting on API endpoints** — `P1` · `Moderate`
  - *Why:* `create-payment-intent`, `notify`, and `beta-signup` are abusable.
  - *Tool:* [Upstash Ratelimit](https://github.com/upstash/ratelimit) (works on Vercel edge/serverless) or Vercel WAF. Key by IP + email.
- [ ] **Input validation on all endpoints** — `P0` · `Quick`
  - *Status:* already present in every `api/*` handler. *Harden:* consider [zod](https://zod.dev) schemas for request bodies.
- [ ] **Verify the daily-reminders cron** — `P1` · `Quick`
  - *How:* confirm the `crons` entry in `vercel.json` runs (Vercel → Cron Jobs), and that `CRON_SECRET` is set so the endpoint rejects unauthorized calls. Note Vercel cron is **UTC** — adjust the `0 8 * * *` schedule to your local 8 AM.

---

## C) Security

- [ ] **No API secrets in code** — `P0` · `Quick` — verified (see A); re-scan before each deploy. Use [gitleaks](https://github.com/gitleaks/gitleaks) in CI.
- [ ] **HTTPS enabled** — `P0` · `Quick` — automatic on Vercel; force HTTPS and HSTS.
- [ ] **CORS configured** — `P1` · `Quick`
  - *Why:* the `/api` functions should only be called by your own origin.
  - *How:* same-origin by default on Vercel; if you expose APIs cross-origin, set explicit `Access-Control-Allow-Origin` (never `*` for authenticated routes).
- [ ] **SQL injection prevention** — `P0` · `Quick`
  - *Status:* the Supabase JS client uses parameterized queries; the SQL functions use typed args. Don't build raw SQL from user input.
- [ ] **XSS prevention** — `P0` · `Quick`
  - *Status:* React escapes by default; no `dangerouslySetInnerHTML` is used. Keep it that way; sanitize any future rich text with [DOMPurify](https://github.com/cure53/DOMPurify).
- [ ] **CSRF protection** — `P1` · `Moderate`
  - *Why:* relevant for cookie-based auth. Supabase auth uses bearer tokens (not cookies), so classic CSRF is largely N/A — but protect mutating GET-less endpoints and require the bearer/secret on `notify`/cron.
- [ ] **Privacy Policy created** — `P0` · `Moderate`
  - *Why:* required by Stripe, Twilio (A2P 10DLC), Apple/Google, and law (GDPR/CCPA).
  - *Tool:* [Termly](https://termly.io) / [iubenda](https://www.iubenda.com). The landing page links `/privacy` — create that page.
- [ ] **Terms of Service created** — `P0` · `Moderate` — same as above; the landing page links `/terms`.
- [ ] **Data encryption at rest** — `P1` · `Quick` — Supabase encrypts at rest by default; confirm and document. Stripe stores card data (you never do).
- [ ] **SMS compliance (STOP/opt-in + A2P 10DLC)** — `P0` · `Involved`
  - *Why:* US carriers require registered campaigns; non-compliant numbers get blocked.
  - *How:* register your brand/campaign in Twilio, ensure opt-in language at booking, and honor STOP (the reminder template already says "Reply STOP to cancel").

---

## D) Infrastructure

- [ ] **Custom domain configured** — `P0` · `Quick` — Vercel → Domains → add `coatpro.app` (and `www`).
- [ ] **SSL certificate installed** — `P0` · `Quick` — auto-provisioned by Vercel once DNS resolves.
- [ ] **DNS records configured** — `P0` · `Quick` — point A/CNAME to Vercel; add SPF/DKIM/DMARC if you send email.
- [ ] **CDN enabled** — `P1` · `Quick` — Vercel serves static assets via its edge CDN automatically; confirm caching headers on `/assets/*`.
- [ ] **Monitoring / alerts** — `P1` · `Moderate` — Sentry alerts + Vercel deploy/runtime alerts to Slack/email.
- [ ] **Uptime monitoring** — `P1` · `Quick` — [Better Stack](https://betterstack.com/uptime) / [UptimeRobot](https://uptimerobot.com) pinging `/` and a lightweight `/api` health check.
- [ ] **Automated backups running** — `P0` · `Quick` — confirm Supabase backups (see B) actually produced a restore point; test a restore once.
- [ ] **Error tracking** — `P1` · `Moderate` — Sentry (same as B/monitoring); wire both client and `api/`.

---

## E) Testing

- [ ] **Payment with a Stripe test card** — `P0` · `Moderate`
  - *How:* in test mode, `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline), exp `12/25`, any CVC. Confirm the `payment_intent.succeeded` webhook flips the booking to `paid`.
- [ ] **SMS delivery** — `P0` · `Moderate`
  - *How:* trigger confirmation/reminder/on-the-way/completion; verify in Twilio → Monitor → Logs and in the `sms_messages` table. Use Twilio magic numbers in dev (`+15005550006` success, `+15005550001` invalid).
- [ ] **Booking end-to-end** — `P0` · `Involved`
  - *How:* real flow — book → pay → webhook → `paid` → confirmation SMS → appears in dashboards.
- [ ] **Slow network** — `P1` · `Quick` — DevTools → Network → "Slow 3G"; confirm spinners/disabled states behave.
- [ ] **Offline / PWA** — `P2` · `Moderate` — only if you add a service worker; otherwise mark N/A.
- [ ] **Real data, not mocks** — `P0` · `Involved` — replace the mock arrays in the dashboards/calendar with `src/lib/queries.ts` calls before launch.
- [ ] **Edge cases** — `P1` · `Involved` — double-booking (the `create_booking` RPC rejects overlaps), declined cards, expired sessions, missing phone, timezone boundaries.

---

## F) Launch

- [ ] **Status page** — `P2` · `Quick` — [Better Stack](https://betterstack.com/status-page) / [Instatus](https://instatus.com).
- [ ] **Support email configured** — `P1` · `Quick` — `hello@coatpro.app` (linked from the landing footer); route to a shared inbox/helpdesk.
- [ ] **Monitoring dashboard live** — `P1` · `Quick` — Sentry + Vercel Analytics + Supabase reports bookmarked for the team.
- [ ] **Team notified of launch** — `P1` · `Quick` — runbook + on-call owner for the first 48h.
- [ ] **Metrics tracked (sign-ups, conversions, errors)** — `P1` · `Moderate` — define funnel events (beta signup → account → first booking → first paid).
- [ ] **Analytics connected** — `P1` · `Quick` — [Vercel Analytics](https://vercel.com/analytics) or [Plausible](https://plausible.io) (privacy-friendly) / Google Analytics 4. Add the snippet to `index.html` + `landing.html`.
- [ ] **Social media ready** — `P2` · `Quick` — schedule launch posts (Buffer/Later).
- [ ] **Email welcome sequence ready** — `P2` · `Moderate` — [Resend](https://resend.com) / Loops / Customer.io triggered on signup.

---

## Recommended deploy order (smoke run)

1. Apply `supabase/full_schema.sql` to the **production** Supabase project; enable backups; test RLS as a real user.
2. Set **all** env vars in Vercel (live Stripe keys, real Twilio creds, secrets).
3. Deploy to a preview URL; run the **E) Testing** block end-to-end against it.
4. Register the Stripe **production webhook** to `https://yourdomain.com/api/webhook` and re-test a live (small) payment.
5. Attach the custom domain; verify SSL + DNS; run Lighthouse + WAVE.
6. Publish Privacy/Terms; connect analytics + Sentry + uptime.
7. Promote to production, watch dashboards for the first 48h.

## Resources
- Vercel deploy & env: https://vercel.com/docs
- Supabase go-live: https://supabase.com/docs/guides/platform/going-into-prod
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Stripe go-live: https://stripe.com/docs/development/checklist
- Stripe webhooks: https://stripe.com/docs/webhooks
- Twilio A2P 10DLC: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- Web Vitals / Lighthouse: https://web.dev/explore/learn-core-web-vitals
- WAVE accessibility: https://wave.webaim.org/
