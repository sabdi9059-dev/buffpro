import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Business, Service } from '@/types/database';

interface BusinessState {
  business: Business | null;
  services: Service[];
  loading: boolean;
  /** Null when no error; a user-friendly message otherwise. */
  error: string | null;
  /** Re-run the fetch (used by the "Try again" button). */
  reload: () => void;
}

/**
 * Load a business and its active services by URL slug.
 *
 * Both reads are covered by the public RLS SELECT policies, so this works for
 * anonymous visitors. We surface loading + error states so the UI can render
 * spinners and retry affordances instead of crashing.
 */
export function useBusiness(slug: string): BusinessState {
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: biz, error: bizError } = await supabase
        .from('businesses')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (bizError) throw bizError;
      if (!biz) {
        setBusiness(null);
        setServices([]);
        setError(`We couldn't find a detailer at "${slug}".`);
        return;
      }

      const { data: svc, error: svcError } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', biz.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (svcError) throw svcError;

      setBusiness(biz);
      setServices(svc ?? []);
    } catch (err) {
      // Network/permission failures land here.
      const message =
        err instanceof Error ? err.message : 'Something went wrong loading this page.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  return { business, services, loading, error, reload: load };
}
