import { useAuth } from '@/auth/AuthContext';

/**
 * A simple authenticated landing page that demonstrates the protected flow:
 * it shows who's logged in, their business + role, and a logout button.
 * Render it inside <ProtectedRoute> (see App.tsx).
 */
export default function AccountPage() {
  const { user, businessId, role, logout, isOwner } = useAuth();

  const ROLE_CAPABILITIES: Record<string, string[]> = {
    owner: ['Edit settings', 'Add/remove staff', 'See all bookings & revenue'],
    manager: ['Manage bookings', 'View customers'],
    technician: ['See assigned jobs', 'Mark jobs complete'],
  };
  const caps = role ? ROLE_CAPABILITIES[role] ?? [] : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            COAT<span className="text-brand-600">PRO</span>
          </span>
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.assign('/login');
            }}
            className="btn-secondary !px-4 !py-2"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Your account</h1>
        <p className="mt-1 text-slate-500">You&apos;re signed in to COATPRO.</p>

        <dl className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
          <Row label="Email" value={user?.email ?? '—'} />
          <Row label="User ID" value={user?.id ?? '—'} mono />
          <Row label="Business ID" value={businessId ?? 'No business yet'} mono />
          <Row label="Role" value={role ?? '—'} />
        </dl>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Your permissions</h2>
          {caps.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
              {caps.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No role assigned.</p>
          )}
        </section>

        {isOwner && (
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/admin" className="btn-primary">
              Owner dashboard
            </a>
            <a href="/dashboard" className="btn-secondary">
              Technician view
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right font-medium text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
