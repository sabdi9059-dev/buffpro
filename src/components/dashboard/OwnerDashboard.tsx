import { useMemo, useRef, useState } from 'react';

/**
 * COATPRO — owner / admin dashboard.
 *
 * One self-contained file: tab navigation (sidebar on desktop, scrolling
 * sticky tabs on mobile/tablet) plus four tabs — Dashboard, Customers,
 * Bookings, Settings. Everything runs on mock data so it's copy-paste ready;
 * swap the mock arrays / handlers for Supabase queries when you wire it up.
 *
 * No chart library: the revenue chart is hand-drawn SVG bars with hover values.
 */

// ===========================================================================
// Types
// ===========================================================================
type TabId = 'dashboard' | 'customers' | 'bookings' | 'settings';

interface Kpi {
  label: string;
  value: string;
  trend: string;
  /** Visual tone for the trend text. */
  tone: 'green' | 'gold';
  /** Tailwind background + accent classes for the card. */
  bg: string;
  accent: string;
}

type BookingStatus = 'Completed' | 'Scheduled' | 'Cancelled';

interface Booking {
  id: string;
  customer: string;
  service: string;
  dateISO: string;
  price: number;
  status: BookingStatus;
  phone: string;
  email: string;
  vehicle: string;
  notes?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  bookings: number;
  lastVisitISO: string;
  email: string;
}

interface ServiceItem {
  id: string;
  name: string;
  price: number;
}

// ===========================================================================
// Helpers
// ===========================================================================
const money = (n: number) => `$${n.toFixed(2)}`;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** ISO timestamp for `days` from now at an optional hour. */
function daysFromNow(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// ===========================================================================
// Mock data
// ===========================================================================
const KPIS: Kpi[] = [
  {
    label: "Today's Revenue",
    value: '$127.50',
    trend: '+15% vs yesterday',
    tone: 'green',
    bg: 'bg-blue-50',
    accent: 'text-blue-700',
  },
  {
    label: 'This Month Bookings',
    value: '23',
    trend: '+3 vs last month',
    tone: 'green',
    bg: 'bg-violet-50',
    accent: 'text-violet-700',
  },
  {
    label: 'Total Customers',
    value: '156',
    trend: '+12 new this month',
    tone: 'green',
    bg: 'bg-emerald-50',
    accent: 'text-emerald-700',
  },
  {
    label: 'Avg Rating',
    value: '4.8 ⭐',
    trend: '42 reviews',
    tone: 'gold',
    bg: 'bg-amber-50',
    accent: 'text-amber-700',
  },
];

const REVENUE_7D = [
  { day: 'Mon', amount: 85 },
  { day: 'Tue', amount: 120 },
  { day: 'Wed', amount: 65 },
  { day: 'Thu', amount: 150 },
  { day: 'Fri', amount: 180 },
  { day: 'Sat', amount: 195 },
  { day: 'Sun', amount: 110 },
];

const RECENT_BOOKINGS: Booking[] = [
  mkBooking('rb-1', 'Maria Lopez', 'Exterior Wash', daysFromNow(0, 9), 29.99, 'Completed'),
  mkBooking('rb-2', 'Derek Chen', 'Interior', daysFromNow(0, 11), 49.99, 'Completed'),
  mkBooking('rb-3', 'Aisha Bello', 'Full Detail', daysFromNow(0, 14), 99.99, 'Scheduled'),
  mkBooking('rb-4', 'Sam Patel', 'Exterior Wash', daysFromNow(0, 16), 29.99, 'Scheduled'),
  mkBooking('rb-5', 'Tony Rossi', 'Ceramic', daysFromNow(0, 13), 149.99, 'Cancelled'),
];

const CUSTOMERS: Customer[] = [
  cust('c-1', 'Maria Lopez', '+12025550123', 8, daysFromNow(-3)),
  cust('c-2', 'Derek Chen', '+12025550148', 3, daysFromNow(-9)),
  cust('c-3', 'Aisha Bello', '+12025550190', 12, daysFromNow(-1)),
  cust('c-4', 'Sam Patel', '+12025550177', 1, daysFromNow(-20)),
  cust('c-5', 'Tony Rossi', '+12025550102', 5, daysFromNow(-6)),
  cust('c-6', 'Nina Williams', '+12025550155', 7, daysFromNow(-2)),
  cust('c-7', 'Omar Haddad', '+12025550139', 2, daysFromNow(-30)),
  cust('c-8', 'Grace Kim', '+12025550166', 9, daysFromNow(-4)),
  cust('c-9', 'Liam Murphy', '+12025550118', 4, daysFromNow(-14)),
  cust('c-10', 'Priya Shah', '+12025550144', 6, daysFromNow(-8)),
];

const SERVICES_SEED: ServiceItem[] = [
  { id: 's-1', name: 'Exterior Wash', price: 29.99 },
  { id: 's-2', name: 'Interior', price: 49.99 },
  { id: 's-3', name: 'Full Detail', price: 99.99 },
  { id: 's-4', name: 'Ceramic Coating', price: 149.99 },
];

// 15 upcoming bookings spread across the next ~5 weeks (for the date filter).
const UPCOMING_BOOKINGS: Booking[] = Array.from({ length: 15 }, (_, i) => {
  const names = CUSTOMERS.map((c) => c.name);
  const services = ['Exterior Wash', 'Interior', 'Full Detail', 'Ceramic'];
  const prices = [29.99, 49.99, 99.99, 149.99];
  const svcIdx = i % 4;
  return mkBooking(
    `ub-${i + 1}`,
    names[i % names.length],
    services[svcIdx],
    daysFromNow(i + 1, 9 + (i % 8)),
    prices[svcIdx],
    'Scheduled',
  );
});

function mkBooking(
  id: string,
  customer: string,
  service: string,
  dateISO: string,
  price: number,
  status: BookingStatus,
): Booking {
  return {
    id,
    customer,
    service,
    dateISO,
    price,
    status,
    phone: '+12025550100',
    email: `${customer.split(' ')[0].toLowerCase()}@example.com`,
    vehicle: '2022 Honda Civic (Silver)',
    notes: 'Park in the driveway. Gate code #4821.',
  };
}

function cust(
  id: string,
  name: string,
  phone: string,
  bookings: number,
  lastVisitISO: string,
): Customer {
  return { id, name, phone, bookings, lastVisitISO, email: `${name.split(' ')[0].toLowerCase()}@example.com` };
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'customers', label: 'Customers' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'settings', label: 'Settings' },
];

