import { useState, type ComponentType, type SVGProps } from 'react';
import { useBusiness } from '@/hooks/useBusiness';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Spinner } from '@/components/ui/Spinner';
import {
  AlertIcon,
  CalendarIcon,
  DashboardIcon,
  SettingsIcon,
  UsersIcon,
} from '@/components/ui/icons';
import { DashboardTab } from './DashboardTab';
import { CustomersTab } from './CustomersTab';
import { BookingsTab } from './BookingsTab';
import { SettingsTab } from './SettingsTab';
import { Toast } from './Toast';

type TabKey = 'dashboard' | 'customers' | 'bookings' | 'settings';

const TABS: { key: TabKey; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { key: 'customers', label: 'Customers', icon: UsersIcon },
  { key: 'bookings', label: 'Bookings', icon: CalendarIcon },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

/** Which business the owner is managing (single-tenant for now). */
function getAdminSlug(): string {
  return import.meta.env.VITE_DEFAULT_BUSINESS_SLUG ?? 'demo-detailing';
}

/**
 * Owner/admin dashboard shell.
 *
 * Holds the active-tab + toast state and a responsive nav: a left sidebar on
 * desktop (≥ lg) and a horizontally-scrolling sticky tab bar on smaller
 * screens. Tab content is swapped client-side (no routing library).
 */
export function AdminApp() {
  const slug = getAdminSlug();
  const { business, services, loading, error, reload } = useBusiness(slug);
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />

      {/* Mobile / tablet tabs: sticky, horizontally scrollable */}
      <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex gap-1 overflow-x-auto px-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition ${
                tab === key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
        {/* Desktop sidebar (160px) */}
        <aside className="sticky top-6 hidden h-fit w-40 shrink-0 lg:block">
          <ul className="space-y-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex w-full items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-sm font-semibold transition ${
                    tab === key
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-transparent text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {!isSupabaseConfigured ? (
            <SetupNotice />
          ) : loading ? (
            <div className="flex flex-col items-center gap-3 py-24 text-slate-500">
              <Spinner className="h-8 w-8 text-brand-600" />
              <p>Loading dashboard…</p>
            </div>
          ) : error || !business ? (
            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              <AlertIcon className="h-5 w-5 shrink-0" />
              {error ?? 'Business not found.'}
            </div>
          ) : (
            <>
              <header className="mb-5">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {TABS.find((t) => t.key === tab)?.label}
                </h1>
                <p className="text-sm text-slate-500">{business.name}</p>
              </header>

              {tab === 'dashboard' && (
                <DashboardTab business={business} onViewAllBookings={() => setTab('bookings')} />
              )}
              {tab === 'customers' && <CustomersTab business={business} notify={setToast} />}
              {tab === 'bookings' && <BookingsTab business={business} />}
              {tab === 'settings' && (
                <SettingsTab
                  business={business}
                  services={services}
                  reload={reload}
                  notify={setToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function TopBar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-extrabold text-white">
            C
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            COAT<span className="text-brand-600">PRO</span>
          </span>
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
            Owner
          </span>
        </div>
        <a
          href="/"
          className="text-sm font-semibold text-brand-600 transition hover:text-brand-700"
        >
          View booking page →
        </a>
      </div>
    </header>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
      <h2 className="text-lg font-semibold text-slate-900">Finish your setup</h2>
      <p className="mt-2 text-sm text-slate-700">
        The dashboard needs Supabase credentials. Copy <code>.env.example</code> to{' '}
        <code>.env</code>, set <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code>, run <code>supabase/schema.sql</code> then{' '}
        <code>supabase/admin.sql</code>, and restart the dev server.
      </p>
    </div>
  );
}
