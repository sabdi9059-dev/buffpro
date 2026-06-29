import { useCallback, useEffect, useState } from 'react';
import {
  fetchBookings,
  fetchCustomers,
  fetchDashboardStats,
  fetchRevenue7d,
  toMessage,
} from '@/lib/adminApi';
import type {
  AdminBooking,
  AdminCustomer,
  DashboardStats,
  RevenueDay,
} from '@/types/admin';

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Tiny generic data-fetching hook: runs `fetcher` on mount + when `businessId`
 * changes (and on demand via `reload`), tracking loading/error state. Skips
 * fetching until a business id is known.
 */
function useAsync<T>(
  businessId: string | undefined,
  fetcher: (id: string) => Promise<T>,
  initial: T,
  fallbackMsg: string,
): AsyncState<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher(businessId));
    } catch (err) {
      setError(toMessage(err, fallbackMsg));
    } finally {
      setLoading(false);
    }
    // fetcher is stable (module-level); businessId is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

/** Headline KPIs for the dashboard tab. */
export function useDashboardStats(businessId: string | undefined) {
  return useAsync<DashboardStats | null>(
    businessId,
    fetchDashboardStats,
    null,
    'Could not load dashboard stats.',
  );
}

/** Trailing 7-day revenue series for the chart. */
export function useRevenue7d(businessId: string | undefined) {
  return useAsync<RevenueDay[]>(
    businessId,
    fetchRevenue7d,
    [],
    'Could not load revenue.',
  );
}

/** All bookings (joined to customer + service), newest first. */
export function useAdminBookings(businessId: string | undefined) {
  return useAsync<AdminBooking[]>(
    businessId,
    fetchBookings,
    [],
    'Could not load bookings.',
  );
}

/** All customers with aggregated activity. */
export function useAdminCustomers(businessId: string | undefined) {
  return useAsync<AdminCustomer[]>(
    businessId,
    fetchCustomers,
    [],
    'Could not load customers.',
  );
}