// ===========================================================================
// Main component
// ===========================================================================
export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile / tablet: sticky, horizontally-scrolling tab bar */}
      <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex overflow-x-auto px-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto flex max-w-6xl">
        {/* Desktop: fixed 160px left sidebar */}
        <aside className="sticky top-0 hidden h-screen w-40 shrink-0 border-r border-slate-200 bg-white p-3 lg:block">
          <div className="mb-6 flex items-center gap-2 px-2 pt-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-extrabold text-white">
              C
            </span>
            <span className="font-extrabold tracking-tight text-slate-900">
              COAT<span className="text-blue-600">PRO</span>
            </span>
          </div>
          <ul className="space-y-1">
            {TABS.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'w-full rounded-lg border-l-2 px-3 py-2.5 text-left text-sm font-semibold transition',
                    activeTab === tab.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-transparent text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main content — `key` remounts on tab change for a smooth fade. */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div key={activeTab} className="animate-fade-in">
            {activeTab === 'dashboard' && (
              <DashboardTab onViewAll={() => setActiveTab('bookings')} />
            )}
            {activeTab === 'customers' && <CustomersTab onMessage={showToast} />}
            {activeTab === 'bookings' && <BookingsTab />}
            {activeTab === 'settings' && <SettingsTab onSaved={() => showToast('Settings saved!')} />}
          </div>
        </main>
      </div>

      {/* Global toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Tab: Dashboard
// ===========================================================================
function DashboardTab({ onViewAll }: { onViewAll: () => void }) {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>

      {/* A) KPI CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className={`rounded-xl p-5 shadow-sm ${kpi.bg}`}>
            <p className="text-sm font-medium text-slate-600">{kpi.label}</p>
            <p className={`mt-1 text-3xl font-extrabold ${kpi.accent}`}>{kpi.value}</p>
            <p
              className={`mt-1 text-sm font-medium ${
                kpi.tone === 'green' ? 'text-emerald-600' : 'text-amber-500'
              }`}
            >
              {kpi.trend}
            </p>
          </div>
        ))}
      </div>

      {/* B) REVENUE CHART */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-slate-900">Revenue Last 7 Days</h2>
        <RevenueChart />
      </section>

      {/* C) RECENT BOOKINGS */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Recent Bookings</h2>
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Service</th>
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_BOOKINGS.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-4 font-medium text-slate-900">{b.customer}</td>
                  <td className="py-3 pr-4 text-slate-600">{b.service}</td>
                  <td className="py-3 pr-4 text-slate-600">{formatTime(b.dateISO)}</td>
                  <td className="py-3 pr-4 font-medium text-slate-900">{money(b.price)}</td>
                  <td className="py-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Hand-drawn SVG bar chart with hover tooltips (no chart library). */
function RevenueChart() {
  const [hovered, setHovered] = useState<number | null>(null);

  // Chart geometry (drawn in a viewBox so it scales responsively).
  const W = 700;
  const H = 260;
  const padL = 44;
  const padR = 12;
  const padT = 20;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxY = 200;
  const yTicks = [0, 50, 100, 150, 200];
  const slot = plotW / REVENUE_7D.length;
  const barW = slot * 0.55;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Revenue last 7 days">
      <defs>
        <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      {/* Y gridlines + labels */}
      {yTicks.map((t) => {
        const y = padT + plotH - (t / maxY) * plotH;
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
              ${t}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {REVENUE_7D.map((d, i) => {
        const barH = (d.amount / maxY) * plotH;
        const x = padL + i * slot + (slot - barW) / 2;
        const y = padT + plotH - barH;
        const isHover = hovered === i;
        return (
          <g
            key={d.day}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setHovered((prev) => (prev === i ? null : i))}
            className="cursor-pointer"
          >
            {/* Invisible full-height hit area for easier hover/tap */}
            <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent" />
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={4}
              fill="url(#barBlue)"
              opacity={isHover ? 1 : 0.85}
            />
            <title>{`${d.day}: ${money(d.amount)}`}</title>
            {isHover && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-slate-900 text-[12px] font-semibold">
                {money(d.amount)}
              </text>
            )}
            {/* X label */}
            <text
              x={padL + i * slot + slot / 2}
              y={H - 10}
              textAnchor="middle"
              className="fill-slate-500 text-[12px]"
            >
              {d.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ===========================================================================
// Tab: Customers
// ===========================================================================
function CustomersTab({ onMessage }: { onMessage: (msg: string) => void }) {
  const [query, setQuery] = useState('');

  // Case-insensitive filter by name.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CUSTOMERS;
    return CUSTOMERS.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Customers</h1>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name…"
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Bookings</th>
              <th className="px-4 py-3">Last Visit</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  <a href={`tel:${c.phone}`} className="text-blue-600 hover:underline">
                    {c.phone}
                  </a>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.bookings}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(c.lastVisitISO)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onMessage(`Messaging ${c.name}…`)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Message
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No customers match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
// Tab: Bookings
// ===========================================================================
type DateFilter = 'week' | 'month' | 'all';

function BookingsTab() {
  const [filter, setFilter] = useState<DateFilter>('all');
  const [selected, setSelected] = useState<Booking | null>(null);

  const filtered = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return UPCOMING_BOOKINGS.filter((b) => {
      const d = new Date(b.dateISO);
      if (filter === 'all') return true;
      if (filter === 'week') {
        const diffDays = (d.getTime() - startToday.getTime()) / 86_400_000;
        return diffDays >= 0 && diffDays < 7;
      }
      // month
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [filter]);

  const FILTERS: { id: DateFilter; label: string }[] = [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Bookings</h1>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                filter === f.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Date / Time</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr
                key={b.id}
                onClick={() => setSelected(b)}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">{b.customer}</td>
                <td className="px-4 py-3 text-slate-600">{b.service}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(b.dateISO)}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{money(b.price)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={b.status} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No bookings in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <BookingDetailsModal booking={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function BookingDetailsModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  return (
    <ModalShell title="Booking details" onClose={onClose}>
      <dl className="space-y-3 text-sm">
        <Row label="Customer" value={booking.customer} />
        <div className="flex items-start justify-between gap-3">
          <dt className="text-slate-500">Phone</dt>
          <dd className="text-right">
            <a href={`tel:${booking.phone}`} className="font-medium text-blue-600 underline">
              {booking.phone}
            </a>
          </dd>
        </div>
        <Row label="Service" value={booking.service} />
        <Row label="Date / Time" value={formatDateTime(booking.dateISO)} />
        <Row label="Vehicle" value={booking.vehicle} />
        <Row label="Price" value={money(booking.price)} />
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Status</dt>
          <dd>
            <StatusBadge status={booking.status} />
          </dd>
        </div>
      </dl>
      {booking.notes && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
          <p className="mt-1 text-sm text-slate-700">{booking.notes}</p>
        </div>
      )}
      <button type="button" onClick={onClose} className="mt-5 w-full btn-secondary">
        Close
      </button>
    </ModalShell>
  );
}

// ===========================================================================
// Tab: Settings
// ===========================================================================
function SettingsTab({ onSaved }: { onSaved: () => void }) {
  const [businessName, setBusinessName] = useState('Demo Detailing Co.');
  const [phone, setPhone] = useState('+12025550123');
  const [email, setEmail] = useState('hello@demodetailing.test');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [services, setServices] = useState<ServiceItem[]>(SERVICES_SEED);

  const updateService = (id: string, patch: Partial<ServiceItem>) =>
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addService = () =>
    setServices((prev) => [...prev, { id: `s-${Date.now()}`, name: '', price: 0 }]);

  const deleteService = (id: string) =>
    setServices((prev) => prev.filter((s) => s.id !== id));

  const handleSave = () => {
    // Wire to Supabase here. For now we just confirm with a toast.
    onSaved();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Settings</h1>

      {/* Business info */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-slate-900">Business info</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LabeledInput label="Business Name" value={businessName} onChange={setBusinessName} className="sm:col-span-2" />
          <LabeledInput label="Phone" type="tel" value={phone} onChange={setPhone} />
          <LabeledInput label="Email" type="email" value={email} onChange={setEmail} />
          <LabeledInput label="Start time" type="time" value={startTime} onChange={setStartTime} />
          <LabeledInput label="End time" type="time" value={endTime} onChange={setEndTime} />
        </div>
      </section>

      {/* Services CRUD */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Services</h2>
          <button
            type="button"
            onClick={addService}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Add service
          </button>
        </div>

        <div className="space-y-3">
          {services.map((s) => (
            <div key={s.id} className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
                <input
                  value={s.name}
                  onChange={(e) => updateService(s.id, { name: e.target.value })}
                  placeholder="Service name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs font-medium text-slate-500">Price ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={s.price}
                  onChange={(e) => updateService(s.id, { price: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <button
                type="button"
                onClick={() => deleteService(s.id)}
                aria-label={`Delete ${s.name || 'service'}`}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          ))}
          {services.length === 0 && (
            <p className="text-sm text-slate-500">No services yet. Add one above.</p>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto"
      >
        Save Changes
      </button>
    </div>
  );
}

// ===========================================================================
// Shared bits
// ===========================================================================
const STATUS_STYLES: Record<BookingStatus, string> = {
  Completed: 'bg-emerald-100 text-emerald-800',
  Scheduled: 'bg-blue-100 text-blue-800',
  Cancelled: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      />
    </div>
  );
}

/** Bottom-sheet-on-mobile, centered-on-desktop modal with Escape to close. */
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
