import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { CoatproDatabase, TeamRole } from '@/types/coatpro-db';

/**
 * COATPRO — authentication + multi-tenant context.
 *
 * Wrap the app in <AuthProvider>. Components read auth state via `useAuth()`:
 *   const { user, businessId, role, isLoading, signIn, signUp, logout } = useAuth();
 *
 * Tenancy: on login we resolve the user's `business_id` + `role` via the
 * `get_my_membership` RPC (owner of a business, or an active team member). All
 * data access is then scoped to that business by the RLS policies in
 * `full_schema.sql`.
 */

// The app's shared client is typed to the demo schema; cast it to the full
// schema for the auth/membership queries. It's the SAME client instance, so the
// session stays in sync — no "multiple GoTrueClient" warning.
const db = supabase as unknown as SupabaseClient<CoatproDatabase>;

export type UserRole = TeamRole; // 'owner' | 'manager' | 'technician'

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  /** The tenant the user belongs to (null until resolved / if none). */
  businessId: string | null;
  /** The user's role within that business. */
  role: UserRole | null;
  /** True while the initial session check (and membership load) is running. */
  isLoading: boolean;
  signUp: (params: SignUpParams) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Convenience role checks. */
  isOwner: boolean;
  isTechnician: boolean;
}

export interface SignUpParams {
  email: string;
  password: string;
  businessName: string;
  fullName?: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Avoid setting state after unmount.
  const mounted = useRef(true);

  /** Resolve the current user's business + role (one RPC round-trip). */
  const loadMembership = useCallback(async () => {
    try {
      const { data, error } = await db.rpc('get_my_membership');
      if (error) throw error;
      const membership = data?.[0];
      if (!mounted.current) return;
      setBusinessId(membership?.business_id ?? null);
      setRole((membership?.role as UserRole) ?? null);
    } catch (err) {
      // A missing membership isn't fatal — the user just has no tenant yet.
      console.error('[auth] failed to load membership:', err);
      if (mounted.current) {
        setBusinessId(null);
        setRole(null);
      }
    }
  }, []);

  // On mount: check for an existing session, then subscribe to auth changes.
  useEffect(() => {
    mounted.current = true;

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted.current) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadMembership();
      if (mounted.current) setIsLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        void loadMembership();
      } else {
        setBusinessId(null);
        setRole(null);
      }
    });

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, [loadMembership]);

  const signUp = useCallback(
    async ({ email, password, businessName, fullName }: SignUpParams) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // The DB trigger reads this metadata to create the business + owner row.
        options: { data: { business_name: businessName, full_name: fullName ?? '' } },
      });
      if (error) throw error;
      // If email confirmation is enabled, there's no session yet.
      return { needsEmailConfirmation: !data.session };
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // onAuthStateChange will fire and load membership.
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setBusinessId(null);
    setRole(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      businessId,
      role,
      isLoading,
      signUp,
      signIn,
      logout,
      isOwner: role === 'owner',
      isTechnician: role === 'technician',
    }),
    [user, session, businessId, role, isLoading, signUp, signIn, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access auth state. Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>.');
  return ctx;
}
