# AGENTS.md

## Cursor Cloud specific instructions

COATPRO is a single React 18 + TypeScript app (Vite) styled with Tailwind, backed
by Supabase (PostgreSQL). It currently ships one feature: a public, mobile-first
customer booking wizard wired end-to-end to Supabase via two RPCs
(`get_available_slots`, `create_booking`). The full application code lives on the
`cursor/coatpro-foundation-booking-flow-d3ce` branch; `main` is an empty stub, so
run/setup commands only make sense on a branch that actually contains the app.

### Standard commands (see `package.json`)
- `npm run dev` — Vite dev server (http://localhost:5173).
- `npm run lint` — ESLint.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — typecheck + production build.
- There is **no automated test suite** (no `test` script); verify changes via
  lint/typecheck/build and by exercising the booking flow in the browser.

### Running the booking flow end-to-end (needs a Supabase backend)
The dev server runs without Supabase, but it only shows a "Finish your setup"
notice until `.env` has valid credentials. To exercise the actual booking flow
you need a Supabase backend. Locally this is provided by the Supabase CLI, which
runs the full stack in Docker. Docker, the `supabase` CLI, and the pulled images
are provisioned during environment setup (not by the update script).

Startup sequence for a fresh session:
1. Start the Docker daemon if it isn't running: `sudo dockerd > /tmp/dockerd.log 2>&1 &`
   then `sudo chmod 666 /var/run/docker.sock` (the `ubuntu` user is in the
   `docker` group, but the socket perms reset across boots).
2. From the repo root: `supabase start` (uses `supabase/config.toml`, created by
   `supabase init`). It prints `API_URL` and `ANON_KEY` — `supabase status` reprints them.
3. Apply the schema + seed (idempotent):
   `docker exec -i supabase_db_workspace psql -U postgres -d postgres < supabase/schema.sql`
4. **Non-obvious gotcha:** `schema.sql` enables RLS and defines `select` policies
   but relies on the `anon`/`authenticated` roles already having table-level
   `GRANT`s — hosted Supabase grants these automatically, but the local CLI does
   not for tables created via raw `psql`. Without them every read returns
   `permission denied for table ...`. Grant them once after applying the schema:
   `docker exec -i supabase_db_workspace psql -U postgres -d postgres -c "GRANT USAGE ON SCHEMA public TO anon, authenticated; GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;"`
5. Create `.env` (gitignored) from the printed credentials:
   ```env
   VITE_SUPABASE_URL="http://127.0.0.1:54321"
   VITE_SUPABASE_ANON_KEY="<ANON_KEY from supabase status>"
   VITE_DEFAULT_BUSINESS_SLUG="demo-detailing"
   ```
6. `npm run dev` and open the app. The seed creates a `demo-detailing` business
   with four services; the page resolves the business from the URL slug, falling
   back to `VITE_DEFAULT_BUSINESS_SLUG`.

Notes:
- Restart the dev server after changing `.env` (Vite only reads env at startup).
- Booking writes go through the `create_booking` `SECURITY DEFINER` RPC; the
  booking page never writes to `customers`/`bookings` tables directly.
- `supabase/config.toml` and `.env` are not committed; they persist on the VM
  but regenerate with `supabase init` / `supabase status` if missing.
