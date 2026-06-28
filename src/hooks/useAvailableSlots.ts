import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface SlotsState {
  slots: string[]; // ISO timestamps
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Fetch bookable start times for a service on a given date via the
 * `get_available_slots` RPC. The server does all the heavy lifting (business
 * hours, slot interval, collision detection) so the client never sees other
 * customers' bookings.
 *
 * Pass `enabled = false` to skip fetching (e.g. before a service/date is set).
 */
export function useAvailableSlots(
  businessId: string | undefined,
  serviceId: string | undefined,
  date: string | undefined,
  enabled = true,
): SlotsState {
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !businessId || !serviceId || !date) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_available_slots', {
        p_business_id: businessId,
        p_service_id: serviceId,
        p_date: date,
      });

      if (rpcError) throw rpcError;

      setSlots((data ?? []).map((row) => row.slot));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not load available times.';
      setError(message);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, businessId, serviceId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  return { slots, loading, error, reload: load };
}
