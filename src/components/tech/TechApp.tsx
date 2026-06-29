import { useMemo, useState } from 'react';
import { useBusiness } from '@/hooks/useBusiness';
import { useTechJobs } from '@/hooks/useTechJobs';
import { isSupabaseConfigured } from '@/lib/supabase';
import { startJob, toMessage } from '@/lib/techApi';
import { formatPrice } from '@/lib/format';
import { Spinner } from '@/components/ui/Spinner';
import { AlertIcon } from '@/components/ui/icons';
import { Toast } from '@/components/admin/Toast';
import type { TechJob } from '@/types/tech';
import { JobCard } from './JobCard';
import { JobDetailsModal } from './JobDetailsModal';
import { CompleteJobModal } from './CompleteJobModal';

/** Single-tenant for now: which business this technician works for. */
function getTechSlug(): string {
  return import.meta.env.VITE_DEFAULT_BUSINESS_SLUG ?? 'demo-detailing';
}

// Hardcoded until technician auth exists.
const TECH_NAME = 'John';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Technician dashboard (mobile-first).
 *
 * Shows today's jobs for the business, auto-refreshing every 30s via
 * `useTechJobs`. The tech can Start a job (→ in_progress), open Details, or
 * Complete a job (photo + notes + approval) through modals.
 */
export function TechApp() {
  const slug = getTechSlug();
  const { business } = useBusiness(slug);
  const businessId = business?.id;

  const { jobs, loading, error, reload } = useTechJobs(businessId);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailsJob, setDetailsJob] = useState<TechJob | null>(null);
  const [completingJob, setCompletingJob] = useState<TechJob | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const jobsToday = jobs.length;
  const earningsToday = useMemo(
    () =>
      jobs
        .filter((j) => j.status === 'completed')
        .reduce((sum, j) => sum + j.price_cents, 0),
    [jobs],
  );

  const handleStart = async (job: TechJob) => {
    if (!businessId) return;
    setBusyId(job.job_id);
    try {
      await startJob(businessId, job.job_id);
      await reload();
      setToast('Job started.');
    } catch (err) {
      setToast(toMessage(err, 'Could not start the job.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {todayLabel()}
            </p>
            <h1 className="truncate text-xl font-extrabold text-slate-900">
              Hi, {TECH_NAME}
            </h1>
          </div>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600"
            aria-label={`${TECH_NAME} profile`}
          >
            {initials(TECH_NAME)}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5">
        {!isSupabaseConfigured ? (
          <SetupNotice />
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 py-24 text-slate-500">
            <Spinner className="h-8 w-8 text-brand-600" />
            <p>Loading today’s jobs…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertIcon className="h-5 w-5 shrink-0" /> {error}
            </div>
            <button type="button" onClick={() => void reload()} className="btn-secondary mt-4">
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
                <p className="text-sm font-medium text-slate-600">Jobs Today</p>
                <p className="mt-1 text-4xl font-extrabold text-brand-700">{jobsToday}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                <p className="text-sm font-medium text-slate-600">Earnings Today</p>
                <p className="mt-1 text-4xl font-extrabold text-emerald-700">
                  {formatPrice(earningsToday)}
                </p>
              </div>
            </div>

            {/* Jobs */}
            <h2 className="mb-3 mt-6 text-base font-bold text-slate-900">Today’s jobs</h2>
            {jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-base font-semibold text-slate-700">No jobs today.</p>
                <p className="mt-1 text-sm text-slate-500">Great job staying on schedule!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.job_id}
                    job={job}
                    timezone={business?.timezone}
                    busy={busyId === job.job_id}
                    onStart={handleStart}
                    onComplete={setCompletingJob}
                    onDetails={setDetailsJob}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {detailsJob && (
        <JobDetailsModal
          job={detailsJob}
          timezone={business?.timezone}
          onClose={() => setDetailsJob(null)}
        />
      )}

      {completingJob && businessId && (
        <CompleteJobModal
          businessId={businessId}
          job={completingJob}
          onCancel={() => setCompletingJob(null)}
          onCompleted={() => {
            setCompletingJob(null);
            void reload();
            setToast('Job completed!');
          }}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="text-lg font-semibold text-slate-900">Finish your setup</h2>
      <p className="mt-2 text-sm text-slate-700">
        The technician dashboard needs Supabase credentials. Set{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
        <code>.env</code>, run <code>supabase/schema.sql</code> then{' '}
        <code>supabase/technician.sql</code>, and restart the dev server.
      </p>
    </div>
  );
}
