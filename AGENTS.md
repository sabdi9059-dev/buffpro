# AGENTS.md

## Cursor Cloud specific instructions

COATPRO is a single-page **React 18 + TypeScript** app built with **Vite**, styled with
**Tailwind CSS**, and backed by **Supabase** (PostgreSQL). Standard commands (install, dev,
build, preview, lint, typecheck) and the Supabase setup steps are documented in `README.md`
and `package.json` — refer to those rather than duplicating them here.

Non-obvious context for working in this repo:

- **The application code lives on the feature branch, not `main`.** The `main` branch only
  contains a placeholder `README.md` (no `package.json`). All app code, configs, and
  dependencies live on the `cursor/coatpro-foundation-booking-flow-*` branch (and branches
  cut from it). If a tree has no `package.json`, you are likely on `main`; check out the
  feature branch to develop. The update script guards `npm install` so it is a no-op on
  `main`.
- **Most of the UI runs with no backend.** A tiny custom client-side router in `src/App.tsx`
  keys off the first path segment. These routes need no Supabase config and use self-contained
  mock data, making them ideal for quick verification:
  - `/calendar` — standalone booking calendar widget (full booking flow, mock submit).
  - `/dashboard` — technician dashboard (mock data).
  - `/admin` — owner/admin dashboard (mock data).
- **Only `/` (the Supabase-backed public booking page) needs credentials.** Without a `.env`
  containing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, that route renders a friendly
  "Finish your setup" notice instead of crashing. To exercise it for real, create a Supabase
  project, run `supabase/schema.sql` in the SQL editor, and fill in `.env` (copy `.env.example`).
  `.env` is gitignored.
- **Vite env vars must be `VITE_`-prefixed** to reach the client bundle, and the dev server
  must be restarted after changing `.env` (Vite reads env only at startup).
- The dev server runs on **http://localhost:5173** by default.
- The booking form validates phone numbers in **E.164-style** format (e.g. `+15551234567`);
  loosely-formatted numbers like `555-123-4567` are rejected by client-side validation.
