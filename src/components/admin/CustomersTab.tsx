import { useMemo, useState } from 'react';
import { useAdminCustomers } from '@/hooks/useAdminData';
import { Spinner } from '@/components/ui/Spinner';
import { AlertIcon, ChatIcon, SearchIcon } from '@/components/ui/icons';
import type { Business } from '@/types/database';

interface CustomersTabProps {
  business: Business;
  notify: (message: string) => void;
}

/** Short local date, e.g. "Jun 29, 2026". Null → em-dash. */
function shortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function CustomersTab({ business, notify }: CustomersTabProps) {
  const { data: customers, loading, error } = useAdminCustomers(business.id);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.full_name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [customers, query]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone…"
          className="input-base pl-9"
        />
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <AlertIcon className="h-5 w-5 shrink-0" /> {error}
        </div>
      ) : loading ? (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-16">
          <Spinner className="h-7 w-7 text-brand-600" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium"># Bookings</th>
                  <th className="px-5 py-3 font-medium">Last Visit</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      No customers match “{query}”.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.customer_id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-slate-800">{c.full_name}</td>
                      <td className="px-5 py-3 text-slate-600">{c.phone}</td>
                      <td className="px-5 py-3 text-slate-600">{c.bookings_count}</td>
                      <td className="px-5 py-3 text-slate-600">{shortDate(c.last_visit)}</td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => notify(`SMS to ${c.full_name} — coming soon!`)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <ChatIcon className="h-4 w-4" /> Message
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        {filtered.length} customer{filtered.length === 1 ? '' : 's'}
      </p>
    </div>
  );
}
