import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * COATPRO — mobile-first technician dashboard.
 *
 * Self-contained and copy-paste ready: ships with mock data and a fake
 * "server" so it runs with zero backend. To use real data, pass a `fetchJobs`
 * prop that returns the technician's jobs for today (e.g. a Supabase query) —
 * the polling, diffing, notifications and modals all keep working unchanged.
 *
 * Features: live header, today's stats, a jobs list with status-driven
 * actions, Details + Complete-Job modals (with photo upload preview), and a
 * 30-second auto-refresh that notifies on new bookings and drops cancelled
 * ones. Built for 375px width with 44px+ touch targets and notch-safe spacing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type JobStatus = 'upcoming' | 'in_progress' | 'completed';

export interface Customer {
  name: string;
  phone: string; // E.164, e.g. "+12025550123"
  email: string;
}

export interface Vehicle {
  year: number;
  make: string;
  model: string;
  color: string;
}

export interface Job {
  id: string;
  customer: Customer;
  vehicle: Vehicle;
  serviceType: string;
  startISO: string; // ISO timestamp
  endISO: string; // ISO timestamp
  price: number; // USD dollars
  status: JobStatus;
  notes?: string;
  /** Captured when the job is completed via the modal. */
  completion?: { notes: string; customerApproved: boolean; photoName?: string };
}

