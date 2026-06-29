import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTodayJobs, toMessage } from '@/lib/techApi';
import type { TechJob } from '@/types/tech';

interface TechJobsState {
  jobs: TechJob[];
  /** True only on the very first load (so polling never flashes a spinner). */
  loading: boolean;
  error: string | null;
  /** Force an immediate refetch. */
  reload: () => void;
}

const POLL_INTERVAL_MS = 30_000;

/**
 * Load today's jobs for a business and keep them fresh.
 *
 * Refetches on mount, every 30s, and whenever the tab regains focus. New
 * bookings appear and cancelled ones drop off on the next poll (the RPC already
 * filters cancelled/no-show). Only the initial fetch toggles `loading`, so the
 * background refresh is invisible to the technician mid-task.
 */
export function useTechJobs(businessId: string | undefined): TechJobsState {
  const [jobs, setJobs] = useState<TechJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (!businessId) return;
    if (firstLoad.current) setLoading(true);
    try {
      setJobs(await fetchTodayJobs(businessId));
      setError(null);
    } catch (err) {
      setError(toMessage(err, 'Could not load today’s jobs.'));
    } finally {
      setLoading(false);
      firstLoad.current = false;
    }
  }, [businessId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_INTERVAL_MS);

    // Refresh immediately when the tab becomes visible again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { jobs, loading, error, reload: load };
}
