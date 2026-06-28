import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Single shared Supabase client for the whole app.
 *
 * We read credentials from Vite env vars (VITE_ prefix = exposed to the
 * browser bundle). The anon key is safe to ship to the client *as long as*
 * Row Level Security (RLS) is enabled on every table — which our schema does.
 *
 * We fail loudly during development if the env vars are missing so the
 * mistake is obvious instead of producing confusing 401s at runtime.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Whether the app has real Supabase credentials. The UI checks this so that a
 * fresh clone shows a friendly "add your env vars" screen instead of crashing
 * with confusing network errors.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Warn loudly in dev without taking the whole app down.
  console.warn(
    '[COATPRO] Missing Supabase env vars. Copy .env.example to .env and set ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  );
}

// Fall back to harmless placeholder values when unconfigured so that importing
// this module never throws; real calls are gated behind `isSupabaseConfigured`.
export const supabase = createClient<Database>(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