interface TechnicianDashboardProps {
  technicianName?: string;
  /** Swap this for a real data source. Defaults to the built-in mock server. */
  fetchJobs?: () => Promise<Job[]>;
  /** Auto-refresh interval in ms (defaults to 30s per spec). */
  refreshMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const money = (n: number) => `$${n.toFixed(2)}`;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const formatTimeRange = (job: Job) => `${formatTime(job.startISO)} - ${formatTime(job.endISO)}`;

const vehicleLabel = (v: Vehicle) => `${v.year} ${v.make} ${v.model} (${v.color})`;

const todayLongDate = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

// ---------------------------------------------------------------------------
// Mock data + fake "server"
// ---------------------------------------------------------------------------
/** Build an ISO timestamp for today at the given local hour:minute. */
function todayAt(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const BASE_JOBS: Job[] = [
  {
    id: 'job-1',
    customer: { name: 'Maria Lopez', phone: '+12025550123', email: 'maria@example.com' },
    vehicle: { year: 2021, make: 'Toyota', model: 'RAV4', color: 'White' },
    serviceType: 'Exterior Wash',
    startISO: todayAt(8, 0),
    endISO: todayAt(9, 0),
    price: 29.99,
    status: 'completed',
    notes: 'Gate code #4821. Heavy bird droppings on hood.',
    completion: { notes: 'Done, looks great.', customerApproved: true },
  },
  {
    id: 'job-2',
    customer: { name: 'Derek Chen', phone: '+12025550148', email: 'derek.chen@example.com' },
    vehicle: { year: 2022, make: 'Honda', model: 'Civic', color: 'Silver' },
    serviceType: 'Interior',
    startISO: todayAt(10, 0),
    endISO: todayAt(11, 30),
    price: 49.99,
    status: 'upcoming',
    notes: 'Dog hair in back seats. Customer requests odor treatment.',
  },
  {
    id: 'job-3',
    customer: { name: 'Aisha Bello', phone: '+12025550190', email: 'aisha.b@example.com' },
    vehicle: { year: 2020, make: 'Tesla', model: 'Model 3', color: 'Blue' },
    serviceType: 'Full Detail',
    startISO: todayAt(14, 0),
    endISO: todayAt(16, 0),
    price: 99.99,
    status: 'upcoming',
    notes: 'Please use ceramic-safe products only.',
  },
];

/** A booking that "arrives" on the second poll to demo live notifications. */
const INCOMING_JOB: Job = {
  id: 'job-4',
  customer: { name: 'Sam Patel', phone: '+12025550177', email: 'sam.patel@example.com' },
  vehicle: { year: 2023, make: 'Ford', model: 'F-150', color: 'Black' },
  serviceType: 'Exterior Wash',
  startISO: todayAt(16, 30),
  endISO: todayAt(17, 15),
  price: 29.99,
  status: 'upcoming',
  notes: 'New same-day booking.',
};

let mockPollCount = 0;

/**
 * Default mock fetcher. Returns the base jobs and, from the 2nd poll onward,
 * adds an "incoming" booking so the new-booking notification is demonstrable.
 * Replace this with a real network/Supabase call in production.
 */
function defaultFetchJobs(): Promise<Job[]> {
  mockPollCount += 1;
  const jobs = mockPollCount >= 2 ? [...BASE_JOBS, INCOMING_JOB] : [...BASE_JOBS];
  // Simulate network latency.
  return new Promise((resolve) => setTimeout(() => resolve(jobs), 400));
}

// ===========================================================================
// Main component
// ===========================================================================
export default function TechnicianDashboard({
  technicianName = 'John',
  fetchJobs = defaultFetchJobs,
  refreshMs = 30_000,
}: TechnicianDashboardProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Which modal (if any) is open, and for which job.
  const [detailsJobId, setDetailsJobId] = useState<string | null>(null);
  const [completeJobId, setCompleteJobId] = useState<string | null>(null);

  // Keep a ref to the latest jobs so the polling diff can compare against them
  // without re-creating the interval on every state change.
  const jobsRef = useRef<Job[]>([]);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const notifyTimer = useRef<ReturnType<typeof setTimeout>>();
  const showNotification = useCallback((message: string) => {
    setNotification(message);
    if (notifyTimer.current) clearTimeout(notifyTimer.current);
    notifyTimer.current = setTimeout(() => setNotification(null), 5000);
  }, []);

  // -------------------------------------------------------------------------
  // Fetch + merge. Existing jobs keep their *local* status (so a "Start Job"
  // tap isn't wiped by a refresh); new jobs are added and cancelled ones drop.
  // -------------------------------------------------------------------------
  const loadJobs = useCallback(
    async (isInitial: boolean) => {
      if (isInitial) setInitialLoading(true);
      else setRefreshing(true);

      try {
        const incoming = await fetchJobs();
        const prev = jobsRef.current;
        const prevIds = new Set(prev.map((j) => j.id));
        const incomingIds = new Set(incoming.map((j) => j.id));

        const newOnes = incoming.filter((j) => !prevIds.has(j.id));
        const removed = prev.filter((j) => !incomingIds.has(j.id));
        const kept = prev.filter((j) => incomingIds.has(j.id)); // preserve local edits

        const merged = [...kept, ...newOnes].sort((a, b) =>
          a.startISO.localeCompare(b.startISO),
        );
        setJobs(merged);

        // Surface live changes (skip on the very first load).
        if (!isInitial && newOnes.length > 0) {
          showNotification(`New booking from ${newOnes[0].customer.name}`);
        } else if (!isInitial && removed.length > 0) {
          showNotification('A booking was cancelled and removed.');
        }
      } catch {
        showNotification('Could not refresh jobs. Will retry shortly.');
      } finally {
        if (isInitial) setInitialLoading(false);
        else setRefreshing(false);
      }
    },
    [fetchJobs, showNotification],
  );

  // Initial load + 30s polling.
  useEffect(() => {
    void loadJobs(true);
    const id = setInterval(() => void loadJobs(false), refreshMs);
    return () => {
      clearInterval(id);
      if (notifyTimer.current) clearTimeout(notifyTimer.current);
    };
  }, [loadJobs, refreshMs]);

  // -------------------------------------------------------------------------
  // Local job actions
  // -------------------------------------------------------------------------
  const setStatus = (id: string, status: JobStatus) =>
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));

