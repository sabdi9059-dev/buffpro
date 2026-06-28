import { useBusiness } from '@/hooks/useBusiness';
import { isSupabaseConfigured } from '@/lib/supabase';
import { BookingFlow } from '@/components/booking/BookingFlow';
import { Spinner } from '@/components/ui/Spinner';
import { AlertIcon } from '@/components/ui/icons';

/**
 * Public booking page for a single detailing business.
 *
 * Which business to show is taken from the URL slug (e.g. /demo-detailing),
 * falling back to VITE_DEFAULT_BUSINESS_SLUG, then to "demo-detailing". A full
 * router can replace this later; keeping it simple keeps the MVP shippable.
 */
function getBusinessSlug(): string {
  const fromPath = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  if (fromPath) return fromPath;
  return import.meta.env.VITE_DEFAULT_BUSINESS_SLUG ?? 'demo-detailing';
}

export default function App() {
  const slug = getBusinessSlug();
  const { business, services, loading, error, reload } = useBusiness(slug);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        {!isSupabaseConfigured ? (
          <SetupNotice />
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-slate-500">
            <Spinner className="h-8 w-8 text-brand-600" />
            <p>Loading booking page…</p>
          </div>
        ) : error || !business ? (
          <ErrorState message={error ?? 'Business not found.'} onRetry={reload} />
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Book with {business.name}
              </h1>
              <p className="mt-1 text-slate-500">
                Select a service, choose a time, and you&apos;re set.
              </p>
            </div>
            <BookingFlow business={business} services={services} />
          </>
        )}
      </main>

      <footer className="py-8 text-center text-xs text-slate-400">
        Powered by COATPRO
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-extrabold text-white">
          C
        </span>
        <span className="text-lg font-extrabold tracking-tight text-slate-900">
          COAT<span className="text-brand-600">PRO</span>
        </span>
      </div>
    </header>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertIcon className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">
        We hit a snag
      </h2>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
      <button type="button" onClick={onRetry} className="btn-primary mt-5">
        Try again
      </button>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
      <h2 className="text-lg font-semibold text-slate-900">Finish your setup</h2>
      <p className="mt-2 text-sm text-slate-700">
        COATPRO needs your Supabase credentials to load. Copy{' '}
        <code className="rounded bg-amber-100 px-1.5 py-0.5">.env.example</code> to{' '}
        <code className="rounded bg-amber-100 px-1.5 py-0.5">.env</code> and set:
      </p>
      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-700">
        <li>
          <code className="rounded bg-amber-100 px-1.5 py-0.5">VITE_SUPABASE_URL</code>
        </li>
        <li>
          <code className="rounded bg-amber-100 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code>
        </li>
      </ul>
      <p className="mt-3 text-sm text-slate-700">
        Then run the SQL in{' '}
        <code className="rounded bg-amber-100 px-1.5 py-0.5">supabase/schema.sql</code> and
        restart the dev server.
      </p>
    </div>
  );
}