  const confirmCompletion = (
    id: string,
    completion: NonNullable<Job['completion']>,
  ) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'completed', completion } : j)),
    );
    setCompleteJobId(null);
  };

  // -------------------------------------------------------------------------
  // Derived stats
  // -------------------------------------------------------------------------
  const jobsToday = jobs.length;
  const earningsToday = jobs
    .filter((j) => j.status === 'completed')
    .reduce((sum, j) => sum + j.price, 0);

  const detailsJob = jobs.find((j) => j.id === detailsJobId) ?? null;
  const completeJob = jobs.find((j) => j.id === completeJobId) ?? null;

  return (
    // pt for the notch; min-h-screen keeps the footer/background full height.
    <div className="min-h-screen bg-slate-50 pb-[max(env(safe-area-inset-bottom),16px)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-2xl px-4 py-4">
        {/* 1. HEADER */}
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{todayLongDate()}</p>
            <h1 className="text-xl font-bold text-slate-900">Hi, {technicianName}</h1>
          </div>
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-300 text-sm font-bold text-slate-600"
            aria-label="Profile"
          >
            {technicianName.charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Live refresh / notification banner */}
        <div className="mt-2 flex h-5 items-center gap-1.5 text-xs text-slate-400">
          {refreshing && (
            <>
              <Spinner className="h-3.5 w-3.5" /> Updating…
            </>
          )}
        </div>

        {/* 2. TODAY'S STATS */}
        <section className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            label="Jobs Today"
            value={String(jobsToday)}
            className="bg-blue-600"
          />
          <StatCard
            label="Earnings Today"
            value={money(earningsToday)}
            className="bg-emerald-600"
          />
        </section>

        {/* 3. TODAY'S JOBS */}
        <section className="mt-6">
          <h2 className="mb-3 text-base font-bold text-slate-900">Today&apos;s Jobs</h2>

          {initialLoading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
              <Spinner className="h-8 w-8 text-blue-600" />
              <p>Loading your schedule…</p>
            </div>
          ) : jobs.length === 0 ? (
            // 7. EMPTY STATE
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-lg font-semibold text-slate-700">No jobs today.</p>
              <p className="mt-1 text-slate-500">Great job staying on schedule!</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {jobs.map((job) => (
                <li key={job.id}>
                  <JobCard
                    job={job}
                    onStart={() => setStatus(job.id, 'in_progress')}
                    onEnd={() => setStatus(job.id, 'upcoming')}
                    onComplete={() => setCompleteJobId(job.id)}
                    onDetails={() => setDetailsJobId(job.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Toast notification */}
      {notification && (
        <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 flex justify-center px-4 pt-4">
          <div className="pointer-events-auto rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
            {notification}
          </div>
        </div>
      )}

      {/* 4. DETAILS MODAL */}
      {detailsJob && (
        <DetailsModal job={detailsJob} onClose={() => setDetailsJobId(null)} />
      )}

      {/* 5. COMPLETE JOB MODAL */}
      {completeJob && (
        <CompleteJobModal
          job={completeJob}
          onCancel={() => setCompleteJobId(null)}
          onConfirm={(completion) => confirmCompletion(completeJob.id, completion)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className={`rounded-xl p-5 text-white shadow-sm ${className}`}>
      <p className="text-sm font-medium opacity-90">{label}</p>
      <p className="mt-1 text-4xl font-extrabold leading-none">{value}</p>
    </div>
  );
}

const STATUS_STYLES: Record<JobStatus, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'bg-amber-100 text-amber-800' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800' },
};

function StatusBadge({ status }: { status: JobStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}

interface JobCardProps {
  job: Job;
  onStart: () => void;
  onEnd: () => void;
  onComplete: () => void;
  onDetails: () => void;
}

/** A single job card with status-driven action buttons (44px+ touch targets). */
function JobCard({ job, onStart, onEnd, onComplete, onDetails }: JobCardProps) {
  const inProgress = job.status === 'in_progress';
  const completed = job.status === 'completed';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">{job.customer.name}</p>
          <p className="text-sm text-slate-600">{vehicleLabel(job.vehicle)}</p>
          <p className="text-sm text-slate-600">{job.serviceType}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{formatTimeRange(job)}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {!completed && (
          <>
            {inProgress ? (
              <>
                <button type="button" onClick={onEnd} className={btn('blue')}>
                  End Job
                </button>
                <button type="button" onClick={onComplete} className={btn('green')}>
                  Complete Job
                </button>
              </>
            ) : (
              <button type="button" onClick={onStart} className={btn('green')}>
                Start Job
              </button>
            )}
          </>
        )}
        <button type="button" onClick={onDetails} className={btn('gray')}>
          Details
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

/** Reusable modal shell: backdrop, Escape-to-close, mobile sheet → centered. */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    // Lock body scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function DetailsModal({ job, onClose }: { job: Job; onClose: () => void }) {
  return (
    <Modal title="Job details" onClose={onClose}>
      <dl className="space-y-3 text-sm">
        <DetailRow label="Customer" value={job.customer.name} />
        <div className="flex items-start justify-between gap-3">
          <dt className="text-slate-500">Phone</dt>
          <dd className="text-right">
            <a href={`tel:${job.customer.phone}`} className="font-medium text-blue-600 underline">
              {job.customer.phone}
            </a>
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-slate-500">Email</dt>
          <dd className="text-right">
            <a
              href={`mailto:${job.customer.email}`}
              className="font-medium text-blue-600 underline break-all"
            >
              {job.customer.email}
            </a>
          </dd>
        </div>
        <DetailRow label="Vehicle" value={vehicleLabel(job.vehicle)} />
        <DetailRow label="Service" value={job.serviceType} />
        <DetailRow label="Time" value={formatTimeRange(job)} />
      </dl>

      <div className="mt-4 rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Notes / special instructions
        </p>
        <p className="mt-1 text-sm text-slate-700">
          {job.notes?.trim() ? job.notes : 'No special instructions.'}
        </p>
      </div>

      <button type="button" onClick={onClose} className={`mt-5 w-full ${btn('gray')}`}>
        Close
      </button>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function CompleteJobModal({
  job,
  onCancel,
  onConfirm,
}: {
  job: Job;
  onCancel: () => void;
  onConfirm: (completion: NonNullable<Job['completion']>) => void;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [approved, setApproved] = useState(false);

  // Revoke the object URL when the preview changes or the modal unmounts to
  // avoid leaking blob memory.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setPhotoName(file.name);
  };

  return (
    <Modal title={`Complete: ${job.customer.name}`} onClose={onCancel}>
      {/* Photo upload + preview */}
      <label className="block text-sm font-medium text-slate-700">After photo</label>
      <input
        type="file"
        accept="image/*"
        onChange={handlePhoto}
        className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
      />
      {photoUrl && (
        <img
          src={photoUrl}
          alt="Upload preview"
          className="mt-3 h-40 w-full rounded-lg object-cover"
        />
      )}

      {/* Notes */}
      <label className="mt-4 block text-sm font-medium text-slate-700">
        Notes (optional)
      </label>
      <textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything the customer or office should know…"
        className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      />

      {/* Customer approved — required before completion can be confirmed. */}
      <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          checked={approved}
          onChange={(e) => setApproved(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-blue-600"
        />
        Customer approved
      </label>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          disabled={!approved}
          onClick={() => onConfirm({ notes: notes.trim(), customerApproved: approved, photoName })}
          className={`flex-1 ${btn('green')} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Confirm Completion
        </button>
        <button type="button" onClick={onCancel} className={`flex-1 ${btn('gray')}`}>
          Cancel
        </button>
      </div>
      {!approved && (
        <p className="mt-2 text-center text-xs text-slate-400">
          Confirm customer approval to complete the job.
        </p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------

/** Shared button styles by color. All meet the 44px min touch target. */
function btn(color: 'green' | 'blue' | 'gray') {
  const base =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition';
  const variants = {
    green: 'bg-emerald-600 text-white hover:bg-emerald-700',
    blue: 'bg-blue-600 text-white hover:bg-blue-700',
    gray: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  } as const;
  return `${base} ${variants[color]}`;
}

function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
